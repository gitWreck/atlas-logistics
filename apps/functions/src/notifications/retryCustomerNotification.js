"use strict";

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const { requireRole, updatedBy } = require("../utilities/helpers");
const { retryNotificationLog } = require("./customerNotificationService");
const {
  SEMAPHORE_API_KEY,
  SEMAPHORE_SENDER_NAME,
} = require("../../shared/sms-service");
const { defineSecret } = require("firebase-functions/params");

const SMTP_EMAIL = defineSecret("SMTP_EMAIL");
const SMTP_PASSWORD = defineSecret("SMTP_PASSWORD");

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

exports.retryCustomerNotification = onCall(
  {
    region: "asia-southeast1",
    secrets: [SEMAPHORE_API_KEY, SEMAPHORE_SENDER_NAME, SMTP_EMAIL, SMTP_PASSWORD],
    maxInstances: 10,
  },
  async (req) => {
    await requireRole(db, req, ["admin", "manager"]);

    const dedupKey = String(req.data?.dedupKey || "").trim();
    if (!dedupKey) {
      throw new HttpsError("invalid-argument", "dedupKey is required.");
    }

    const { uid, role, name } = updatedBy(req);

    try {
      const result = await retryNotificationLog({
        db,
        dedupKey,
        actor: { uid, role, name },
      });

      if (result.reason === "not_found") {
        throw new HttpsError("not-found", "Notification log not found.");
      }

      return {
        success: true,
        dedupKey,
        ...result,
      };
    } catch (error) {
      if (error instanceof HttpsError) throw error;
      throw new HttpsError(
        "internal",
        error?.message || "Failed to retry notification.",
      );
    }
  },
);
