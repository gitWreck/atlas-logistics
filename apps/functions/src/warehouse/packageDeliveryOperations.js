"use strict";

const { HttpsError } = require("firebase-functions/v2/https");

const DEFAULT_WAREHOUSE_CODE = "ODIONGAN_WAREHOUSE";

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

function mapPackagesForDeliveryRelease(packages = [], warehouseCode = DEFAULT_WAREHOUSE_CODE) {
  const nowIso = new Date().toISOString();

  return packages.map((pkg) => {
    if (isTerminalPiece(pkg)) {
      return pkg;
    }

    const quantity = Math.max(normalizeQty(pkg.quantity, 1), 1);

    return {
      ...pkg,
      quantity,
      availableForDelivery: true,
      status: "AVAILABLE_AT_WAREHOUSE",
      custodyOwnerType: "WAREHOUSE",
      custodyOwnerId: warehouseCode,
      loadedByCheckerId: null,
      loadedByCheckerName: null,
      updatedAt: nowIso,
    };
  });
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
    status: "LOADED",
    custodyOwnerType: "CHECKER",
    custodyOwnerId: checkerId,
    loadedByCheckerId: checkerId,
    loadedByCheckerName: checkerName,
    loadedAt: nowIso,
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

function shipmentHasCheckerCustodyPieces(packages = []) {
  return packages.some(
    (pkg) => String(pkg.custodyOwnerType || "").toUpperCase() === "CHECKER",
  );
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
  applyPieceLoadCustody,
  shipmentHasWarehouseCustodyPieces,
  shipmentHasCheckerCustodyPieces,
  canCheckerAccessShipment,
  assertCheckerCanAccessShipment,
};
