"use strict";

const crypto = require("crypto");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const { assertAdminOrManager } = require("../system/authGuards");
const { writeMessagingActionLog } = require("../utilities/messagingLogger");
const {
  SEMAPHORE_API_KEY,
  SEMAPHORE_SENDER_NAME,
} = require("../../shared/sms-service");
const {
  CUSTOMER_NOTIFICATION_TYPES,
  sendTripCustomerNotifications,
} = require("../notifications/customerNotificationService");
const { canAccessRecord } = require("../manager/managerAccess");

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

/**
 * Broadcast SMS to trip customers with deduplication.
 * Manual broadcasts use a message-hash suffix so identical blasts are deduped.
 */
async function broadcastTripLogic({
  tripId,
  message,
  actorUid,
  type = "BROADCAST",
  actorName = null,
  actorRole = null,
  notificationType = null,
  channels = { sms: true, email: false, push: false },
}) {
  if (!tripId || !message) {
    throw new Error("Missing tripId or message for broadcast.");
  }

  const db = admin.firestore();
  const resolvedType =
    notificationType ||
    `${CUSTOMER_NOTIFICATION_TYPES.MANUAL_BROADCAST}_${crypto
      .createHash("sha1")
      .update(String(message))
      .digest("hex")
      .slice(0, 10)}`;

  const result = await sendTripCustomerNotifications({
    db,
    tripId,
    notificationType: resolvedType,
    channels,
    customSmsMessage: String(message).trim(),
    customEmail: {
      subject: "Atlas Transport update",
      text: String(message).trim(),
      html: `<p>${String(message).trim()}</p>`,
    },
    customPush: String(message).trim(),
    actor: {
      uid: actorUid || "SYSTEM",
      name: actorName || "SYSTEM",
      role: actorRole || "SYSTEM",
    },
    source: type,
  });

  const sent =
    result.results?.reduce(
      (sum, entry) =>
        sum +
        (entry.channelResults || []).filter((row) => row.sent === true).length,
      0,
    ) || result.sent || 0;

  try {
    await writeMessagingActionLog({
      db,
      type,
      tripId,
      message,
      actorId: actorUid || "SYSTEM",
      actorName: actorName || null,
      actorRole: actorRole || null,
      requestedBy: actorName || "SYSTEM",
      totalTargets: result.customers || 0,
      successCount: sent,
      failCount: Math.max((result.customers || 0) - sent, 0),
      provider: "semaphore",
      at: admin.firestore.FieldValue.serverTimestamp(),
    });
  } catch (logErr) {
    console.error("Failed to write sms_log:", logErr);
  }

  return {
    success: true,
    total: result.customers || 0,
    sent,
    failed: Math.max((result.customers || 0) - sent, 0),
    deduped: result,
  };
}

exports.broadcastTripMessage = onCall(
  {
    region: "asia-southeast1",
    maxInstances: 10,
    secrets: [SEMAPHORE_API_KEY, SEMAPHORE_SENDER_NAME],
    timeoutSeconds: 300,
    memory: "256MiB",
  },
  async (request) => {
    const actor = await assertAdminOrManager(request);
    const { tripId, message } = request.data;

    try {
      const tripSnap = await db.collection("truck_trips").doc(String(tripId || "")).get();
      if (!tripSnap.exists) {
        throw new HttpsError("not-found", "Trip not found.");
      }
      if (
        actor.role === "manager" &&
        !canAccessRecord(actor.user, tripSnap.data() || {})
      ) {
        throw new HttpsError(
          "permission-denied",
          "This trip is outside your assigned warehouse or municipality.",
        );
      }
      return await broadcastTripLogic({
        tripId,
        message,
        actorUid: actor.uid,
        actorName: actor.name,
        actorRole: actor.role,
        type: "MANUAL_BROADCAST",
      });
    } catch (error) {
      console.error("Broadcast Logic Failed:", error);
      if (error instanceof HttpsError) throw error;
      throw new HttpsError("internal", error.message);
    }
  },
);

exports.broadcastTripLogic = broadcastTripLogic;
