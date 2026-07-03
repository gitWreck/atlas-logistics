"use strict";

const { normalizeQty } = require("../utilities/packageHelpers");
const {
  deriveMasterShipmentStatus,
  computePackageBreakdown,
} = require("./shipmentStatus");
const {
  PACKAGE_STATUS,
  normalizePackageStatus,
  TERMINAL_STATUSES,
  derivePackageStatusFromQuantities,
  ODIONGAN_WAREHOUSE,
} = require("./packageStatus");

function isTerminalPiece(pkg = {}) {
  return TERMINAL_STATUSES.has(normalizePackageStatus(pkg));
}

function packageOnTrip(pkg = {}, tripId = "") {
  const trip = String(tripId || "").trim();
  if (!trip) return false;
  const loadedOn = String(pkg.loadedOnTrip || "").trim();
  const currentTrip = String(pkg.currentTripId || "").trim();
  const hubReceivedOn = String(pkg.hubReceivedOnTrip || "").trim();
  return loadedOn === trip || currentTrip === trip || hubReceivedOn === trip;
}

function getPackageIdentity(pkg = {}) {
  return String(pkg.packageId || pkg.trackingNumber || "").trim();
}

/**
 * Whether a package row belongs to a trip_shipments counter scope.
 * Uses trip ids, hub receive trip stamp, manifest barcodes, or active scan ids.
 */
function packageLinkedToTrip(
  pkg = {},
  tripId = "",
  barcodeSet = new Set(),
  options = {},
) {
  const trip = String(tripId || "").trim();
  if (!trip) return false;

  const loadedOn = String(pkg.loadedOnTrip || "").trim();
  const currentTrip = String(pkg.currentTripId || "").trim();
  const hubReceivedOn = String(pkg.hubReceivedOnTrip || "").trim();
  if (loadedOn === trip || currentTrip === trip || hubReceivedOn === trip) {
    return true;
  }

  const packageId = getPackageIdentity(pkg);
  const scannedIds = options.scannedPackageIds || new Set();
  if (packageId && scannedIds.has(packageId)) return true;

  if (!packageId || !barcodeSet.has(packageId)) return false;

  const loadedQty = normalizeQty(pkg.loadedQty, 0);
  const receivedQty = normalizeQty(pkg.receivedQty, 0);
  if (loadedQty > 0 || receivedQty > 0) return true;

  return [
    PACKAGE_STATUS.LOADED,
    PACKAGE_STATUS.LOADED_TO_TRIP,
    PACKAGE_STATUS.IN_TRANSIT,
    PACKAGE_STATUS.OUT_FOR_DELIVERY,
    PACKAGE_STATUS.ARRIVED_AT_ODIONGAN,
  ].includes(normalizePackageStatus(pkg));
}

function packageEligibleForLinehaulLoad(pkg = {}) {
  if (isTerminalPiece(pkg)) return false;
  if (String(pkg.loadedOnTrip || "").trim()) return false;

  const status = normalizePackageStatus(pkg);
  const loadedQty = normalizeQty(pkg.loadedQty, 0);
  if (loadedQty > 0 && String(pkg.currentTripId || "").trim()) return false;

  return [
    PACKAGE_STATUS.RECEIVED_AT_DIVISORIA,
    PACKAGE_STATUS.RECEIVED,
    PACKAGE_STATUS.ARRIVED_AT_ODIONGAN,
  ].includes(status);
}

const LINEHAUL_LOAD_BLOCKED_STATUSES = new Set([
  PACKAGE_STATUS.RELEASED_FOR_DELIVERY,
  PACKAGE_STATUS.AVAILABLE_AT_ODIONGAN_WAREHOUSE,
  PACKAGE_STATUS.AVAILABLE_AT_WAREHOUSE,
  PACKAGE_STATUS.ROUTE_ASSIGNED,
  PACKAGE_STATUS.LOADED_TO_DELIVERY_VEHICLE,
  PACKAGE_STATUS.READY_FOR_DELIVERY,
  PACKAGE_STATUS.OUT_FOR_DELIVERY,
  PACKAGE_STATUS.DELIVERED,
  PACKAGE_STATUS.COMPLETED,
  PACKAGE_STATUS.MISSING,
  PACKAGE_STATUS.DAMAGED,
  PACKAGE_STATUS.RETURNED_TO_WAREHOUSE,
  PACKAGE_STATUS.RETURNED_RECEIVED_AT_ODIONGAN,
  PACKAGE_STATUS.RETURNED_RECEIVED_AT_HUB,
  PACKAGE_STATUS.FAILED_DELIVERY,
]);

const LINEHAUL_ON_TRUCK_STATUSES = new Set([
  PACKAGE_STATUS.IN_TRANSIT,
  PACKAGE_STATUS.LOADED_TO_TRIP,
  PACKAGE_STATUS.LOADED,
  PACKAGE_STATUS.PARTIALLY_LOADED,
]);

/**
 * Returns an error message when a piece must not be linehaul-loaded onto tripId.
 * Returns null when loading is allowed. Returns "ALREADY_LOADED" for duplicate scan.
 */
function evaluatePackageLinehaulLoad(pkg = {}, tripId = "", options = {}) {
  if (options.isDeliveryTrip) return null;

  const trip = String(tripId || "").trim();
  if (!trip || !pkg) return null;

  const pieceId = getPackageIdentity(pkg) || "This label";
  const loadedOn = String(pkg.loadedOnTrip || "").trim();
  const currentTrip = String(pkg.currentTripId || "").trim();
  const hubOn = String(pkg.hubReceivedOnTrip || "").trim();
  const activeTrip = loadedOn || currentTrip;
  const status = normalizePackageStatus(pkg);
  const qty = Math.max(normalizeQty(pkg.quantity, 1), 1);
  const loadedQty = Math.min(normalizeQty(pkg.loadedQty, 0), qty);
  const receivedQty = Math.min(normalizeQty(pkg.receivedQty, 0), qty);

  if (activeTrip && activeTrip !== trip) {
    return `Package ${pieceId} is already on trip ${activeTrip} and cannot be loaded onto ${trip}.`;
  }

  if (
    hubOn &&
    hubOn !== trip &&
    (receivedQty > 0 || LINEHAUL_LOAD_BLOCKED_STATUSES.has(status))
  ) {
    return `Package ${pieceId} already completed trip ${hubOn} at the hub and cannot be loaded onto ${trip}.`;
  }

  if (LINEHAUL_LOAD_BLOCKED_STATUSES.has(status)) {
    return `Package ${pieceId} is already ${status.replace(/_/g, " ").toLowerCase()} and cannot be loaded onto a linehaul trip.`;
  }

  if (
    activeTrip === trip &&
    loadedQty > 0 &&
    (LINEHAUL_ON_TRUCK_STATUSES.has(status) || loadedQty >= qty)
  ) {
    const remaining = Math.max(qty - loadedQty, 0);
    if (remaining <= 0) return "ALREADY_LOADED";
  }

  if (
    !activeTrip &&
    loadedQty > 0 &&
    receivedQty === 0 &&
    LINEHAUL_ON_TRUCK_STATUSES.has(status)
  ) {
    return `Package ${pieceId} is already in transit and cannot be loaded again.`;
  }

  return null;
}

function clampQty(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function normalizePackageRow(pkg = {}) {
  const quantity = Math.max(normalizeQty(pkg.quantity, 1), 1);
  return {
    ...pkg,
    quantity,
    loadedQty: clampQty(normalizeQty(pkg.loadedQty, 0), 0, quantity),
    receivedQty: clampQty(normalizeQty(pkg.receivedQty, 0), 0, quantity),
    missingQty: clampQty(normalizeQty(pkg.missingQty, 0), 0, quantity),
    damagedQty: clampQty(normalizeQty(pkg.damagedQty, 0), 0, quantity),
  };
}

function sumTotalQty(packages = []) {
  return packages.reduce(
    (sum, pkg) => sum + Math.max(normalizeQty(pkg.quantity, 1), 1),
    0,
  );
}

function sumLoadedQty(packages = []) {
  return packages.reduce((sum, pkg) => {
    const quantity = Math.max(normalizeQty(pkg.quantity, 1), 1);
    return sum + clampQty(normalizeQty(pkg.loadedQty, 0), 0, quantity);
  }, 0);
}

function sumDeliveredQty(packages = []) {
  return packages.reduce((sum, pkg) => {
    const quantity = Math.max(normalizeQty(pkg.quantity, 1), 1);
    const status = normalizePackageStatus(pkg);
    if (status === PACKAGE_STATUS.DELIVERED || status === PACKAGE_STATUS.COMPLETED) {
      return sum + quantity;
    }
    return sum;
  }, 0);
}

function sumReceivedQty(packages = []) {
  return packages.reduce((sum, pkg) => {
    const quantity = Math.max(normalizeQty(pkg.quantity, 1), 1);
    const status = normalizePackageStatus(pkg);
    if (status === PACKAGE_STATUS.DELIVERED) return sum + quantity;
    if (
      [
        PACKAGE_STATUS.ARRIVED_AT_ODIONGAN,
        PACKAGE_STATUS.AVAILABLE_AT_ODIONGAN_WAREHOUSE,
        PACKAGE_STATUS.RELEASED_FOR_DELIVERY,
        PACKAGE_STATUS.READY_FOR_DELIVERY,
        PACKAGE_STATUS.COMPLETED,
      ].includes(status)
    ) {
      return sum + quantity;
    }
    return sum + clampQty(normalizeQty(pkg.receivedQty, 0), 0, quantity);
  }, 0);
}

function sumMissingQty(packages = []) {
  return packages.reduce((sum, pkg) => {
    const quantity = Math.max(normalizeQty(pkg.quantity, 1), 1);
    if (normalizePackageStatus(pkg) === PACKAGE_STATUS.MISSING) {
      return sum + quantity;
    }
    return sum + clampQty(normalizeQty(pkg.missingQty, 0), 0, quantity);
  }, 0);
}

function sumDamagedQty(packages = []) {
  return packages.reduce((sum, pkg) => {
    const quantity = Math.max(normalizeQty(pkg.quantity, 1), 1);
    if (normalizePackageStatus(pkg) === PACKAGE_STATUS.DAMAGED) {
      return sum + quantity;
    }
    return sum + clampQty(normalizeQty(pkg.damagedQty, 0), 0, quantity);
  }, 0);
}

function applyLinehaulLoad(pkg = {}, { tripId, actorName = null, nowIso } = {}) {
  const normalized = normalizePackageRow(pkg);
  const timestamp = nowIso || new Date().toISOString();

  return {
    ...normalized,
    status: PACKAGE_STATUS.LOADED_TO_TRIP,
    loadedQty: normalized.quantity,
    receivedQty: 0,
    missingQty: 0,
    damagedQty: 0,
    currentTripId: tripId,
    loadedOnTrip: tripId,
    loadedAt: timestamp,
    loadedBy: actorName || tripId,
    updatedAt: timestamp,
  };
}

function applyLinehaulInTransit(pkg = {}, { tripId, nowIso } = {}) {
  if (!packageOnTrip(pkg, tripId)) return pkg;
  const timestamp = nowIso || new Date().toISOString();

  return {
    ...pkg,
    status: PACKAGE_STATUS.IN_TRANSIT,
    updatedAt: timestamp,
  };
}

function applyLinehaulUnloadAtHub(pkg = {}, { tripId, nowIso } = {}) {
  if (!packageOnTrip(pkg, tripId)) return pkg;
  const normalized = normalizePackageRow(pkg);
  const timestamp = nowIso || new Date().toISOString();

  return {
    ...normalized,
    status: PACKAGE_STATUS.ARRIVED_AT_ODIONGAN,
    loadedQty: 0,
    receivedQty: normalized.quantity,
    currentTripId: null,
    loadedOnTrip: null,
    hubReceivedOnTrip: tripId || pkg.hubReceivedOnTrip || null,
    custodyOwnerType: "WAREHOUSE",
    custodyOwnerId: ODIONGAN_WAREHOUSE,
    hubReceivedAt: timestamp,
    updatedAt: timestamp,
  };
}

function applyLinehaulMissing(pkg = {}, { tripId, nowIso } = {}) {
  if (!packageOnTrip(pkg, tripId)) return pkg;
  const normalized = normalizePackageRow(pkg);
  const timestamp = nowIso || new Date().toISOString();

  return {
    ...normalized,
    status: PACKAGE_STATUS.MISSING,
    loadedQty: 0,
    missingQty: normalized.quantity,
    currentTripId: null,
    loadedOnTrip: null,
    updatedAt: timestamp,
  };
}

function applyLinehaulDelivered(pkg = {}, { tripId, nowIso } = {}) {
  if (!packageOnTrip(pkg, tripId)) return pkg;
  const normalized = normalizePackageRow(pkg);
  const timestamp = nowIso || new Date().toISOString();

  return {
    ...normalized,
    status: PACKAGE_STATUS.DELIVERED,
    loadedQty: 0,
    receivedQty: normalized.quantity,
    deliveredAt: timestamp,
    currentTripId: null,
    loadedOnTrip: null,
    updatedAt: timestamp,
  };
}

function collectActiveTripIds(packages = []) {
  return [
    ...new Set(
      packages
        .map((pkg) => pkg.currentTripId || pkg.loadedOnTrip || null)
        .filter(Boolean)
        .map(String),
    ),
  ];
}

function shipmentManifestIncludesTrip(shipment = {}, tripId = "", tripShipmentExists = false) {
  const trip = String(tripId || "").trim();
  if (!trip) return false;
  if (tripShipmentExists) return true;
  if (String(shipment.currentTripId || "").trim() === trip) return true;
  const ids = Array.isArray(shipment.currentTripIds) ? shipment.currentTripIds : [];
  return ids.map(String).includes(trip);
}

function countLoadEligiblePieces(packages = []) {
  return packages
    .filter((pkg) => packageEligibleForLinehaulLoad(pkg))
    .reduce(
      (sum, pkg) => sum + Math.max(normalizeQty(pkg.quantity, 1), 1),
      0,
    );
}

/**
 * Whether a shipment may be added to a trip manifest while pieces may already
 * be on another trip. Blocks only when every loadable piece is committed elsewhere.
 */
function evaluateShipmentTripAssignment(shipment = {}, tripId = "", options = {}) {
  const trip = String(tripId || "").trim();
  const tripShipmentExists = options.tripShipmentExists === true;

  if (shipmentManifestIncludesTrip(shipment, trip, tripShipmentExists)) {
    return { allowed: true, alreadyOnTrip: true };
  }

  const packages = Array.isArray(shipment.packages) ? shipment.packages : [];
  const loadEligibleQty = countLoadEligiblePieces(packages);

  if (loadEligibleQty > 0) {
    return { allowed: true, loadEligibleQty };
  }

  const activeTrips = collectActiveTripIds(packages).filter((id) => id !== trip);
  if (activeTrips.length > 0) {
    return {
      allowed: false,
      alreadyOnTrip: false,
      message: `All loadable pieces are already on trip(s) ${activeTrips.join(", ")}. No remaining pieces to assign to ${trip}.`,
    };
  }

  return { allowed: true, loadEligibleQty: 0 };
}

function buildAssignmentTripFields(shipment = {}, tripId = "") {
  const trip = String(tripId || "").trim();
  const packages = Array.isArray(shipment.packages) ? shipment.packages : [];
  const fromPackages = collectActiveTripIds(packages);
  const existingIds = Array.isArray(shipment.currentTripIds)
    ? shipment.currentTripIds.map(String)
    : [];
  const merged = [
    ...new Set([...existingIds, ...fromPackages, trip].filter(Boolean)),
  ];

  return {
    currentTripIds: merged,
    currentTripId: merged.length === 1 ? merged[0] : null,
  };
}

function buildShipmentSnapshot(packages = [], options = {}) {
  const normalizedPackages = packages.map((pkg) => {
    const row = normalizePackageRow(pkg);
    return {
      ...row,
      status: derivePackageStatusFromQuantities(row, options),
    };
  });

  const totalQty = sumTotalQty(normalizedPackages);
  const loadedQty = sumLoadedQty(normalizedPackages);
  const receivedQty = sumReceivedQty(normalizedPackages);
  const missingQty = sumMissingQty(normalizedPackages);
  const damagedQty = sumDamagedQty(normalizedPackages);
  const pendingQty = Math.max(
    totalQty - loadedQty - receivedQty - missingQty - damagedQty,
    0,
  );
  const activeTripIds = collectActiveTripIds(normalizedPackages);

  const packageBreakdown = computePackageBreakdown(normalizedPackages);
  const deliveredQty = packageBreakdown.delivered || sumDeliveredQty(normalizedPackages);

  const shipmentStatus = deriveMasterShipmentStatus(normalizedPackages, {
    ...options,
    totals: {
      totalQty,
      receivedQty,
      loadedQty,
      missingQty,
      damagedQty,
    },
  });

  return {
    packages: normalizedPackages,
    status: shipmentStatus,
    packageBreakdown,
    currentTripIds: activeTripIds,
    currentTripId: activeTripIds.length === 1 ? activeTripIds[0] : null,
    totals: {
      totalItems: normalizedPackages.length,
      totalContentQty: totalQty,
      loaded: loadedQty,
      received: receivedQty,
      delivered: deliveredQty,
      missing: missingQty,
      damaged: damagedQty,
      pending: pendingQty,
    },
  };
}

module.exports = {
  packageOnTrip,
  packageLinkedToTrip,
  getPackageIdentity,
  packageEligibleForLinehaulLoad,
  evaluatePackageLinehaulLoad,
  normalizePackageRow,
  sumTotalQty,
  sumLoadedQty,
  sumReceivedQty,
  sumDeliveredQty,
  sumMissingQty,
  sumDamagedQty,
  applyLinehaulLoad,
  applyLinehaulInTransit,
  applyLinehaulUnloadAtHub,
  applyLinehaulMissing,
  applyLinehaulDelivered,
  collectActiveTripIds,
  shipmentManifestIncludesTrip,
  countLoadEligiblePieces,
  evaluateShipmentTripAssignment,
  buildAssignmentTripFields,
  buildShipmentSnapshot,
};
