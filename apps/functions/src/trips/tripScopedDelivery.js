"use strict";

const { normalizeQty } = require("../utilities/packageHelpers");
const {
  PACKAGE_STATUS,
  normalizePackageStatus,
} = require("../packages/packageStatus");

const DELIVERED_PIECE_STATUSES = new Set([
  PACKAGE_STATUS.DELIVERED,
  PACKAGE_STATUS.COMPLETED,
]);

const LOADED_ON_TRUCK_PIECE_STATUSES = new Set([
  PACKAGE_STATUS.LOADED,
  PACKAGE_STATUS.LOADED_TO_TRIP,
  PACKAGE_STATUS.IN_TRANSIT,
  "PARTIALLY_LOADED",
]);

const RECEIVED_AT_HUB_PIECE_STATUSES = new Set([
  PACKAGE_STATUS.ARRIVED_AT_ODIONGAN,
  PACKAGE_STATUS.AVAILABLE_AT_ODIONGAN_WAREHOUSE,
  PACKAGE_STATUS.RELEASED_FOR_DELIVERY,
  PACKAGE_STATUS.READY_FOR_DELIVERY,
  PACKAGE_STATUS.AVAILABLE_FOR_DELIVERY,
]);

const POST_HUB_DELIVERY_PIECE_STATUSES = new Set([
  ...RECEIVED_AT_HUB_PIECE_STATUSES,
  PACKAGE_STATUS.LOADED_TO_DELIVERY_VEHICLE,
  PACKAGE_STATUS.OUT_FOR_DELIVERY,
  PACKAGE_STATUS.DELIVERED,
  PACKAGE_STATUS.COMPLETED,
  PACKAGE_STATUS.FAILED_DELIVERY,
  PACKAGE_STATUS.RETURNED_TO_WAREHOUSE,
  PACKAGE_STATUS.RETURNED_RECEIVED_AT_HUB,
  PACKAGE_STATUS.RETURNED_RECEIVED_AT_ODIONGAN,
]);

const ORIGIN_ONLY_PIECE_STATUSES = new Set([
  PACKAGE_STATUS.RECEIVED,
  PACKAGE_STATUS.RECEIVED_AT_DIVISORIA,
  "PENDING",
  "CREATED",
]);

function normalizeStatus(value) {
  return String(value || "").trim().toUpperCase();
}

function getPackageIdentity(pkg = {}) {
  return (
    pkg.packageId ||
    pkg.trackingNumber ||
    pkg.pieceId ||
    pkg.barcode ||
    null
  );
}

function pieceQty(pkg = {}) {
  return Math.max(normalizeQty(pkg.quantity, 1), 1);
}

function isOriginOnlyPiece(pkg = {}) {
  const status = normalizePackageStatus(pkg);
  if (ORIGIN_ONLY_PIECE_STATUSES.has(status) && !pkg.hubReceivedAt) {
    return true;
  }
  return false;
}

function packageWasOnTrip(pkg = {}, tripId = "", tripBarcodeSet = new Set()) {
  const status = normalizePackageStatus(pkg);

  if (
    status === PACKAGE_STATUS.OUT_FOR_DELIVERY ||
    status === PACKAGE_STATUS.LOADED_TO_DELIVERY_VEHICLE
  ) {
    return true;
  }

  if (isOriginOnlyPiece(pkg)) return false;

  const packageTripId = String(pkg.currentTripId || pkg.loadedOnTrip || "").trim();
  if (tripId && packageTripId === tripId) return true;

  const packageId = getPackageIdentity(pkg);
  const inBarcodeSet = Boolean(packageId && tripBarcodeSet.has(String(packageId)));
  if (inBarcodeSet) return true;

  if (pkg.hubReceivedAt) return true;

  if (POST_HUB_DELIVERY_PIECE_STATUSES.has(status)) {
    return Boolean(
      pkg.loadedByCheckerId || pkg.availableForDelivery || pkg.deliveredAt,
    );
  }

  if (RECEIVED_AT_HUB_PIECE_STATUSES.has(status)) return true;
  if (LOADED_ON_TRUCK_PIECE_STATUSES.has(status)) return true;

  const loadedQty = normalizeQty(pkg.loadedQty, 0);
  const receivedQty = normalizeQty(pkg.receivedQty, 0);
  if (loadedQty > 0 || receivedQty > 0) return true;

  return false;
}

function getTripScopedPackages(tripShipment = {}, shipment = {}, tripId = "") {
  const packages = Array.isArray(shipment.packages) ? shipment.packages : [];
  const tripBarcodeSet = new Set(
    (tripShipment.packageBarcodes || []).filter(Boolean).map(String),
  );

  if (packages.length === 0) return [];

  return packages.filter((pkg) =>
    packageWasOnTrip(pkg, tripId, tripBarcodeSet),
  );
}

function isTripScopedPieceDelivered(pkg = {}) {
  return DELIVERED_PIECE_STATUSES.has(normalizePackageStatus(pkg));
}

function countTripScopedDelivered(packages = []) {
  return packages.reduce(
    (sum, pkg) => sum + (isTripScopedPieceDelivered(pkg) ? pieceQty(pkg) : 0),
    0,
  );
}

function resolveTripScopedPieceTotal(tripShipment = {}, scopedPackages = []) {
  const loaded = normalizeQty(tripShipment.loadedCount, 0);
  const received = normalizeQty(
    tripShipment.receivedCount ?? tripShipment.deliveredCount,
    0,
  );
  const missing = normalizeQty(tripShipment.missingCount, 0);
  const damaged = normalizeQty(tripShipment.damagedCount, 0);
  const onTrip = loaded + received + missing + damaged;
  const barcodeCount = (tripShipment.packageBarcodes || []).filter(Boolean)
    .length;
  const packageTotal = scopedPackages.reduce((sum, pkg) => sum + pieceQty(pkg), 0);

  if (barcodeCount > 0) {
    return Math.max(barcodeCount, onTrip > 0 ? onTrip : 0, packageTotal);
  }
  if (packageTotal > 0) return packageTotal;
  if (onTrip > 0) return onTrip;

  return normalizeQty(tripShipment.totalItems, 0);
}

/**
 * Trip completion uses labels on this truck only — not warehouse remainders.
 */
function evaluateTripScopedDelivery(tripShipment = {}, shipment = {}, tripId = "") {
  const scopedPackages = getTripScopedPackages(tripShipment, shipment, tripId);
  const tripScopedTotal = resolveTripScopedPieceTotal(
    tripShipment,
    scopedPackages,
  );
  const tripScopedDelivered = countTripScopedDelivered(scopedPackages);
  const allTripScopedPackagesDelivered =
    tripScopedTotal > 0 && tripScopedDelivered >= tripScopedTotal;

  return {
    scopedPackages,
    tripScopedTotal,
    tripScopedDelivered,
    allTripScopedPackagesDelivered,
  };
}

module.exports = {
  getPackageIdentity,
  getTripScopedPackages,
  evaluateTripScopedDelivery,
  isTripScopedPieceDelivered,
  countTripScopedDelivered,
  resolveTripScopedPieceTotal,
};
