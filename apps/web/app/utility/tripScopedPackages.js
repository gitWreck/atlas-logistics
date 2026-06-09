function normalizeStatus(value) {
  return String(value || "").trim().toUpperCase();
}

export function getPackageIdentity(pkg = {}) {
  return (
    pkg.packageId ||
    pkg.trackingNumber ||
    pkg.pieceId ||
    pkg.barcode ||
    null
  );
}

const LOADED_ON_TRUCK_PIECE_STATUSES = new Set([
  "LOADED",
  "LOADED_TO_TRIP",
  "IN_TRANSIT",
  "PARTIALLY_LOADED",
]);

const RECEIVED_AT_HUB_PIECE_STATUSES = new Set([
  "ARRIVED_AT_ODIONGAN",
  "AVAILABLE_AT_ODIONGAN_WAREHOUSE",
  "RELEASED_FOR_DELIVERY",
  "READY_FOR_DELIVERY",
  "AVAILABLE_FOR_DELIVERY",
]);

const POST_HUB_DELIVERY_PIECE_STATUSES = new Set([
  ...RECEIVED_AT_HUB_PIECE_STATUSES,
  "LOADED_TO_DELIVERY_VEHICLE",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
  "COMPLETED",
  "FAILED_DELIVERY",
  "RETURNED_TO_WAREHOUSE",
  "RETURNED_RECEIVED_AT_HUB",
  "RETURNED_RECEIVED_AT_ODIONGAN",
]);

const ORIGIN_ONLY_PIECE_STATUSES = new Set([
  "RECEIVED",
  "RECEIVED_AT_DIVISORIA",
  "PENDING",
  "CREATED",
]);

function pieceQty(pkg = {}) {
  const qty = Number(pkg.quantity);
  return Number.isFinite(qty) && qty > 0 ? qty : 1;
}

function isOriginOnlyPiece(pkg = {}) {
  const status = normalizeStatus(pkg.status);
  if (ORIGIN_ONLY_PIECE_STATUSES.has(status) && !pkg.hubReceivedAt) {
    return true;
  }
  return false;
}

export function packageWasOnTrip(pkg = {}, tripId = "", tripBarcodeSet = new Set()) {
  const status = normalizeStatus(pkg.status);

  if (
    status === "OUT_FOR_DELIVERY" ||
    status === "LOADED_TO_DELIVERY_VEHICLE"
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
    return Boolean(pkg.loadedByCheckerId || pkg.availableForDelivery || pkg.deliveredAt);
  }

  if (RECEIVED_AT_HUB_PIECE_STATUSES.has(status)) return true;
  if (LOADED_ON_TRUCK_PIECE_STATUSES.has(status)) return true;

  const loadedQty = Number(pkg.loadedQty);
  const receivedQty = Number(pkg.receivedQty);
  if (Number.isFinite(loadedQty) && loadedQty > 0) return true;
  if (Number.isFinite(receivedQty) && receivedQty > 0) return true;

  return false;
}

export function getTripScopedPackages(
  tripShipment = {},
  shipment = {},
  tripId = "",
) {
  const packages = Array.isArray(shipment.packages) ? shipment.packages : [];
  const tripBarcodeSet = new Set(
    (tripShipment.packageBarcodes || []).filter(Boolean).map(String),
  );

  if (packages.length === 0) return [];

  return packages.filter((pkg) =>
    packageWasOnTrip(pkg, tripId, tripBarcodeSet),
  );
}

export function sumTripScopedPackageQty(packages = []) {
  return packages.reduce((sum, pkg) => sum + pieceQty(pkg), 0);
}

const DELIVERED_PIECE_STATUSES = new Set(["DELIVERED", "COMPLETED"]);

function isTripScopedPieceDelivered(pkg = {}) {
  return DELIVERED_PIECE_STATUSES.has(normalizeStatus(pkg.status));
}

function countTripScopedDelivered(packages = []) {
  return packages.reduce(
    (sum, pkg) => sum + (isTripScopedPieceDelivered(pkg) ? pieceQty(pkg) : 0),
    0,
  );
}

function resolveTripScopedPieceTotal(tripShipment = {}, scopedPackages = []) {
  const loaded = Math.max(0, Number(tripShipment.loadedCount) || 0);
  const received = Math.max(
    0,
    Number(tripShipment.receivedCount ?? tripShipment.deliveredCount) || 0,
  );
  const missing = Math.max(0, Number(tripShipment.missingCount) || 0);
  const damaged = Math.max(0, Number(tripShipment.damagedCount) || 0);
  const onTrip = loaded + received + missing + damaged;
  const barcodeCount = (tripShipment.packageBarcodes || []).filter(Boolean)
    .length;
  const packageTotal = sumTripScopedPackageQty(scopedPackages);

  if (barcodeCount > 0) {
    return Math.max(barcodeCount, onTrip > 0 ? onTrip : 0, packageTotal);
  }
  if (packageTotal > 0) return packageTotal;
  if (onTrip > 0) return onTrip;

  return Math.max(0, Number(tripShipment.totalItems) || 0);
}

export function evaluateTripScopedDelivery(
  tripShipment = {},
  shipment = {},
  tripId = "",
) {
  const scopedPackages = getTripScopedPackages(tripShipment, shipment, tripId);
  const tripScopedTotal = resolveTripScopedPieceTotal(
    tripShipment,
    scopedPackages,
  );
  const tripScopedDelivered = countTripScopedDelivered(scopedPackages);

  return {
    scopedPackages,
    tripScopedTotal,
    tripScopedDelivered,
    allTripScopedPackagesDelivered:
      tripScopedTotal > 0 && tripScopedDelivered >= tripScopedTotal,
  };
}

export function resolveHubHandoffPieceTotal(tripShipment = {}, scopedPackages = []) {
  const hubHandoffTotal =
    Math.max(0, Number(tripShipment.receivedCount ?? tripShipment.deliveredCount) || 0) +
    Math.max(0, Number(tripShipment.missingCount) || 0) +
    Math.max(0, Number(tripShipment.damagedCount) || 0);

  if (scopedPackages.length > 0) {
    const packageTotal = sumTripScopedPackageQty(scopedPackages);
    return Math.max(hubHandoffTotal, packageTotal);
  }

  return hubHandoffTotal;
}
