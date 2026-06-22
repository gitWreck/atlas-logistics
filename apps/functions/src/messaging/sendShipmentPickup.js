"use strict";

const admin = require("firebase-admin");
const { calculateSmsCost } = require("../../shared/sms-cost");
const { writeMessagingActionLog } = require("../utilities/messagingLogger");
const { requireNormalizedPhone } = require("../utilities/phoneHelpers");
const {
  CUSTOMER_NOTIFICATION_TYPES,
  NO_TRIP_SCOPE,
  sendDirectCustomerNotification,
} = require("../notifications/customerNotificationService");

function buildPickupSmsMessage(shipmentId) {
  const message = `Atlas: Pickup request received for your shipment. We will update you when it is collected.`;
  if (message.length > 140) {
    return message.slice(0, 137) + "...";
  }
  return message;
}

async function sendShipmentPickup({
  shipmentId,
  senderPhone,
  recipientPhone,
  actorUid,
}) {
  const db = admin.firestore();
  const message = buildPickupSmsMessage(shipmentId);
  const { credits } = calculateSmsCost(message);

  const targets = [
    { phone: requireNormalizedPhone(senderPhone), label: "sender" },
    { phone: requireNormalizedPhone(recipientPhone), label: "recipient" },
  ].filter((entry) => entry.phone);

  if (!targets.length) {
    return { success: false, reason: "No valid phones" };
  }

  const results = await Promise.all(
    targets.map((target) =>
      sendDirectCustomerNotification({
        db,
        phone: target.phone,
        tripId: NO_TRIP_SCOPE,
        shipmentId,
        notificationType: CUSTOMER_NOTIFICATION_TYPES.PICKUP_REQUESTED,
        channels: { sms: true, email: false, push: false },
        customSmsMessage: message,
        actor: { uid: actorUid || "SYSTEM" },
        source: "PICKUP_REQUEST",
      }),
    ),
  );

  const sent = results.reduce((sum, result) => sum + (result.sent || 0), 0);

  await writeMessagingActionLog({
    db,
    type: "PICKUP_REQUESTED",
    shipmentId,
    message,
    actorId: actorUid || "SYSTEM",
    requestedBy: actorUid || "SYSTEM",
    totalTargets: targets.length,
    successCount: sent,
    failCount: Math.max(targets.length - sent, 0),
    creditsPerMsg: credits,
    at: admin.firestore.FieldValue.serverTimestamp(),
  });

  return { success: true, sent };
}

module.exports = { sendShipmentPickup, buildPickupSmsMessage };
