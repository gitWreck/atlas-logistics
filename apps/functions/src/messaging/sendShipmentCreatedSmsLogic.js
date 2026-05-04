"use strict";

const admin = require("firebase-admin");
const { sendSmsViaProvider } = require("../../shared/sms-service");
const { calculateSmsCost } = require("../../shared/sms-cost");
const { writeMessagingActionLog } = require("./messagingLogger");

function normalizePhone(phone) {
  if (!phone) return null;

  let p = String(phone).replace(/[^\d]/g, "");
  if (p.startsWith("09")) p = "63" + p.slice(1);

  return p.startsWith("63") && p.length === 12 ? p : null;
}

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
  customMessage = "",
}) {
  const db = admin.firestore();

  const phones = new Set(
    [normalizePhone(senderPhone), normalizePhone(recipientPhone)].filter(
      Boolean,
    ),
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
    requestedBy: actorUid || "SYSTEM",
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
exports.normalizePhone = normalizePhone;
