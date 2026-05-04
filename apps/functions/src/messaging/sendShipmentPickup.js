"use strict";

const admin = require("firebase-admin");
const { sendSmsViaProvider } = require("../../shared/sms-service");
const { calculateSmsCost } = require("../../shared/sms-cost");
const { writeMessagingActionLog } = require("./messagingLogger");

async function sendShipmentPickup({
  shipmentId,
  senderPhone,
  recipientPhone,
  actorUid,
}) {
  const db = admin.firestore();

  const phones = new Set([senderPhone, recipientPhone].filter(Boolean));
  if (phones.size === 0) return { success: false, reason: "No valid phones" };

  const message = `ATLAS: Shipment ${shipmentId} has been CREATED. Waiting for pickup. 
  Tracking link: https://atlastransport.ph/track/${shipmentId}`;

  const { credits } = calculateSmsCost(message);

  // 2. Send in Parallel
  const results = await Promise.allSettled(
    Array.from(phones).map(async (phone) => {
      await sendSmsViaProvider({ phone, message });
      return phone;
    }),
  );

  // 3. Log the Batch
  const successCount = results.filter((r) => r.status === "fulfilled").length;

  await writeMessagingActionLog({
    db,
    type: "SHIPMENT_CREATED",
    shipmentId,
    message,
    actorId: actorUid || "SYSTEM",
    requestedBy: actorUid || "SYSTEM",
    totalTargets: phones.size,
    successCount,
    creditsPerMsg: credits,
    at: admin.firestore.FieldValue.serverTimestamp(),
  });

  return { success: true, sent: successCount };
}

exports.sendShipmentPickup = sendShipmentPickup;
