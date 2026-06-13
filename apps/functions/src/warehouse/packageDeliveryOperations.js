"use strict";

const { HttpsError } = require("firebase-functions/v2/https");
const {
  PACKAGE_STATUS,
  ODIONGAN_WAREHOUSE,
  normalizePackageStatus,
  resolveOdionganPoolStatus,
} = require("../packages/packageStatus");

const STILL_ON_LINEHAUL_STATUSES = new Set([
  PACKAGE_STATUS.IN_TRANSIT,
  PACKAGE_STATUS.LOADED_TO_TRIP,
  PACKAGE_STATUS.LOADED,
  PACKAGE_STATUS.PARTIALLY_LOADED,
]);

const DEFAULT_WAREHOUSE_CODE = ODIONGAN_WAREHOUSE;

const TERMINAL_PIECE_STATUSES = new Set([
  "DELIVERED",
  "MISSING",
  "DAMAGED",
  "CANCELLED",
]);

function normalizeQty(value, fallback = 1) {
  const num = Number(value);
  return Number.isFinite(num) && num >= 0 ? num : fallback;
}

function getPackageIdentity(pkg = {}) {
  return String(pkg.packageId || pkg.trackingNumber || "").trim();
}

function isTerminalPiece(pkg = {}) {
  return TERMINAL_PIECE_STATUSES.has(
    String(pkg.status || "").trim().toUpperCase(),
  );
}

/** Hub unload / reconcile intake — normal first-time release path. */
const DELIVERY_RELEASE_ELIGIBLE_PIECE_STATUSES = new Set([
  PACKAGE_STATUS.ARRIVED_AT_ODIONGAN,
  PACKAGE_STATUS.AVAILABLE_AT_ODIONGAN_WAREHOUSE,
]);

/** Checker return loop — warehouse received the physical return. */
const RETURNED_RECEIVED_STATUSES = new Set([
  PACKAGE_STATUS.RETURNED_RECEIVED_AT_ODIONGAN,
  PACKAGE_STATUS.RETURNED_RECEIVED_AT_HUB,
]);

function isReturnedReceivedAtHubPiece(pkg = {}) {
  const status = normalizePackageStatus(pkg);
  if (RETURNED_RECEIVED_STATUSES.has(status)) return true;
  return Boolean(pkg.returnReceivedAt);
}

function matchesReleasePackageScope(pkg = {}, packageIdSet = null) {
  if (!packageIdSet || packageIdSet.size === 0) return true;
  const identity = getPackageIdentity(pkg);
  return identity ? packageIdSet.has(identity) : false;
}

/**
 * Only pieces physically received at Odiongan (unload scan) may enter checker pool.
 * Pieces still on the truck, at Divisoria, or without hub receive qty are skipped.
 */
function isEligiblePieceForDeliveryRelease(pkg = {}) {
  if (isTerminalPiece(pkg)) return false;

  const status = normalizePackageStatus(pkg);
  if (status === PACKAGE_STATUS.RELEASED_FOR_DELIVERY) {
    return pkg.availableForDelivery !== true;
  }

  if (
    status === PACKAGE_STATUS.RECEIVED_AT_DIVISORIA ||
    STILL_ON_LINEHAUL_STATUSES.has(status)
  ) {
    return false;
  }

  const returnedReceived = isReturnedReceivedAtHubPiece(pkg);

  if (!returnedReceived) {
    if (String(pkg.currentTripId || pkg.loadedOnTrip || "").trim()) {
      return false;
    }
  }

  const quantity = Math.max(normalizeQty(pkg.quantity, 1), 1);
  const loadedQty = normalizeQty(pkg.loadedQty, 0);

  if (loadedQty > 0) return false;

  if (!returnedReceived) {
    const receivedQty = normalizeQty(pkg.receivedQty, 0);
    if (receivedQty < quantity) return false;
  }

  const custody = String(pkg.custodyOwnerType || "").toUpperCase();
  const warehouse = String(pkg.custodyOwnerId || "").toUpperCase();
  if (custody !== "WAREHOUSE" || !warehouse.includes("ODIONGAN")) {
    return false;
  }

  if (returnedReceived) {
    return true;
  }

  if (!DELIVERY_RELEASE_ELIGIBLE_PIECE_STATUSES.has(status)) {
    return false;
  }

  return true;
}

function mapPackagesForDeliveryRelease(
  packages = [],
  warehouseCode = DEFAULT_WAREHOUSE_CODE,
  options = {},
) {
  const { packageIdSet = null } = options;
  const nowIso = new Date().toISOString();

  return packages.map((pkg) => {
    if (!matchesReleasePackageScope(pkg, packageIdSet)) {
      return pkg;
    }

    if (!isEligiblePieceForDeliveryRelease(pkg)) {
      return pkg;
    }

    const quantity = Math.max(normalizeQty(pkg.quantity, 1), 1);

    return {
      ...pkg,
      quantity,
      availableForDelivery: true,
      status: resolveOdionganPoolStatus(pkg, { released: true }),
      custodyOwnerType: "WAREHOUSE",
      custodyOwnerId: warehouseCode,
      loadedByCheckerId: null,
      loadedByCheckerName: null,
      currentTripId: null,
      loadedOnTrip: null,
      loadedQty: 0,
      hubReceivedAt: pkg.hubReceivedAt || nowIso,
      releasedToDeliveryOpsAt: nowIso,
      updatedAt: nowIso,
    };
  });
}

function countPiecesEligibleForDeliveryRelease(packages = [], options = {}) {
  const { packageIdSet = null } = options;
  if (!Array.isArray(packages)) return 0;

  return packages.filter(
    (pkg) =>
      matchesReleasePackageScope(pkg, packageIdSet) &&
      isEligiblePieceForDeliveryRelease(pkg),
  ).length;
}

function listPiecesEligibleForDeliveryRelease(packages = [], options = {}) {
  const { packageIdSet = null } = options;
  if (!Array.isArray(packages)) return [];

  return packages
    .filter(
      (pkg) =>
        matchesReleasePackageScope(pkg, packageIdSet) &&
        isEligiblePieceForDeliveryRelease(pkg),
    )
    .map((pkg) => getPackageIdentity(pkg))
    .filter(Boolean);
}

function applyPieceLoadCustody(
  pkg = {},
  {
    checkerId,
    checkerName = null,
    manifestId = null,
    vehicleId = null,
    vehicleName = null,
    nowIso = new Date().toISOString(),
  } = {},
) {
  const quantity = Math.max(normalizeQty(pkg.quantity, 1), 1);

  return {
    ...pkg,
    quantity,
    loadedQty: quantity,
    availableForDelivery: false,
    status: PACKAGE_STATUS.OUT_FOR_DELIVERY,
    custodyOwnerType: "CHECKER",
    custodyOwnerId: checkerId,
    loadedByCheckerId: checkerId,
    loadedByCheckerName: checkerName,
    loadedAt: nowIso,
    outForDeliveryAt: nowIso,
    loadedBy: checkerName || checkerId,
    deliveryManifestId: manifestId || pkg.deliveryManifestId || null,
    deliveryVehicleId: vehicleId || pkg.deliveryVehicleId || null,
    deliveryVehicleName: vehicleName || pkg.deliveryVehicleName || null,
    updatedAt: nowIso,
  };
}

function shipmentHasWarehouseCustodyPieces(packages = []) {
  return packages.some((pkg) => {
    if (isTerminalPiece(pkg)) return false;
    const custody = String(pkg.custodyOwnerType || "").toUpperCase();
    return custody === "WAREHOUSE" || custody === "";
  });
}

/** True while any piece is still in the checker load pool (partial last-mile). */
function shipmentHasPiecesAvailableForCheckerLoad(packages = [], actorUid = null) {
  if (!Array.isArray(packages)) return false;

  return packages.some((pkg) => {
    if (isTerminalPiece(pkg)) return false;

    const loadedBy = String(pkg.loadedByCheckerId || "").trim();
    if (loadedBy) {
      if (!actorUid || loadedBy !== String(actorUid)) return false;
      return false;
    }

    const status = normalizePackageStatus(pkg);
    if (pkg.availableForDelivery === true) return true;
    if (status === PACKAGE_STATUS.RELEASED_FOR_DELIVERY) return true;
    if (
      [
        PACKAGE_STATUS.AVAILABLE_AT_WAREHOUSE,
        PACKAGE_STATUS.AVAILABLE_AT_ODIONGAN_WAREHOUSE,
      ].includes(status)
    ) {
      return true;
    }

    return false;
  });
}

function shipmentHasCheckerCustodyPieces(packages = []) {
  return packages.some(
    (pkg) => String(pkg.custodyOwnerType || "").toUpperCase() === "CHECKER",
  );
}

function normalizePieceStatus(pkg = {}) {
  return String(pkg.status || "").trim().toUpperCase();
}

function isFailedDeliveryAtOdionganWarehouse(pkg = {}) {
  if (normalizePieceStatus(pkg) !== "FAILED_DELIVERY") return false;
  const custody = String(pkg.custodyOwnerType || "").toUpperCase();
  const warehouse = String(pkg.custodyOwnerId || "").toUpperCase();
  return custody === "WAREHOUSE" && warehouse.includes("ODIONGAN");
}

function isReturnedAwaitingHubReceive(pkg = {}) {
  if (pkg.returnReceivedAt) return false;

  const status = normalizePieceStatus(pkg);
  if (status === "RETURNED_TO_WAREHOUSE") return true;
  if (isFailedDeliveryAtOdionganWarehouse(pkg)) return true;

  return false;
}

function pieceReceivedReturnedIntake(before = {}, after = {}) {
  if (!before || !after) return false;
  if (before.returnReceivedAt || !after.returnReceivedAt) return false;
  return isReturnedAwaitingHubReceive(before);
}

function countPiecesAwaitingReturnReceive(packages = []) {
  return packages.filter(isReturnedAwaitingHubReceive).length;
}

function shipmentHasPiecesAwaitingReturnReceive(packages = []) {
  return countPiecesAwaitingReturnReceive(packages) > 0;
}

function applyPieceReturnedReceivedAtHub(
  pkg = {},
  {
    warehouseCode = DEFAULT_WAREHOUSE_CODE,
    actorName = null,
    actorUid = null,
  } = {},
) {
  const nowIso = new Date().toISOString();
  const quantity = Math.max(normalizeQty(pkg.quantity, 1), 1);

  return {
    ...pkg,
    quantity,
    status: PACKAGE_STATUS.RETURNED_RECEIVED_AT_ODIONGAN,
    availableForDelivery: false,
    custodyOwnerType: "WAREHOUSE",
    custodyOwnerId: warehouseCode,
    loadedByCheckerId: null,
    loadedByCheckerName: null,
    deliveryManifestId: null,
    deliveryVehicleId: null,
    deliveryVehicleName: null,
    loadedQty: 0,
    currentTripId: null,
    loadedOnTrip: null,
    returnReceivedAt: nowIso,
    returnReceivedBy: actorName || actorUid || null,
    returnReceivedByUid: actorUid || null,
    updatedAt: nowIso,
  };
}

function applyReturnedPiecesReceivedAtHub(
  packages = [],
  {
    warehouseCode = DEFAULT_WAREHOUSE_CODE,
    actorName = null,
    actorUid = null,
    packageIdSet = null,
  } = {},
) {
  return packages.map((pkg) => {
    if (!isReturnedAwaitingHubReceive(pkg)) return pkg;
    if (packageIdSet && packageIdSet.size > 0) {
      const identity = getPackageIdentity(pkg);
      let matched = false;
      for (const packageId of packageIdSet) {
        if (
          identity === String(packageId).trim() ||
          String(pkg.packageId || "").trim() === String(packageId).trim() ||
          String(pkg.trackingNumber || "").trim() === String(packageId).trim()
        ) {
          matched = true;
          break;
        }
      }
      if (!matched) return pkg;
    }

    return applyPieceReturnedReceivedAtHub(pkg, {
      warehouseCode,
      actorName,
      actorUid,
    });
  });
}

function canCheckerAccessShipment(shipmentData = {}, checkerUid) {
  if (!checkerUid) return false;

  const assignedCheckerId = String(shipmentData.assignedCheckerId || "").trim();
  if (assignedCheckerId && assignedCheckerId === String(checkerUid)) {
    return true;
  }

  if (shipmentData.availableForDelivery === true) {
    return true;
  }

  const packages = Array.isArray(shipmentData.packages) ? shipmentData.packages : [];
  return packages.some(
    (pkg) => String(pkg.loadedByCheckerId || "").trim() === String(checkerUid),
  );
}

function assertCheckerCanAccessShipment(shipmentId, shipmentData, checkerUid) {
  if (canCheckerAccessShipment(shipmentData, checkerUid)) return;

  throw new HttpsError(
    "permission-denied",
    `Shipment ${shipmentId} is not available for your delivery operations. Ask warehouse to release it first.`,
  );
}

module.exports = {
  DEFAULT_WAREHOUSE_CODE,
  TERMINAL_PIECE_STATUSES,
  getPackageIdentity,
  isTerminalPiece,
  mapPackagesForDeliveryRelease,
  isEligiblePieceForDeliveryRelease,
  countPiecesEligibleForDeliveryRelease,
  listPiecesEligibleForDeliveryRelease,
  matchesReleasePackageScope,
  applyPieceLoadCustody,
  shipmentHasWarehouseCustodyPieces,
  shipmentHasPiecesAvailableForCheckerLoad,
  shipmentHasCheckerCustodyPieces,
  canCheckerAccessShipment,
  assertCheckerCanAccessShipment,
  isReturnedAwaitingHubReceive,
  countPiecesAwaitingReturnReceive,
  shipmentHasPiecesAwaitingReturnReceive,
  applyPieceReturnedReceivedAtHub,
  applyReturnedPiecesReceivedAtHub,
  pieceReceivedReturnedIntake,
};
