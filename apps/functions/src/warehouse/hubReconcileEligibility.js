"use strict";

const { HttpsError } = require("firebase-functions/v2/https");

const RECONCILE_BLOCKED_STATUSES = new Set([
  "DELIVERED",
  "COMPLETED",
  "CANCELLED",
]);

function normalizeStatus(status) {
  return String(status || "").trim().toUpperCase();
}

function getExpectedPieceCount(shipmentData = {}) {
  const packages = Array.isArray(shipmentData.packages)
    ? shipmentData.packages
    : [];

  if (packages.length) {
    return packages.reduce(
      (sum, pkg) => sum + Math.max(Number(pkg.quantity) || 1, 0),
      0,
    );
  }

  const fallback =
    shipmentData.totalItems ??
    shipmentData.packageCount ??
    shipmentData.totals?.totalItems ??
    (Array.isArray(shipmentData.packageBarcodes)
      ? shipmentData.packageBarcodes.length
      : 0);

  return Math.max(Number(fallback) || 0, 0);
}

function isEligibleForHubReconcile(status) {
  return !RECONCILE_BLOCKED_STATUSES.has(normalizeStatus(status));
}

function assertEligibleForHubReconcile(shipmentId, status) {
  const normalized = normalizeStatus(status);
  if (!RECONCILE_BLOCKED_STATUSES.has(normalized)) return;

  throw new HttpsError(
    "failed-precondition",
    `Shipment ${shipmentId} cannot be reconciled (status: ${normalized}).`,
  );
}

module.exports = {
  RECONCILE_BLOCKED_STATUSES,
  normalizeStatus,
  getExpectedPieceCount,
  isEligibleForHubReconcile,
  assertEligibleForHubReconcile,
};
