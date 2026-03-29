"use strict";

const admin = require("firebase-admin");
const { sendSmsViaProvider } = require("../../shared/sms-service");
const { calculateSmsCost } = require("../../shared/sms-cost");

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
  Tracking link: https://atlas-trucking-platform.vercel.app/track/${shipmentId}`;

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

  await db.collection("sms_logs").add({
    type: "SHIPMENT_CREATED",
    shipmentId,
    message,
    requestedBy: actorUid || "SYSTEM",
    totalTargets: phones.size,
    successCount,
    creditsPerMsg: credits,
    at: admin.firestore.FieldValue.serverTimestamp(),
  });

  return { success: true, sent: successCount };
}

exports.sendShipmentPickup = sendShipmentPickup;
