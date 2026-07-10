"use strict";

const { renderShipmentStatusEmail } = require("../../vendor/email-templates");
const { CUSTOMER_NOTIFICATION_TYPES } = require("./customerNotificationTypes");
const {
  buildEmailTemplateProps,
  loadShipmentsForEmail,
} = require("./emailShipmentContext");

function shipmentCountLabel(count = 1) {
  const safeCount = Math.max(Number(count) || 1, 1);
  return safeCount === 1 ? "shipment" : `${safeCount} shipments`;
}

function buildCustomerSmsMessage(notificationType, shipmentCount = 1) {
  const count = Math.max(Number(shipmentCount) || 1, 1);
  const noun = shipmentCountLabel(count);

  const templates = {
    [CUSTOMER_NOTIFICATION_TYPES.RECEIVED_AT_DIVISORIA]: `Atlas: Your ${noun} ${count === 1 ? "was" : "were"} received at Divisoria warehouse.`,
    [CUSTOMER_NOTIFICATION_TYPES.IN_TRANSIT]: `Atlas: Your ${noun} ${count === 1 ? "is" : "are"} in transit to your area.`,
    [CUSTOMER_NOTIFICATION_TYPES.ARRIVED_AT_ODIONGAN]: `Atlas: Your ${noun} arrived at Odiongan warehouse.`,
    [CUSTOMER_NOTIFICATION_TYPES.OUT_FOR_DELIVERY]: `Atlas: Your ${noun} ${count === 1 ? "is" : "are"} out for delivery today.`,
    [CUSTOMER_NOTIFICATION_TYPES.DELIVERED]: `Atlas: Your ${noun} ${count === 1 ? "has" : "have"} been delivered. Thank you for choosing Atlas.`,
    [CUSTOMER_NOTIFICATION_TYPES.FAILED_DELIVERY]: `Atlas: Delivery attempt failed for your ${noun}. We will follow up shortly.`,
  };

  const message = templates[notificationType];
  if (!message) return null;

  if (message.length > 140) {
    return message.slice(0, 137) + "...";
  }

  return message;
}

async function buildCustomerEmailContent({
  db = null,
  notificationType,
  shipmentCount = 1,
  shipmentIds = [],
  tripId = null,
  customerName = "Customer",
  shipments = null,
  embedIcons = true,
}) {
  let resolvedShipments = Array.isArray(shipments) ? shipments : null;

  if (!resolvedShipments && db && shipmentIds.length) {
    resolvedShipments = await loadShipmentsForEmail(db, shipmentIds);
  }

  if (resolvedShipments?.length) {
    const templateProps = buildEmailTemplateProps({
      notificationType,
      customerName,
      shipmentIds,
      shipments: resolvedShipments,
      tripId,
    });

    return renderShipmentStatusEmail({
      ...templateProps,
      embedIcons,
    });
  }

  const sms = buildCustomerSmsMessage(notificationType, shipmentCount);
  const trackingLines =
    shipmentIds.length > 0
      ? `\n\nTracking numbers:\n${shipmentIds.join("\n")}`
      : "";

  return {
    subject: "Atlas Transport shipment update",
    text: `${sms || "Your shipment has been updated."}${tripId ? `\n\nTrip: ${tripId}` : ""}${trackingLines}`,
    html: `<p>${sms || "Your shipment has been updated."}</p>${
      tripId ? `<p><strong>Trip:</strong> ${tripId}</p>` : ""
    }${
      shipmentIds.length
        ? `<p><strong>Tracking numbers:</strong><br>${shipmentIds.join("<br>")}</p>`
        : ""
    }`,
  };
}

function buildCustomerPushBody(notificationType, shipmentCount = 1, shipmentIds = []) {
  const sms = buildCustomerSmsMessage(notificationType, shipmentCount);
  if (!sms) return "Your shipment has been updated.";

  if (shipmentIds.length <= 1) return sms;

  return `${sms} Tracking: ${shipmentIds.slice(0, 3).join(", ")}${
    shipmentIds.length > 3 ? "..." : ""
  }`;
}

function formatNotificationTypeLabel(notificationType = "") {
  return String(notificationType || "")
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

module.exports = {
  buildCustomerEmailContent,
  buildCustomerPushBody,
  buildCustomerSmsMessage,
  formatNotificationTypeLabel,
};
