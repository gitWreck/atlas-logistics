"use strict";

const { formatStatus } = require("../utilities/helpers");
const { getShipmentTrackingId } = require("../utilities/notificationHelpers");
const {
  computePackageBreakdown,
  PACKAGE_STATUS_LABELS,
  normalizePackageStatus,
} = require("../packages/packageStatus");

const TRACKING_BASE_URL =
  process.env.ATLAS_PUBLIC_URL || "https://atlastransport.ph";

const SUPPORT_EMAIL = "support@atlastransport.ph";
const LOGO_URL = `${TRACKING_BASE_URL}/atlas-logo-white.png`;

const NOTIFICATION_SUMMARY = Object.freeze({
  RECEIVED_AT_DIVISORIA: {
    headline: (shipmentId) => `Your shipment was received at our warehouse`,
    subtext: () => "We will notify you when it moves to the next stage.",
  },
  IN_TRANSIT: {
    headline: () => "Your shipment is in transit",
    subtext: () => "It is on the way to your destination area.",
  },
  ARRIVED_AT_ODIONGAN: {
    headline: () => "Your shipment arrived at the destination hub",
    subtext: () => "It will be prepared for local delivery soon.",
  },
  OUT_FOR_DELIVERY: {
    headline: () => "Your shipment is out for delivery",
    subtext: () => "Please ensure someone is available to receive it.",
  },
  DELIVERED: {
    headline: () => "Your shipment has been delivered",
    subtext: () => "Thank you for choosing Atlas Transportation.",
  },
  FAILED_DELIVERY: {
    headline: () => "Delivery attempt was unsuccessful",
    subtext: () => "Our team will follow up with you shortly.",
  },
});

function formatEmailDate(value) {
  if (!value) return "";

  let date = null;
  if (value?.toDate) {
    date = value.toDate();
  } else if (value?.seconds) {
    date = new Date(value.seconds * 1000);
  } else if (value instanceof Date) {
    date = value;
  } else if (typeof value === "string" || typeof value === "number") {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) date = parsed;
  }

  if (!date) return "";

  return date.toLocaleString("en-PH", {
    timeZone: "Asia/Manila",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "shortOffset",
  });
}

function resolvePackageStatusLabel(pkg = {}) {
  const status = normalizePackageStatus(pkg);
  if (PACKAGE_STATUS_LABELS[status]) return PACKAGE_STATUS_LABELS[status];
  return formatStatus(status);
}

function mapPackageRow(pkg = {}, index = 0) {
  const status = normalizePackageStatus(pkg);
  return {
    index: pkg.sequence || index + 1,
    description: String(pkg.description || pkg.itemDescription || "Package").trim(),
    packagingType: String(pkg.packagingType || "Package").trim(),
    quantity: Number(pkg.quantity) > 0 ? Number(pkg.quantity) : null,
    trackingNumber: String(
      pkg.packageId || pkg.trackingNumber || `PKG-${index + 1}`,
    ).trim(),
    statusLabel: resolvePackageStatusLabel(pkg),
    statusCode: status,
    lastUpdated: formatEmailDate(
      pkg.updatedAt || pkg.statusUpdatedAt || pkg.deliveredAt,
    ),
  };
}

function buildRouteLabel(shipment = {}) {
  const origin =
    shipment.originCity ||
    shipment.origin ||
    shipment.sender?.address?.city ||
    "Origin";
  const destination =
    shipment.destinationCity ||
    shipment.destination ||
    shipment.recipient?.address?.city ||
    "Destination";
  return `${origin} → ${destination}`;
}

function buildOriginLabel(shipment = {}) {
  return (
    shipment.originWarehouseName ||
    shipment.originHub ||
    shipment.originCity ||
    shipment.origin ||
    null
  );
}

function buildDestinationLabel(shipment = {}) {
  return (
    shipment.destinationWarehouseName ||
    shipment.destinationHub ||
    shipment.destinationCity ||
    shipment.destination ||
    null
  );
}

function buildSummaryFromBreakdown(breakdown = {}, statusCode = "") {
  const total = Number(breakdown.total) || 0;
  const delivered = Number(breakdown.delivered) || 0;
  const outForDelivery = Number(breakdown.outForDelivery) || 0;
  const normalizedStatus = String(statusCode || "").toUpperCase();

  if (normalizedStatus === "PARTIALLY_DELIVERED" && total > 0) {
    return {
      headline: `${delivered} of ${total} packages delivered`,
      subtext:
        outForDelivery > 0
          ? `Your remaining package${outForDelivery === 1 ? "" : "s"} ${outForDelivery === 1 ? "is" : "are"} out for delivery.`
          : "Some packages are still being processed for delivery.",
      deliveredCount: delivered,
      outForDeliveryCount: outForDelivery,
      totalPackages: total,
    };
  }

  if (normalizedStatus === "DELIVERED" || normalizedStatus === "COMPLETED") {
    return {
      headline:
        total > 0
          ? `All ${total} package${total === 1 ? "" : "s"} delivered`
          : "Your shipment has been delivered",
      subtext: "Thank you for choosing Atlas Transportation.",
      deliveredCount: delivered || total,
      outForDeliveryCount: 0,
      totalPackages: total,
    };
  }

  if (normalizedStatus === "OUT_FOR_DELIVERY") {
    return {
      headline:
        outForDelivery > 0
          ? `${outForDelivery} package${outForDelivery === 1 ? "" : "s"} out for delivery`
          : "Your shipment is out for delivery",
      subtext: "Please ensure someone is available to receive it.",
      deliveredCount: delivered,
      outForDeliveryCount: outForDelivery || total,
      totalPackages: total,
    };
  }

  return {
    headline: null,
    subtext: null,
    deliveredCount: delivered,
    outForDeliveryCount: outForDelivery,
    totalPackages: total,
  };
}

function buildNotificationSummary(notificationType, shipment = {}) {
  const statusCode = String(shipment.status || "").toUpperCase();
  const packages = Array.isArray(shipment.packages) ? shipment.packages : [];
  const breakdown =
    shipment.packageBreakdown &&
    typeof shipment.packageBreakdown === "object"
      ? shipment.packageBreakdown
      : computePackageBreakdown(packages);

  const fromBreakdown = buildSummaryFromBreakdown(breakdown, statusCode);
  if (fromBreakdown.headline) return fromBreakdown;

  const template = NOTIFICATION_SUMMARY[notificationType];
  if (!template) return fromBreakdown;

  return {
    ...fromBreakdown,
    headline: template.headline(getShipmentTrackingId(shipment, shipment.id)),
    subtext: template.subtext(),
  };
}

async function loadShipmentsForEmail(db, shipmentIds = []) {
  if (!db || !Array.isArray(shipmentIds) || !shipmentIds.length) return [];

  const snaps = await Promise.all(
    shipmentIds.map((id) => db.collection("shipments").doc(String(id)).get()),
  );

  return snaps
    .filter((snap) => snap.exists)
    .map((snap) => ({ id: snap.id, ...snap.data() }));
}

function buildEmailTemplateProps({
  notificationType,
  customerName = "Customer",
  shipmentIds = [],
  shipments = [],
  tripId = null,
}) {
  const isMultiShipment = shipments.length > 1 || shipmentIds.length > 1;
  const primaryShipment = shipments[0] || {};
  const trackingId = getShipmentTrackingId(
    primaryShipment,
    primaryShipment.id || shipmentIds[0] || "",
  );
  const statusCode = String(
    primaryShipment.status || notificationType || "IN_TRANSIT",
  ).toUpperCase();
  const statusLabel = formatStatus(statusCode);
  const summary = buildNotificationSummary(notificationType, primaryShipment);
  const packages = (
    Array.isArray(primaryShipment.packages) ? primaryShipment.packages : []
  ).map(mapPackageRow);

  return {
    customerName,
    statusLabel,
    statusCode,
    shipmentId: trackingId,
    routeLabel: buildRouteLabel(primaryShipment),
    originLabel: buildOriginLabel(primaryShipment),
    destinationLabel: buildDestinationLabel(primaryShipment),
    lastUpdated: formatEmailDate(
      primaryShipment.updatedAt || primaryShipment.statusUpdatedAt,
    ),
    summaryHeadline: summary.headline,
    summarySubtext: summary.subtext,
    deliveredCount: summary.deliveredCount,
    outForDeliveryCount: summary.outForDeliveryCount,
    totalPackages: summary.totalPackages,
    packages,
    trackingUrl: `${TRACKING_BASE_URL}/track/${encodeURIComponent(trackingId)}`,
    supportEmail: SUPPORT_EMAIL,
    logoUrl: LOGO_URL,
    isMultiShipment,
    shipmentIds: shipmentIds.map((id) =>
      getShipmentTrackingId(
        shipments.find((entry) => entry.id === id) || {},
        id,
      ),
    ),
    tripId,
  };
}

module.exports = {
  TRACKING_BASE_URL,
  buildEmailTemplateProps,
  formatEmailDate,
  loadShipmentsForEmail,
  mapPackageRow,
};
