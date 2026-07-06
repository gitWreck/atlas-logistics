"use strict";

/** Customer-facing notification types (dedup + messaging). */
const CUSTOMER_NOTIFICATION_TYPES = Object.freeze({
  RECEIVED_AT_DIVISORIA: "RECEIVED_AT_DIVISORIA",
  IN_TRANSIT: "IN_TRANSIT",
  ARRIVED_AT_ODIONGAN: "ARRIVED_AT_ODIONGAN",
  OUT_FOR_DELIVERY: "OUT_FOR_DELIVERY",
  DELIVERED: "DELIVERED",
  FAILED_DELIVERY: "FAILED_DELIVERY",
  TRIP_DELAY: "TRIP_DELAY",
  TRIP_SCHEDULE_UPDATE: "TRIP_SCHEDULE_UPDATE",
  MANUAL_BROADCAST: "MANUAL_BROADCAST",
  PICKUP_REQUESTED: "PICKUP_REQUESTED",
  INVOICE_ISSUED: "INVOICE_ISSUED",
  INVOICE_PAID: "INVOICE_PAID",
  INVOICE_CANCELLED: "INVOICE_CANCELLED",
});

const INTERNAL_TRIP_STATUSES = new Set([
  "CREATED",
  "ASSIGNED",
  "LOADING",
  "LOADED",
  "RECEIVING_IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
]);

const INTERNAL_SHIPMENT_STATUSES = new Set([
  "CREATED",
  "PENDING_PICKUP",
  "PICKED_UP",
  "ASSIGNED",
  "PARTIALLY_LOADED",
  "PARTIALLY_RECEIVED",
  "LOADED",
  "LOADED_ON_TRUCK",
  "PARTIALLY_IN_TRANSIT",
  "PARTIALLY_ARRIVED",
  "PARTIALLY_AVAILABLE_FOR_DELIVERY",
  "AVAILABLE_FOR_DELIVERY",
  "READY_FOR_DELIVERY",
  "PARTIALLY_OUT_FOR_DELIVERY",
  "PARTIALLY_DELIVERED",
  "UNLOAD",
  "MISSING",
  "DAMAGED",
  "CANCELLED",
]);

const TRIP_STATUS_TO_NOTIFICATION = Object.freeze({
  IN_TRANSIT: CUSTOMER_NOTIFICATION_TYPES.IN_TRANSIT,
  ARRIVED: CUSTOMER_NOTIFICATION_TYPES.ARRIVED_AT_ODIONGAN,
  OUT_FOR_DELIVERY: CUSTOMER_NOTIFICATION_TYPES.OUT_FOR_DELIVERY,
});

const SHIPMENT_STATUS_TO_NOTIFICATION = Object.freeze({
  RECEIVED: CUSTOMER_NOTIFICATION_TYPES.RECEIVED_AT_DIVISORIA,
  IN_TRANSIT: CUSTOMER_NOTIFICATION_TYPES.IN_TRANSIT,
  ARRIVED: CUSTOMER_NOTIFICATION_TYPES.ARRIVED_AT_ODIONGAN,
  OUT_FOR_DELIVERY: CUSTOMER_NOTIFICATION_TYPES.OUT_FOR_DELIVERY,
  DELIVERED: CUSTOMER_NOTIFICATION_TYPES.DELIVERED,
  COMPLETED: CUSTOMER_NOTIFICATION_TYPES.DELIVERED,
  FAILED_DELIVERY: CUSTOMER_NOTIFICATION_TYPES.FAILED_DELIVERY,
});

const BLOCKED_NOTIFICATION_SOURCES = new Set([
  "RECONCILIATION",
  "SCAN_FOUND",
  "RECONCILE_CORRECTION",
  "ADMIN_OVERRIDE_RELEASE",
  "MANIFEST_UNLOCK",
  "MANIFEST_LOCK",
  "MANIFEST_CORRECTION",
  "PACKAGE_RECOVERY",
  "PACKAGE_RELOCATION",
  "TRIP_REOPEN",
  "AMENDMENT_SESSION",
  "UPDATE_SHIPMENT_PACKAGES",
  "SCANNER",
]);

function normalizeStatus(value = "") {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "_");
}

function isPartialStatus(status = "") {
  return normalizeStatus(status).startsWith("PARTIALLY_");
}

function isTransitLikeStatus(status = "") {
  const normalized = normalizeStatus(status);
  return normalized === "IN_TRANSIT" || normalized === "PARTIALLY_IN_TRANSIT";
}

function isArrivedAtOdionganLikeStatus(status = "") {
  const normalized = normalizeStatus(status);
  return normalized === "ARRIVED" || normalized === "PARTIALLY_ARRIVED";
}

function resolveTripCustomerNotificationType(newStatus = "") {
  const normalized = normalizeStatus(newStatus);
  if (!normalized || INTERNAL_TRIP_STATUSES.has(normalized)) return null;
  return TRIP_STATUS_TO_NOTIFICATION[normalized] || null;
}

function resolveShipmentCustomerNotificationType(oldStatus = "", newStatus = "") {
  const next = normalizeStatus(newStatus);
  const prev = normalizeStatus(oldStatus);

  if (!next || next === prev) return null;

  if (
    next === "PARTIALLY_IN_TRANSIT" &&
    !isTransitLikeStatus(prev)
  ) {
    return CUSTOMER_NOTIFICATION_TYPES.IN_TRANSIT;
  }

  if (
    next === "PARTIALLY_ARRIVED" &&
    !isArrivedAtOdionganLikeStatus(prev)
  ) {
    return CUSTOMER_NOTIFICATION_TYPES.ARRIVED_AT_ODIONGAN;
  }

  if (INTERNAL_SHIPMENT_STATUSES.has(next) || isPartialStatus(next)) {
    return null;
  }

  return SHIPMENT_STATUS_TO_NOTIFICATION[next] || null;
}

function shouldBlockCustomerNotification({
  notify = false,
  source = "",
  promotionSource = "",
} = {}) {
  if (notify !== true) return true;

  const sourceKey = normalizeStatus(source);
  const promotionKey = normalizeStatus(promotionSource);

  if (BLOCKED_NOTIFICATION_SOURCES.has(sourceKey)) return true;
  if (promotionKey === "RECONCILIATION") return true;

  return false;
}

module.exports = {
  BLOCKED_NOTIFICATION_SOURCES,
  CUSTOMER_NOTIFICATION_TYPES,
  INTERNAL_SHIPMENT_STATUSES,
  INTERNAL_TRIP_STATUSES,
  isPartialStatus,
  isArrivedAtOdionganLikeStatus,
  isTransitLikeStatus,
  normalizeStatus,
  resolveShipmentCustomerNotificationType,
  resolveTripCustomerNotificationType,
  shouldBlockCustomerNotification,
};
