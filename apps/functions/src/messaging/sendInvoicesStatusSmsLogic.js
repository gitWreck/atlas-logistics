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

function resolveInvoiceNotificationType(status = "") {
  const normalized = String(status || "").toUpperCase();
  if (normalized === "ISSUED") {
    return CUSTOMER_NOTIFICATION_TYPES.INVOICE_ISSUED;
  }
  if (normalized === "PAID") {
    return CUSTOMER_NOTIFICATION_TYPES.INVOICE_PAID;
  }
  if (normalized === "CANCELLED") {
    return CUSTOMER_NOTIFICATION_TYPES.INVOICE_CANCELLED;
  }
  return `${CUSTOMER_NOTIFICATION_TYPES.MANUAL_BROADCAST}_INVOICE_${normalized}`;
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
      ? ` (${origin || "Unknown"} to ${destination || "Unknown"})`
      : "";

  switch (String(status || "").toUpperCase()) {
    case "ISSUED":
      return `Atlas: Invoice ${invoiceId} has been issued${routeText}.`;
    case "PAID":
      return `Atlas: Invoice ${invoiceId} is paid. Thank you.`;
    case "CANCELLED":
      return `Atlas: Invoice ${invoiceId} has been cancelled.`;
    default:
      return `Atlas: Invoice ${invoiceId} status is now ${status}.`;
  }
}

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

  const message = buildInvoiceStatusMessage({
    invoiceId,
    shipmentId,
    status,
    billingName,
    origin,
    destination,
    customMessage,
  });

  const phones = new Set(
    [
      requireNormalizedPhone(senderPhone),
      requireNormalizedPhone(recipientPhone),
    ].filter(Boolean),
  );

  if (phones.size === 0) {
    return { success: false, reason: "No valid phones" };
  }

  const { credits } = calculateSmsCost(message);
  const notificationType = `${resolveInvoiceNotificationType(status)}_${invoiceId}`;

  const results = await Promise.all(
    Array.from(phones).map((phone) =>
      sendDirectCustomerNotification({
        db,
        phone,
        tripId: NO_TRIP_SCOPE,
        shipmentId: shipmentId || null,
        notificationType,
        channels: { sms: true, email: false, push: false },
        customSmsMessage: message,
        actor: {
          uid: actorUid || "SYSTEM",
          name: actorName || null,
          role: actorRole || null,
        },
        source: "INVOICE_STATUS",
      }),
    ),
  );

  const successCount = results.reduce(
    (sum, result) => sum + (result.sent || 0),
    0,
  );
  const failedCount = phones.size - successCount;

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

module.exports = {
  sendInvoicesStatusSmsLogic,
  buildInvoiceStatusMessage,
  normalizePhone: requireNormalizedPhone,
};
