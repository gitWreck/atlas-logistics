"use strict";

const admin = require("firebase-admin");
const { sendSmsViaProvider } = require("../../shared/sms-service");
const { calculateSmsCost } = require("../../shared/sms-cost");
const { writeMessagingActionLog } = require("../utilities/messagingLogger");
const { requireNormalizedPhone } = require("../utilities/phoneHelpers");

function buildShipmentCreatedMessage({
  shipmentId,
  status = "RECEIVED",
  origin,
  destination,
  customMessage,
}) {
  if (customMessage && String(customMessage).trim()) {
    return String(customMessage).trim();
  }

  const routeText =
    origin || destination
      ? ` from ${origin || "Unknown"} to ${destination || "Unknown"}`
      : "";

  return `ATLAS: Shipment ${shipmentId}${routeText} has been ${status}. Tracking link: https://atlastransport.ph/track/${shipmentId}`;
}

/**
 * Send shipment-created SMS to sender and recipient.
 */
async function sendShipmentCreatedSmsLogic({
  shipmentId,
  senderPhone,
  recipientPhone,
  status = "RECEIVED",
  origin,
  destination,
  actorUid,
  actorName,
  actorRole,
  customMessage = "",
}) {
  const db = admin.firestore();

  const phones = new Set(
    [
      requireNormalizedPhone(senderPhone),
      requireNormalizedPhone(recipientPhone),
    ].filter(Boolean),
  );

  if (phones.size === 0) {
    return { success: false, reason: "No valid phones" };
  }

  const message = buildShipmentCreatedMessage({
    shipmentId,
    status,
    origin,
    destination,
    customMessage,
  });

  const { credits } = calculateSmsCost(message);

  const results = await Promise.allSettled(
    Array.from(phones).map(async (phone) => {
      await sendSmsViaProvider({ phone, message });
      return phone;
    }),
  );

  const successCount = results.filter((r) => r.status === "fulfilled").length;
  const failedCount = results.length - successCount;

  await writeMessagingActionLog({
    db,
    type: `SHIPMENT_${status}`,
    shipmentId,
    status,
    message,
    actorId: actorUid || "SYSTEM",
    actorName: actorName || null,
    actorRole: actorRole || null,
    requestedBy: actorName || "SYSTEM",
    totalTargets: phones.size,
    successCount,
    failedCount,
    creditsPerMsg: credits,
    at: admin.firestore.FieldValue.serverTimestamp(),
  });

  return {
    success: true,
    sent: successCount,
    failed: failedCount,
    totalTargets: phones.size,
  };
}

exports.sendShipmentCreatedSmsLogic = sendShipmentCreatedSmsLogic;
exports.buildShipmentCreatedMessage = buildShipmentCreatedMessage;
exports.normalizePhone = requireNormalizedPhone;
