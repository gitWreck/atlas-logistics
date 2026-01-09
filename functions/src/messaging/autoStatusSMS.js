"use strict";

const path = require("path");
const { onDocumentUpdated } = require("firebase-functions/v2/firestore");
const { defineSecret } = require("firebase-functions/params");
const admin = require("firebase-admin");

const { buildStatusSMS } = require(path.join(
  __dirname,
  "../messaging/",
  "buildStatusSMS"
));
const { buildSmsSignature } = require("../../shared/sms-suppression");

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

/**
 * Auto-enqueue SMS when status changes
 */
exports.autoStatusSMS = onDocumentUpdated(
  {
    region: "asia-southeast1",
    document: "tracking_records/{trackingId}",
  },
  async (event) => {
    const before = event.data.before.data();
    const after = event.data.after.data();
    const trackingId = event.params.trackingId;

    if (!before || !after) return;

    // Only react when status changes
    if (
      before.status === after.status &&
      before.delayReason === after.delayReason &&
      before.delayCleared === after.delayCleared
    ) {
      return;
    }

    const phone = after.customerPhone;
    if (!phone) return;

    const status = after.status;
    const delayReason = after.delayReason || null;
    const delayCleared = !!after.delayCleared;

    // Build canonical message
    const message = buildStatusSMS({
      trackingId,
      status,
      delayReason,
      delayCleared,
    });

    // Build idempotency signature
    const signature = buildSmsSignature({
      trackingId,
      phone,
      status,
      delayReason,
      delayCleared,
      message,
    });

    // Enqueue
    await db.collection("sms_queue").add({
      trackingId,
      phone,
      status,
      delayReason,
      delayCleared,
      message,
      signature,
      source: "auto_status",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      attempts: 0,
    });
  }
);
