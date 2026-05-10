"use strict";

const admin = require("firebase-admin");
const { sendSmsViaProvider } = require("../../shared/sms-service");
const { calculateSmsCost } = require("../../shared/sms-cost");
const { writeMessagingActionLog } = require("../utilities/messagingLogger");

function normalizePhone(phone) {
  if (!phone) return null;

  let p = String(phone).replace(/[^\d]/g, "");
  if (p.startsWith("09")) p = "63" + p.slice(1);

  return p.startsWith("63") && p.length === 12 ? p : null;
}

function buildInvoiceStatusMessage({
  invoiceId,
  shipmentId,
  status,
  billingName,
  origin,
  destination,
  customMessage,
}) {
  if (customMessage && String(customMessage).trim()) {
    return String(customMessage).trim();
  }

  const routeText =
    origin || destination
      ? ` for shipment ${shipmentId} (${origin || "Unknown"} to ${destination || "Unknown"})`
      : shipmentId
        ? ` for shipment ${shipmentId}`
        : "";

  switch (status) {
    case "ISSUED":
      return `ATLAS: Invoice ${invoiceId}${routeText} has been ISSUED.${billingName ? ` Bill To: ${billingName}.` : ""}`;

    case "PAID":
      return `ATLAS: Invoice ${invoiceId}${routeText} has been marked as PAID. Thank you.${billingName ? ` Bill To: ${billingName}.` : ""}`;

    case "CANCELLED":
      return `ATLAS: Invoice ${invoiceId}${routeText} has been CANCELLED.${billingName ? ` Bill To: ${billingName}.` : ""}`;

    default:
      return `ATLAS: Invoice ${invoiceId}${routeText} has been updated to ${status}.${billingName ? ` Bill To: ${billingName}.` : ""}`;
  }
}

/**
 * Send invoice status SMS to sender and recipient.
 */
async function sendInvoicesStatusSmsLogic({
  invoiceId,
  shipmentId,
  senderPhone,
  recipientPhone,
  status,
  billingName,
  origin,
  destination,
  actorUid,
  actorName,
  actorRole,
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

  const message = buildInvoiceStatusMessage({
    invoiceId,
    shipmentId,
    status,
    billingName,
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
    type: "INVOICE_STATUS_UPDATED",
    invoiceId,
    shipmentId: shipmentId || null,
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

exports.sendInvoicesStatusSmsLogic = sendInvoicesStatusSmsLogic;
exports.buildInvoiceStatusMessage = buildInvoiceStatusMessage;
exports.normalizePhone = normalizePhone;
