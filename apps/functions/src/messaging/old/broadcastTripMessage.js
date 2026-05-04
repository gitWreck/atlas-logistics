"use strict";

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const { assertAdminOrManager } = require("../../system/authGuards");

// 1. IMPORT EVERYTHING FROM SHARED SERVICE
// We get the function AND the Secret definitions from one place.
const {
  sendSmsViaProvider,
  SEMAPHORE_API_KEY,
  SEMAPHORE_SENDER_NAME,
} = require("../../../shared/sms-service");

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

/**
 * ==================================================================
 * CORE LOGIC: broadcastTripLogic
 * Purpose: Reusable function to blast SMS to all customers on a trip.
 * ==================================================================
 */
async function broadcastTripLogic({
  tripId,
  message,
  actorUid,
  type = "BROADCAST",
}) {
  if (!tripId || !message) {
    throw new Error("Missing tripId or message for broadcast.");
  }

  // 1. Fetch Shipments to find recipients
  const shipmentsSnap = await db
    .collection("shipments")
    .where("currentTruckTripId", "==", tripId)
    .get();

  if (shipmentsSnap.empty) {
    console.log(`[Broadcast] Trip ${tripId} has no shipments. Skipping.`);
    return { success: true, count: 0, sent: 0, failed: 0 };
  }

  // 2. Extract Unique Phone Numbers (Deduplication)
  const recipients = new Map();

  shipmentsSnap.forEach((doc) => {
    const data = doc.data();
    const phone = data.recipient?.phone;

    if (phone && typeof phone === "string" && phone.length >= 10) {
      recipients.set(phone, {
        phone,
        name: data.recipient?.name || "Customer",
      });
    }
  });

  const uniqueList = Array.from(recipients.values());
  const totalRecipients = uniqueList.length;

  if (totalRecipients === 0) {
    console.log(
      `[Broadcast] Trip ${tripId} has shipments but no valid phones.`,
    );
    return { success: true, count: 0, sent: 0, failed: 0 };
  }

  console.log(
    `[Broadcast] Starting ${type} for Trip ${tripId} to ${totalRecipients} unique numbers.`,
  );

  // 3. Send Messages
  const results = await Promise.allSettled(
    uniqueList.map(async (recipient) => {
      try {
        // This calls the shared function which uses .value() internally
        await sendSmsViaProvider({ phone: recipient.phone, message });
        return { status: "fulfilled", phone: recipient.phone };
      } catch (err) {
        console.error(
          `[Broadcast] Failed to send to ${recipient.phone}:`,
          err.message,
        );
        return {
          status: "rejected",
          phone: recipient.phone,
          error: err.message,
        };
      }
    }),
  );

  // 4. Calculate Stats
  const successCount = results.filter((r) => r.status === "fulfilled").length;
  const failCount = totalRecipients - successCount;

  // 5. Audit / Logging
  try {
    await db.collection("sms_logs").add({
      type: type,
      tripId,
      message,
      requestedBy: actorUid || "SYSTEM",
      totalTargets: totalRecipients,
      successCount,
      failCount,
      provider: "semaphore",
      at: admin.firestore.FieldValue.serverTimestamp(),
    });
  } catch (logErr) {
    console.error("Failed to write sms_log:", logErr);
  }

  return {
    success: true,
    total: totalRecipients,
    sent: successCount,
    failed: failCount,
  };
}

/**
 * ==================================================================
 * CLOUD FUNCTION: broadcastTripMessage
 * Purpose: The API endpoint callable from the Frontend (React)
 * ==================================================================
 */
exports.broadcastTripMessage = onCall(
  {
    region: "asia-southeast1",
    // 2. PASS THE IMPORTED SECRETS HERE
    // This allows this function to access the keys needed by sendSmsViaProvider
    secrets: [SEMAPHORE_API_KEY, SEMAPHORE_SENDER_NAME],
    timeoutSeconds: 300,
    memory: "256MiB",
  },
  async (request) => {
    const actor = await assertAdminOrManager(request);
    const { tripId, message } = request.data;

    try {
      const result = await broadcastTripLogic({
        tripId,
        message,
        actorUid: actor.uid,
        type: "MANUAL_BROADCAST",
      });

      return result;
    } catch (error) {
      console.error("Broadcast Logic Failed:", error);
      throw new HttpsError("internal", error.message);
    }
  },
);

// 3. EXPORT THE LOGIC so updateTripStatus.js can use it
exports.broadcastTripLogic = broadcastTripLogic;
