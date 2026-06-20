"use strict";

const { normalizeQty } = require("../utilities/packageHelpers");
const {
  PACKAGE_STATUS,
  normalizePackageStatus,
} = require("../packages/packageStatus");
const {
  normalizePackageRow,
  sumTotalQty,
  packageLinkedToTrip,
} = require("../packages/tripPackageOperations");

const LOADED_ON_TRUCK_STATUSES = new Set([
  PACKAGE_STATUS.IN_TRANSIT,
  PACKAGE_STATUS.LOADED_TO_TRIP,
  PACKAGE_STATUS.LOADED,
  PACKAGE_STATUS.PARTIALLY_LOADED,
  PACKAGE_STATUS.OUT_FOR_DELIVERY,
]);

const HUB_RECEIVED_STATUSES = new Set([
  PACKAGE_STATUS.ARRIVED_AT_ODIONGAN,
  PACKAGE_STATUS.AVAILABLE_AT_ODIONGAN_WAREHOUSE,
  PACKAGE_STATUS.RELEASED_FOR_DELIVERY,
  PACKAGE_STATUS.READY_FOR_DELIVERY,
  PACKAGE_STATUS.RETURNED_RECEIVED_AT_ODIONGAN,
  PACKAGE_STATUS.RETURNED_RECEIVED_AT_HUB,
]);

function getPackageIdentity(pkg = {}) {
  return String(pkg.packageId || pkg.trackingNumber || "").trim();
}

function pieceQty(pkg = {}) {
  return Math.max(normalizeQty(pkg.quantity, 1), 1);
}

function isHubReceivedPiece(pkg = {}) {
  const status = normalizePackageStatus(pkg);
  if (HUB_RECEIVED_STATUSES.has(status)) return true;
  if (pkg.hubReceivedAt) return true;
  const receivedQty = normalizeQty(pkg.receivedQty, 0);
  const loadedQty = normalizeQty(pkg.loadedQty, 0);
  return receivedQty > 0 && !LOADED_ON_TRUCK_STATUSES.has(status) && loadedQty === 0;
}

function isOnTruckPiece(pkg = {}) {
  const status = normalizePackageStatus(pkg);
  if (LOADED_ON_TRUCK_STATUSES.has(status)) return true;
  return normalizeQty(pkg.loadedQty, 0) > 0;
}

function resolveTripScopedPackages(
  packages = [],
  tripShipment = {},
  tripId = "",
  scope = "auto",
) {
  const normalized = packages.map(normalizePackageRow);
  const barcodeSet = new Set(
    (tripShipment.packageBarcodes || []).filter(Boolean).map(String),
  );

  const linked = normalized.filter((pkg) =>
    packageLinkedToTrip(pkg, tripId, barcodeSet),
  );
  if (linked.length > 0 || scope === "linked") {
    return linked;
  }

  const hubReceived = normalized.filter(isHubReceivedPiece);
  if (scope === "hub_received") return hubReceived;
  if (scope === "manifest") return normalized;
  if (scope === "auto" && hubReceived.length > 0) return hubReceived;

  return linked;
}

function classifyPieceForTripCounters(pkg = {}) {
  const status = normalizePackageStatus(pkg);
  const qty = pieceQty(pkg);

  if (
    status === PACKAGE_STATUS.DELIVERED ||
    status === PACKAGE_STATUS.COMPLETED
  ) {
    return { bucket: "received", qty };
  }

  if (status === PACKAGE_STATUS.MISSING || normalizeQty(pkg.missingQty, 0) > 0) {
    return { bucket: "missing", qty };
  }
  if (status === PACKAGE_STATUS.DAMAGED || normalizeQty(pkg.damagedQty, 0) > 0) {
    return { bucket: "damaged", qty };
  }
  if (isHubReceivedPiece(pkg)) {
    const receivedQty = Math.min(
      Math.max(normalizeQty(pkg.receivedQty, 0), qty),
      qty,
    );
    return { bucket: "received", qty: receivedQty > 0 ? receivedQty : qty };
  }
  if (isOnTruckPiece(pkg)) {
    const loadedQty = Math.min(
      Math.max(normalizeQty(pkg.loadedQty, 0), qty),
      qty,
    );
    return { bucket: "loaded", qty: loadedQty > 0 ? loadedQty : qty };
  }

  return { bucket: "unknown", qty: 0 };
}

function summarizeTripScopedPackages(scopedPackages = []) {
  let loadedCount = 0;
  let receivedCount = 0;
  let missingCount = 0;
  let damagedCount = 0;

  scopedPackages.forEach((pkg) => {
    const { bucket, qty } = classifyPieceForTripCounters(pkg);
    if (bucket === "missing") missingCount += qty;
    else if (bucket === "damaged") damagedCount += qty;
    else if (bucket === "received") receivedCount += qty;
    else if (bucket === "loaded") loadedCount += qty;
  });

  const totalItems = sumTotalQty(scopedPackages);
  const pendingCount = Math.max(
    totalItems - loadedCount - receivedCount - missingCount - damagedCount,
    0,
  );
  const packageBarcodes = scopedPackages.map(getPackageIdentity).filter(Boolean);

  return {
    totalItems,
    loadedCount,
    receivedCount,
    missingCount,
    damagedCount,
    pendingCount,
    packageBarcodes,
    deliveredCount: receivedCount,
  };
}

/**
 * Recompute trip_shipments counters from root shipment packages.
 * Falls back to manifest scope when auto/linked scope yields no rows.
 */
function buildTripShipmentCounterUpdate(
  packages = [],
  tripShipment = {},
  tripId = "",
  scope = "auto",
) {
  let scopedPackages = resolveTripScopedPackages(
    packages,
    tripShipment,
    tripId,
    scope,
  );

  if (!scopedPackages.length && scope === "auto") {
    scopedPackages = resolveTripScopedPackages(
      packages,
      tripShipment,
      tripId,
      "manifest",
    );
  }

  const stats = summarizeTripScopedPackages(scopedPackages);
  const existingBarcodes = (tripShipment.packageBarcodes || [])
    .filter(Boolean)
    .map(String);
  const mergedBarcodes = [
    ...new Set([...existingBarcodes, ...stats.packageBarcodes]),
  ];

  return {
    scopedPackages,
    ...stats,
    packageBarcodes:
      mergedBarcodes.length > 0 ? mergedBarcodes : stats.packageBarcodes,
    totalItems: Math.max(stats.totalItems, mergedBarcodes.length),
  };
}

module.exports = {
  resolveTripScopedPackages,
  classifyPieceForTripCounters,
  summarizeTripScopedPackages,
  buildTripShipmentCounterUpdate,
};
