"use strict";

const admin = require("firebase-admin");
const { sendSmsViaProvider } = require("../../../shared/sms-service");
const { calculateSmsCost } = require("../../../shared/sms-cost");

/**
 * sendShipmentCreatedSmsLogic
 * Purpose: Send "Received" SMS to both Sender and Recipient upon creation.
 */
async function sendShipmentCreatedSmsLogic({
  shipmentId,
  senderPhone,
  recipientPhone,
  origin,
  destination,
  actorUid,
}) {
  const db = admin.firestore();

  // 1. Normalize & Deduplicate numbers
  //   const normalize = (phone) => {
  //     if (!phone) return null;
  //     let p = String(phone).replace(/[^\d]/g, "");
  //     if (p.startsWith("09")) p = "63" + p.slice(1);
  //     return p.startsWith("63") && p.length === 12 ? p : null;
  //   };

  const phones = new Set([senderPhone, recipientPhone].filter(Boolean));
  if (phones.size === 0) return { success: false, reason: "No valid phones" };

  const message = `ATLAS: Shipment ${shipmentId} from ${origin} to ${destination} has been RECEIVED. 
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

exports.sendShipmentCreatedSmsLogic = sendShipmentCreatedSmsLogic;
