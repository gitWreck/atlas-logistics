"use strict";

const { HttpsError } = require("firebase-functions/v2/https");
const {
  getPackageIdentity,
  isTerminalPiece,
} = require("../warehouse/packageDeliveryOperations");

const DELIVERABLE_PIECE_STATUSES = new Set([
  "OUT_FOR_DELIVERY",
  "LOADED",
  "READY_FOR_DELIVERY",
]);

const FAILABLE_PIECE_STATUSES = new Set([
  "OUT_FOR_DELIVERY",
  "LOADED",
  "READY_FOR_DELIVERY",
]);

const RETURNABLE_PIECE_STATUSES = new Set([
  "FAILED_DELIVERY",
  "OUT_FOR_DELIVERY",
]);

function normalizePackageIdSet(packageIds) {
  if (!Array.isArray(packageIds)) return null;
  const ids = new Set();
  packageIds.forEach((value) => {
    const trimmed = String(value || "").trim();
    if (trimmed) ids.add(trimmed);
  });
  return ids.size > 0 ? ids : null;
}

function packageMatchesId(pkg = {}, packageId = "") {
  const target = String(packageId || "").trim();
  if (!target) return false;
  const identity = getPackageIdentity(pkg);
  return identity === target;
}

function packageInIdSet(pkg = {}, packageIdSet = null) {
  if (!packageIdSet || packageIdSet.size === 0) return true;
  for (const packageId of packageIdSet) {
    if (packageMatchesId(pkg, packageId)) return true;
  }
  return false;
}

function isCheckerOwnedPiece(
  pkg = {},
  checkerUid,
  shipmentData = {},
  legacyUserCode = null,
) {
  if (!checkerUid) return false;
  const uid = String(checkerUid);
  const loadedBy = String(pkg.loadedByCheckerId || "").trim();
  const legacy = String(legacyUserCode || "").trim();
  if (loadedBy && (loadedBy === uid || (legacy && loadedBy === legacy))) {
    return true;
  }
  const custodyId = String(pkg.custodyOwnerId || "").trim();
  return (
    String(pkg.custodyOwnerType || "").toUpperCase() === "CHECKER" &&
    (custodyId === uid || (legacy && custodyId === legacy))
  );
}

function isPieceDeliverable(pkg = {}) {
  return DELIVERABLE_PIECE_STATUSES.has(
    String(pkg.status || "").trim().toUpperCase(),
  );
}

function isPieceFailable(pkg = {}) {
  return FAILABLE_PIECE_STATUSES.has(
    String(pkg.status || "").trim().toUpperCase(),
  );
}

function isPieceReturnable(pkg = {}) {
  return RETURNABLE_PIECE_STATUSES.has(
    String(pkg.status || "").trim().toUpperCase(),
  );
}

function shouldTargetCheckerPiece(
  pkg = {},
  {
    checkerUid,
    shipmentData = {},
    packageIdSet = null,
    mode = "deliver",
  } = {},
) {
  if (!isCheckerOwnedPiece(pkg, checkerUid, shipmentData)) return false;
  if (isTerminalPiece(pkg)) return false;
  if (!packageInIdSet(pkg, packageIdSet)) return false;

  if (mode === "deliver") return isPieceDeliverable(pkg);
  if (mode === "fail") return isPieceFailable(pkg);
  if (mode === "return") return isPieceReturnable(pkg);
  return false;
}

function collectTargetPieceIdentities(
  packages = [],
  options = {},
) {
  const identities = [];
  packages.forEach((pkg) => {
    if (!shouldTargetCheckerPiece(pkg, options)) return;
    const identity = getPackageIdentity(pkg);
    if (identity) identities.push(identity);
  });
  return identities;
}

function assertHasTargetPieces(identities = [], actionLabel = "perform this action") {
  if (identities.length > 0) return;
  throw new HttpsError(
    "failed-precondition",
    `No eligible pieces found for you to ${actionLabel}. Scan the piece label first.`,
  );
}

function assertRequestedPiecesOwned(
  packages = [],
  packageIdSet,
  checkerUid,
  shipmentData = {},
  actionLabel = "update",
) {
  if (!packageIdSet || packageIdSet.size === 0) return;

  for (const packageId of packageIdSet) {
    const pkg = packages.find((row) => packageMatchesId(row, packageId));
    if (!pkg) {
      throw new HttpsError("not-found", `Package ${packageId} not found on shipment.`);
    }
    if (!isCheckerOwnedPiece(pkg, checkerUid, shipmentData)) {
      throw new HttpsError(
        "failed-precondition",
        `Package ${packageId} is not on your van and cannot be ${actionLabel}.`,
      );
    }
  }
}

function normalizeQty(value, fallback = 1) {
  const num = Number(value);
  return Number.isFinite(num) && num >= 0 ? num : fallback;
}

function applyPieceDelivered(
  pkg = {},
  { actorUid = null, actorName = null } = {},
) {
  const quantity = Math.max(normalizeQty(pkg.quantity, 1), 1);
  const nowIso = new Date().toISOString();

  return {
    ...pkg,
    quantity,
    status: "DELIVERED",
    loadedQty: 0,
    receivedQty: quantity,
    deliveredAt: nowIso,
    deliveredByCheckerId: actorUid,
    deliveredByCheckerName: actorName,
    custodyOwnerType: "CUSTOMER",
    custodyOwnerId: null,
    updatedAt: nowIso,
  };
}

function applyPieceFailed(
  pkg = {},
  {
    actorUid = null,
    actorName = null,
    reasonCode = null,
    remarks = null,
  } = {},
) {
  const nowIso = new Date().toISOString();

  return {
    ...pkg,
    status: "FAILED_DELIVERY",
    custodyOwnerType: "CHECKER",
    custodyOwnerId: actorUid,
    failedAt: nowIso,
    failedByUid: actorUid,
    failedByName: actorName,
    failureReasonCode: reasonCode,
    failureRemarks: remarks,
    updatedAt: nowIso,
  };
}

function applyPieceReturnedToWarehouse(
  pkg = {},
  { warehouseCode = "ODIONGAN_WAREHOUSE" } = {},
) {
  const nowIso = new Date().toISOString();

  return {
    ...pkg,
    status: "RETURNED_TO_WAREHOUSE",
    availableForDelivery: false,
    custodyOwnerType: "WAREHOUSE",
    custodyOwnerId: warehouseCode,
    loadedByCheckerId: null,
    loadedByCheckerName: null,
    deliveryManifestId: null,
    deliveryVehicleId: null,
    deliveryVehicleName: null,
    loadedQty: 0,
    updatedAt: nowIso,
  };
}

function collectActiveCheckerIds(packages = []) {
  const ids = new Set();
  packages.forEach((pkg) => {
    if (isTerminalPiece(pkg)) return;
    const status = String(pkg.status || "").trim().toUpperCase();
    if (
      ["RETURNED_TO_WAREHOUSE", "AVAILABLE_AT_WAREHOUSE"].includes(status)
    ) {
      return;
    }
    const loadedBy = String(pkg.loadedByCheckerId || "").trim();
    if (loadedBy) ids.add(loadedBy);
    const custody = String(pkg.custodyOwnerType || "").toUpperCase();
    const custodyId = String(pkg.custodyOwnerId || "").trim();
    if (custody === "CHECKER" && custodyId) ids.add(custodyId);
  });
  return [...ids];
}

module.exports = {
  normalizePackageIdSet,
  packageMatchesId,
  packageInIdSet,
  isCheckerOwnedPiece,
  isPieceDeliverable,
  isPieceFailable,
  isPieceReturnable,
  shouldTargetCheckerPiece,
  collectTargetPieceIdentities,
  assertHasTargetPieces,
  assertRequestedPiecesOwned,
  applyPieceDelivered,
  applyPieceFailed,
  applyPieceReturnedToWarehouse,
  collectActiveCheckerIds,
  getPackageIdentity,
};
