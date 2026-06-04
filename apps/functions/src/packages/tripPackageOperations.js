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
  return loadedOn === trip || currentTrip === trip;
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
    custodyOwnerType: "WAREHOUSE",
    custodyOwnerId: ODIONGAN_WAREHOUSE,
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
    packageBreakdown: computePackageBreakdown(normalizedPackages),
    currentTripIds: activeTripIds,
    currentTripId: activeTripIds.length === 1 ? activeTripIds[0] : null,
    totals: {
      totalItems: normalizedPackages.length,
      totalContentQty: totalQty,
      loaded: loadedQty,
      received: receivedQty,
      delivered: receivedQty,
      missing: missingQty,
      damaged: damagedQty,
      pending: pendingQty,
    },
  };
}

module.exports = {
  packageOnTrip,
  packageEligibleForLinehaulLoad,
  normalizePackageRow,
  sumTotalQty,
  sumLoadedQty,
  sumReceivedQty,
  sumMissingQty,
  sumDamagedQty,
  applyLinehaulLoad,
  applyLinehaulInTransit,
  applyLinehaulUnloadAtHub,
  applyLinehaulMissing,
  applyLinehaulDelivered,
  collectActiveTripIds,
  buildShipmentSnapshot,
};
