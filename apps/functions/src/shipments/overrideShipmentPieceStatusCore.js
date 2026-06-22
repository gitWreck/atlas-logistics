"use strict";

const { FieldValue } = require("firebase-admin/firestore");
const { buildDerivedShipmentSnapshot } = require("../packages/shipmentStatus");
const {
  PACKAGE_STATUS,
  DELIVERED_STATUSES,
  WAREHOUSE_POOL_STATUSES,
} = require("../packages/packageStatus");
const { normalizeQty } = require("../utilities/packageHelpers");
const { getPackageIdentity } = require("../warehouse/packageDeliveryOperations");
const { writeShipmentActionLog } = require("../utilities/shipmentLogger");

const LOADED_STATUSES = new Set([
  PACKAGE_STATUS.LOADED,
  PACKAGE_STATUS.LOADED_TO_TRIP,
  PACKAGE_STATUS.PARTIALLY_LOADED,
  PACKAGE_STATUS.LOADED_TO_DELIVERY_VEHICLE,
]);

const IN_TRANSIT_STATUSES = new Set([
  PACKAGE_STATUS.IN_TRANSIT,
  PACKAGE_STATUS.LOADED_TO_TRIP,
]);

const ON_CHECKER_VAN_STATUSES = new Set([
  PACKAGE_STATUS.LOADED_TO_DELIVERY_VEHICLE,
  PACKAGE_STATUS.LOADED,
  PACKAGE_STATUS.READY_FOR_DELIVERY,
  PACKAGE_STATUS.PARTIALLY_LOADED,
]);

const OUT_FOR_DELIVERY_STATUSES = new Set([PACKAGE_STATUS.OUT_FOR_DELIVERY]);

const ALLOWED_OVERRIDE_PIECE_STATUSES = new Set(Object.values(PACKAGE_STATUS));

function packageMatchesId(pkg = {}, packageId = "") {
  const target = String(packageId || "").trim();
  if (!target) return false;
  return getPackageIdentity(pkg) === target;
}

function applyAdminPieceStatusOverride(
  pkg = {},
  newStatus,
  { actorUid = null, actorName = null } = {},
) {
  const status = String(newStatus || "").trim().toUpperCase();
  const quantity = Math.max(normalizeQty(pkg.quantity, 1), 1);
  const nowIso = new Date().toISOString();

  const next = {
    ...pkg,
    quantity,
    status,
    updatedAt: nowIso,
    updatedBy: actorName || actorUid || "Admin",
    manualOverrideAt: nowIso,
    manualOverrideBy: actorUid,
  };

  if (DELIVERED_STATUSES.has(status)) {
    return {
      ...next,
      loadedQty: 0,
      receivedQty: quantity,
      deliveredAt: nowIso,
      availableForDelivery: false,
    };
  }

  if (status === PACKAGE_STATUS.MISSING) {
    return {
      ...next,
      loadedQty: 0,
      missingQty: quantity,
      availableForDelivery: false,
    };
  }

  if (WAREHOUSE_POOL_STATUSES.has(status)) {
    return {
      ...next,
      availableForDelivery: true,
      loadedQty: 0,
      custodyOwnerType: "WAREHOUSE",
    };
  }

  if (
    OUT_FOR_DELIVERY_STATUSES.has(status) ||
    ON_CHECKER_VAN_STATUSES.has(status)
  ) {
    return {
      ...next,
      loadedQty: quantity,
      availableForDelivery: false,
    };
  }

  if (LOADED_STATUSES.has(status) || IN_TRANSIT_STATUSES.has(status)) {
    return {
      ...next,
      loadedQty: quantity,
      availableForDelivery: false,
      custodyOwnerType: "TRIP",
    };
  }

  if (
    status === PACKAGE_STATUS.RECEIVED ||
    status === PACKAGE_STATUS.RECEIVED_AT_DIVISORIA
  ) {
    return {
      ...next,
      loadedQty: 0,
      receivedQty: 0,
      missingQty: 0,
      availableForDelivery: false,
    };
  }

  if (status === PACKAGE_STATUS.CANCELLED) {
    return {
      ...next,
      loadedQty: 0,
      availableForDelivery: false,
    };
  }

  return next;
}

function sumLoadedQty(packages = []) {
  return packages.reduce((sum, pkg) => {
    const quantity = normalizeQty(pkg.quantity, 1);
    const loadedQty = Math.min(normalizeQty(pkg.loadedQty, 0), quantity);
    return sum + loadedQty;
  }, 0);
}

function sumReceivedQty(packages = []) {
  return packages.reduce((sum, pkg) => {
    const quantity = normalizeQty(pkg.quantity, 1);
    if (pkg.status === "DELIVERED" || pkg.status === "COMPLETED") {
      return sum + quantity;
    }
    if (pkg.status === "PARTIALLY_RECEIVED") {
      return sum + Math.min(normalizeQty(pkg.receivedQty, 0), quantity);
    }
    return sum;
  }, 0);
}

function sumTotalQty(packages = []) {
  return packages.reduce(
    (sum, pkg) => sum + normalizeQty(pkg.quantity, 1),
    0,
  );
}

class OverrideShipmentPieceStatusError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

async function runOverrideShipmentPieceStatus(
  db,
  {
    shipmentId,
    packageId,
    newStatus,
    remarks = null,
    sourceUI = "ADMIN_PIECE_OVERRIDE",
    actor = {},
    fieldValue = FieldValue,
  },
) {
  const { uid, role, name } = actor;
  const fv = fieldValue || FieldValue;

  if (!shipmentId || !packageId || !newStatus) {
    throw new OverrideShipmentPieceStatusError(
      "invalid-argument",
      "Missing shipmentId, packageId, or newStatus.",
    );
  }

  const normalizedStatus = String(newStatus).trim().toUpperCase();
  if (!ALLOWED_OVERRIDE_PIECE_STATUSES.has(normalizedStatus)) {
    throw new OverrideShipmentPieceStatusError(
      "invalid-argument",
      `Invalid piece status: ${newStatus}`,
    );
  }

  const shipmentRef = db.collection("shipments").doc(shipmentId);

  const result = await db.runTransaction(async (tx) => {
    const shipmentSnap = await tx.get(shipmentRef);
    if (!shipmentSnap.exists) {
      throw new OverrideShipmentPieceStatusError(
        "not-found",
        "Shipment not found.",
      );
    }

    const currentData = shipmentSnap.data() || {};
    const oldStatus = currentData.status || null;
    const oldPackages = Array.isArray(currentData.packages)
      ? currentData.packages
      : [];

    const pkgIndex = oldPackages.findIndex((pkg) =>
      packageMatchesId(pkg, packageId),
    );

    if (pkgIndex === -1) {
      throw new OverrideShipmentPieceStatusError(
        "not-found",
        "Piece not found on this shipment.",
      );
    }

    const targetPkg = oldPackages[pkgIndex];
    const previousPieceStatus = targetPkg.status || null;

    if (
      String(previousPieceStatus || "").toUpperCase() === normalizedStatus
    ) {
      throw new OverrideShipmentPieceStatusError(
        "failed-precondition",
        "Piece status unchanged.",
      );
    }

    const updatedPackages = [...oldPackages];
    updatedPackages[pkgIndex] = applyAdminPieceStatusOverride(
      targetPkg,
      normalizedStatus,
      { actorUid: uid, actorName: name },
    );

    const newTotalQty =
      sumTotalQty(updatedPackages) ||
      Number(currentData.totals?.totalContentQty || 0);
    const newLoadedQty = sumLoadedQty(updatedPackages);
    const newReceivedQty = sumReceivedQty(updatedPackages);
    const newPendingQty = Math.max(newTotalQty - newLoadedQty, 0);

    const derivedSnapshot = buildDerivedShipmentSnapshot(updatedPackages, {
      previousStatus: oldStatus,
      totals: {
        totalQty: newTotalQty,
        receivedQty: newReceivedQty,
        loadedQty: newLoadedQty,
      },
    });

    const derivedShipmentStatus = derivedSnapshot.status;
    const reconciledPackages = derivedSnapshot.packages;

    const currentTripId = currentData.currentTripId || null;
    let tripShipmentSnap = null;
    let tripRef = null;
    let tripShipmentRef = null;

    if (currentTripId) {
      tripRef = db.collection("truck_trips").doc(currentTripId);
      tripShipmentRef = tripRef
        .collection("trip_shipments")
        .doc(shipmentId);
      tripShipmentSnap = await tx.get(tripShipmentRef);
    }

    const shipmentUpdate = {
      status: derivedShipmentStatus,
      packages: reconciledPackages,
      packageBreakdown: derivedSnapshot.packageBreakdown,
      availableForDelivery: derivedSnapshot.availableForDelivery,
      updatedAt: fv.serverTimestamp(),
      updatedBy: name,
      "totals.totalItems": reconciledPackages.length,
      "totals.totalContentQty": newTotalQty,
      "totals.loaded": newLoadedQty,
      "totals.pending": newPendingQty,
      "totals.received": newReceivedQty,
      "totals.delivered": newReceivedQty,
      statusHistory: fv.arrayUnion({
        status: derivedShipmentStatus,
        at: new Date(),
        by: name,
        note:
          remarks || `Piece ${packageId} manually set to ${normalizedStatus}`,
        packageId,
        previousPieceStatus,
      }),
      ...(derivedShipmentStatus === "COMPLETED"
        ? {
            availableForDelivery: false,
            currentLocationState: "DELIVERED",
            completedAt: fv.serverTimestamp(),
          }
        : {}),
    };

    tx.update(shipmentRef, shipmentUpdate);

    if (currentTripId && tripShipmentSnap?.exists) {
      const oldTotalQty =
        sumTotalQty(oldPackages) ||
        Number(currentData.totals?.totalContentQty || 0);
      const oldLoadedQty =
        sumLoadedQty(oldPackages) || Number(currentData.totals?.loaded || 0);
      const oldReceivedQty =
        sumReceivedQty(oldPackages) ||
        Number(currentData.totals?.received || 0);
      const oldPendingQty = Math.max(oldTotalQty - oldLoadedQty, 0);

      const deltaLoaded = newLoadedQty - oldLoadedQty;
      const deltaReceived = newReceivedQty - oldReceivedQty;
      const deltaPending = newPendingQty - oldPendingQty;

      const tripUpdate = {
        updatedAt: fv.serverTimestamp(),
        updatedBy: name,
      };

      if (deltaLoaded !== 0) {
        tripUpdate.totalLoaded = fv.increment(deltaLoaded);
      }
      if (deltaReceived !== 0) {
        tripUpdate.totalArrived = fv.increment(deltaReceived);
        tripUpdate.totalDelivered = fv.increment(deltaReceived);
      }
      if (deltaPending !== 0) {
        tripUpdate.itemPending = fv.increment(deltaPending);
      }

      tx.update(tripRef, tripUpdate);
      tx.update(tripShipmentRef, {
        status: derivedShipmentStatus,
        totalItems: newTotalQty,
        loadedCount: newLoadedQty,
        pendingCount: newPendingQty,
        deliveredCount: newReceivedQty,
        receivedCount: newReceivedQty,
        updatedAt: fv.serverTimestamp(),
        updatedBy: name,
      });
    }

    writeShipmentActionLog({
      db,
      tx,
      collection: "audit_logs",
      action: `${sourceUI}_PIECE_STATUS`,
      targetId: shipmentId,
      shipmentId,
      actorId: uid,
      actorName: name,
      actorRole: role,
      details: {
        packageId,
        previousPieceStatus,
        newPieceStatus: normalizedStatus,
        oldShipmentStatus: oldStatus,
        newShipmentStatus: derivedShipmentStatus,
        remarks: remarks || null,
      },
      createdAt: fv.serverTimestamp(),
    });

    return {
      packageId,
      previousPieceStatus,
      newPieceStatus: normalizedStatus,
      shipmentStatus: derivedShipmentStatus,
    };
  });

  return { success: true, ...result, actorRole: role };
}

module.exports = {
  OverrideShipmentPieceStatusError,
  runOverrideShipmentPieceStatus,
};
