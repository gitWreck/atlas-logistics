"use strict";

const { HttpsError } = require("firebase-functions/v2/https");

/** Terminal / closed statuses — not eligible for warehouse release to checker. */
const RELEASE_BLOCKED_STATUSES = new Set([
  "DELIVERED",
  "COMPLETED",
  "CANCELLED",
]);

function normalizeStatus(status) {
  return String(status || "").trim().toUpperCase();
}

function isEligibleForCheckerRelease(status) {
  return !RELEASE_BLOCKED_STATUSES.has(normalizeStatus(status));
}

function assertEligibleForCheckerRelease(shipmentId, status) {
  const normalized = normalizeStatus(status);
  if (!RELEASE_BLOCKED_STATUSES.has(normalized)) return;

  throw new HttpsError(
    "failed-precondition",
    `Shipment ${shipmentId} cannot be released to a checker (status: ${normalized}). Only active warehouse shipments are eligible.`,
  );
}

module.exports = {
  RELEASE_BLOCKED_STATUSES,
  normalizeStatus,
  isEligibleForCheckerRelease,
  assertEligibleForCheckerRelease,
};
