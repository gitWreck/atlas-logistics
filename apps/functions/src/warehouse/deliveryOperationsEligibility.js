"use strict";

const { HttpsError } = require("firebase-functions/v2/https");

const DELIVERY_RELEASE_BLOCKED_STATUSES = new Set([
  "DELIVERED",
  "COMPLETED",
  "CANCELLED",
]);

const DELIVERY_RELEASE_PREFERRED_STATUSES = new Set([
  "RECONCILED",
  "ARRIVED",
  "UNLOADED",
  "RECEIVED",
  "RETURNED_RECEIVED_AT_HUB",
  "AVAILABLE_FOR_DELIVERY",
]);

function normalizeStatus(status) {
  return String(status || "").trim().toUpperCase();
}

function isEligibleForDeliveryOperationsRelease(status) {
  const normalized = normalizeStatus(status);
  if (DELIVERY_RELEASE_BLOCKED_STATUSES.has(normalized)) return false;
  return true;
}

function assertEligibleForDeliveryOperationsRelease(shipmentId, status) {
  const normalized = normalizeStatus(status);
  if (!DELIVERY_RELEASE_BLOCKED_STATUSES.has(normalized)) return;

  throw new HttpsError(
    "failed-precondition",
    `Shipment ${shipmentId} cannot be released for delivery operations (status: ${normalized}).`,
  );
}

module.exports = {
  DELIVERY_RELEASE_BLOCKED_STATUSES,
  DELIVERY_RELEASE_PREFERRED_STATUSES,
  normalizeStatus,
  isEligibleForDeliveryOperationsRelease,
  assertEligibleForDeliveryOperationsRelease,
};
