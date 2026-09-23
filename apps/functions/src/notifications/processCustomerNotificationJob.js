"use strict";

const admin = require("firebase-admin");
const { FieldValue } = require("firebase-admin/firestore");
const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { defineSecret } = require("firebase-functions/params");
const {
  SEMAPHORE_API_KEY,
  SEMAPHORE_SENDER_NAME,
} = require("../../shared/sms-service");
const {
  sendAutomaticShipmentLifecycleNotification,
} = require("./customerNotificationService");

const SMTP_EMAIL = defineSecret("SMTP_EMAIL");
const SMTP_PASSWORD = defineSecret("SMTP_PASSWORD");

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

exports.processCustomerNotificationJob = onDocumentCreated(
  {
    document: "customer_notification_jobs/{jobId}",
    region: "asia-southeast1",
    retry: true,
    maxInstances: 10,
    secrets: [
      SEMAPHORE_API_KEY,
      SEMAPHORE_SENDER_NAME,
      SMTP_EMAIL,
      SMTP_PASSWORD,
    ],
  },
  async (event) => {
    const createdSnap = event.data;
    if (!createdSnap) return;

    const jobRef = createdSnap.ref;
    const currentSnap = await jobRef.get();
    if (!currentSnap.exists) return;

    const job = currentSnap.data() || {};
    if (["COMPLETED", "SKIPPED"].includes(String(job.status || ""))) {
      return;
    }

    const shipmentId = String(job.shipmentId || "").trim();
    if (!shipmentId || !job.notificationType) {
      await jobRef.set(
        {
          status: "SKIPPED",
          reason: "MISSING_REQUIRED_FIELDS",
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
      return;
    }

    await jobRef.set(
      {
        status: "PROCESSING",
        attempts: FieldValue.increment(1),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );

    try {
      const shipmentSnap = await db.collection("shipments").doc(shipmentId).get();
      if (!shipmentSnap.exists) {
        await jobRef.set(
          {
            status: "SKIPPED",
            reason: "SHIPMENT_NOT_FOUND",
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true },
        );
        return;
      }

      const result = await sendAutomaticShipmentLifecycleNotification({
        db,
        shipment: shipmentSnap.data() || {},
        shipmentId,
        tripId: job.tripId || null,
        notificationType: job.notificationType,
        source: job.source || "CUSTOMER_NOTIFICATION_JOB",
        channels: job.channels || null,
        actor: job.actor || {},
      });

      await jobRef.set(
        {
          status: "COMPLETED",
          result: {
            sent: Number(result?.sent) || 0,
            queued: Number(result?.queued) || 0,
            skipped: result?.skipped === true,
          },
          completedAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
    } catch (error) {
      await jobRef.set(
        {
          status: "RETRYING",
          lastError: String(error?.message || error).slice(0, 1000),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
      throw error;
    }
  },
);
