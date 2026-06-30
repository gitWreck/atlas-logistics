"use strict";

const { FieldValue } = require("firebase-admin/firestore");
const { buildDerivedShipmentSnapshot } = require("../packages/shipmentStatus");
const {
  PACKAGE_STATUS,
  DELIVERED_STATUSES,
  WAREHOUSE_POOL_STATUSES,
  ODIONGAN_WAREHOUSE,
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

const LINEHAUL_ON_TRUCK_STATUSES = new Set([
  PACKAGE_STATUS.IN_TRANSIT,
  PACKAGE_STATUS.LOADED_TO_TRIP,
  PACKAGE_STATUS.LOADED,
  PACKAGE_STATUS.PARTIALLY_LOADED,
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

const HUB_RECEIVED_STATUSES = new Set([
  PACKAGE_STATUS.ARRIVED_AT_ODIONGAN,
  PACKAGE_STATUS.AVAILABLE_AT_ODIONGAN_WAREHOUSE,
  PACKAGE_STATUS.AVAILABLE_AT_WAREHOUSE,
]);

const OUT_FOR_DELIVERY_STATUSES = new Set([PACKAGE_STATUS.OUT_FOR_DELIVERY]);

const ALLOWED_OVERRIDE_PIECE_STATUSES = new Set(Object.values(PACKAGE_STATUS));

function packageMatchesId(pkg = {}, packageId = "") {
  const target = String(packageId || "").trim();
  if (!target) return false;
  return getPackageIdentity(pkg) === target;
}

function resolveTripId(pkg = {}, shipment = {}) {
  return (
    String(pkg.loadedOnTrip || "").trim() ||
    String(pkg.currentTripId || "").trim() ||
    String(pkg.hubReceivedOnTrip || "").trim() ||
    String(shipment.currentTripId || "").trim() ||
    null
  );
}

function clearCheckerCustody() {
  return {
    loadedByCheckerId: null,
    loadedByCheckerName: null,
    loadedAt: null,
    outForDeliveryAt: null,
    deliveryManifestId: null,
    deliveryVehicleId: null,
    deliveryVehicleName: null,
  };
}

function clearHubReceive() {
  return {
    hubReceivedAt: null,
    hubReceivedOnTrip: null,
    receivedBy: null,
    releasedToDeliveryOpsAt: null,
  };
}

function clearDelivery() {
  return {
    deliveredAt: null,
  };
}

function clearTripLink() {
  return {
    currentTripId: null,
    loadedOnTrip: null,
    loadedAt: null,
    loadedAtLocation: null,
    loadedBy: null,
  };
}

/**
 * Admin overrides must sync quantities, custody, and trip/hub markers — not just status text.
 */
function applyAdminPieceStatusOverride(
  pkg = {},
  newStatus,
  { actorUid = null, actorName = null, shipment = {} } = {},
) {
  const status = String(newStatus || "").trim().toUpperCase();
  const quantity = Math.max(normalizeQty(pkg.quantity, 1), 1);
  const nowIso = new Date().toISOString();
  const tripId = resolveTripId(pkg, shipment);

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
      ...clearCheckerCustody(),
      loadedQty: 0,
      receivedQty: quantity,
      missingQty: 0,
      damagedQty: 0,
      deliveredAt: nowIso,
      availableForDelivery: false,
      outForDeliveryAt: pkg.outForDeliveryAt || nowIso,
      custodyOwnerType: pkg.custodyOwnerType || "CHECKER",
      custodyOwnerId: pkg.custodyOwnerId || pkg.loadedByCheckerId || actorUid || null,
    };
  }

  if (status === PACKAGE_STATUS.MISSING) {
    return {
      ...next,
      ...clearCheckerCustody(),
      ...clearHubReceive(),
      ...clearDelivery(),
      ...clearTripLink(),
      loadedQty: 0,
      receivedQty: 0,
      missingQty: quantity,
      damagedQty: 0,
      availableForDelivery: false,
      custodyOwnerType: "TRIP",
      custodyOwnerId: tripId,
    };
  }

  if (status === PACKAGE_STATUS.FAILED_DELIVERY) {
    return {
      ...next,
      loadedQty: quantity,
      receivedQty: 0,
      missingQty: 0,
      availableForDelivery: false,
      custodyOwnerType: "CHECKER",
      custodyOwnerId: pkg.loadedByCheckerId || actorUid || null,
      loadedByCheckerId: pkg.loadedByCheckerId || actorUid || null,
      loadedByCheckerName: pkg.loadedByCheckerName || actorName || null,
    };
  }

  if (WAREHOUSE_POOL_STATUSES.has(status)) {
    return {
      ...next,
      ...clearCheckerCustody(),
      ...clearDelivery(),
      ...clearTripLink(),
      loadedQty: 0,
      receivedQty: quantity,
      missingQty: 0,
      damagedQty: 0,
      availableForDelivery: true,
      custodyOwnerType: "WAREHOUSE",
      custodyOwnerId: ODIONGAN_WAREHOUSE,
      hubReceivedAt: pkg.hubReceivedAt || nowIso,
      hubReceivedOnTrip: pkg.hubReceivedOnTrip || tripId,
      releasedToDeliveryOpsAt:
        status === PACKAGE_STATUS.RELEASED_FOR_DELIVERY
          ? pkg.releasedToDeliveryOpsAt || nowIso
          : pkg.releasedToDeliveryOpsAt || null,
    };
  }

  if (HUB_RECEIVED_STATUSES.has(status)) {
    return {
      ...next,
      ...clearCheckerCustody(),
      ...clearDelivery(),
      ...clearTripLink(),
      loadedQty: 0,
      receivedQty: quantity,
      missingQty: 0,
      damagedQty: 0,
      availableForDelivery: false,
      custodyOwnerType: "WAREHOUSE",
      custodyOwnerId: ODIONGAN_WAREHOUSE,
      hubReceivedAt: pkg.hubReceivedAt || nowIso,
      hubReceivedOnTrip: pkg.hubReceivedOnTrip || tripId,
    };
  }

  if (OUT_FOR_DELIVERY_STATUSES.has(status) || ON_CHECKER_VAN_STATUSES.has(status)) {
    const checkerId = pkg.loadedByCheckerId || actorUid || null;
    const ofd = OUT_FOR_DELIVERY_STATUSES.has(status);
    return {
      ...next,
      ...clearDelivery(),
      ...clearTripLink(),
      loadedQty: quantity,
      receivedQty: 0,
      missingQty: 0,
      damagedQty: 0,
      availableForDelivery: false,
      custodyOwnerType: "CHECKER",
      custodyOwnerId: checkerId,
      loadedByCheckerId: checkerId,
      loadedByCheckerName: pkg.loadedByCheckerName || actorName || null,
      loadedAt: pkg.loadedAt || nowIso,
      outForDeliveryAt: ofd ? pkg.outForDeliveryAt || nowIso : null,
      hubReceivedAt: pkg.hubReceivedAt || nowIso,
      hubReceivedOnTrip: pkg.hubReceivedOnTrip || tripId,
    };
  }

  if (LINEHAUL_ON_TRUCK_STATUSES.has(status) || IN_TRANSIT_STATUSES.has(status)) {
    const activeTripId = tripId;
    return {
      ...next,
      ...clearCheckerCustody(),
      ...clearHubReceive(),
      ...clearDelivery(),
      loadedQty: quantity,
      receivedQty: 0,
      missingQty: 0,
      damagedQty: 0,
      availableForDelivery: false,
      custodyOwnerType: "TRIP",
      custodyOwnerId: activeTripId,
      currentTripId: activeTripId,
      loadedOnTrip: activeTripId,
      loadedAt: pkg.loadedAt || nowIso,
      loadedBy: pkg.loadedBy || actorName || actorUid || activeTripId,
    };
  }

  if (LOADED_STATUSES.has(status)) {
    const activeTripId = tripId;
    return {
      ...next,
      ...clearCheckerCustody(),
      ...clearHubReceive(),
      ...clearDelivery(),
      loadedQty: quantity,
      receivedQty: 0,
      missingQty: 0,
      damagedQty: 0,
      availableForDelivery: false,
      custodyOwnerType: "TRIP",
      custodyOwnerId: activeTripId,
      currentTripId: activeTripId,
      loadedOnTrip: activeTripId,
      loadedAt: pkg.loadedAt || nowIso,
    };
  }

  if (
    status === PACKAGE_STATUS.RECEIVED ||
    status === PACKAGE_STATUS.RECEIVED_AT_DIVISORIA
  ) {
    return {
      ...next,
      ...clearCheckerCustody(),
      ...clearHubReceive(),
      ...clearDelivery(),
      ...clearTripLink(),
      loadedQty: 0,
      receivedQty: 0,
      missingQty: 0,
      damagedQty: 0,
      availableForDelivery: false,
      custodyOwnerType: "WAREHOUSE",
      custodyOwnerId: "DIVISORIA_WAREHOUSE",
    };
  }

  if (status === PACKAGE_STATUS.CANCELLED) {
    return {
      ...next,
      ...clearCheckerCustody(),
      ...clearHubReceive(),
      ...clearDelivery(),
      ...clearTripLink(),
      loadedQty: 0,
      receivedQty: 0,
      missingQty: 0,
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

function sumMissingQty(packages = []) {
  return packages.reduce((sum, pkg) => {
    const quantity = normalizeQty(pkg.quantity, 1);
    if (pkg.status === "MISSING") return sum + quantity;
    return sum + Math.min(normalizeQty(pkg.missingQty, 0), quantity);
  }, 0);
}

function sumTotalQty(packages = []) {
  return packages.reduce(
    (sum, pkg) => sum + normalizeQty(pkg.quantity, 1),
    0,
  );
}

function resolveTripIdForSync(pkg = {}, shipment = {}) {
  return resolveTripId(pkg, shipment);
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
      { actorUid: uid, actorName: name, shipment: currentData },
    );

    const newTotalQty =
      sumTotalQty(updatedPackages) ||
      Number(currentData.totals?.totalContentQty || 0);
    const newLoadedQty = sumLoadedQty(updatedPackages);
    const newReceivedQty = sumReceivedQty(updatedPackages);
    const newMissingQty = sumMissingQty(updatedPackages);
    const newPendingQty = Math.max(
      newTotalQty - newLoadedQty - newReceivedQty - newMissingQty,
      0,
    );

    const derivedSnapshot = buildDerivedShipmentSnapshot(updatedPackages, {
      previousStatus: oldStatus,
      totals: {
        totalQty: newTotalQty,
        receivedQty: newReceivedQty,
        loadedQty: newLoadedQty,
        missingQty: newMissingQty,
      },
    });

    const derivedShipmentStatus = derivedSnapshot.status;
    const reconciledPackages = derivedSnapshot.packages;

    const syncTripId =
      resolveTripIdForSync(updatedPackages[pkgIndex], currentData) ||
      String(currentData.currentTripId || "").trim() ||
      null;

    let tripShipmentSnap = null;
    let tripRef = null;
    let tripShipmentRef = null;

    if (syncTripId) {
      tripRef = db.collection("truck_trips").doc(syncTripId);
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
      "totals.missing": newMissingQty,
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

    if (syncTripId && tripShipmentSnap?.exists) {
      const oldTotalQty =
        sumTotalQty(oldPackages) ||
        Number(currentData.totals?.totalContentQty || 0);
      const oldLoadedQty =
        sumLoadedQty(oldPackages) || Number(currentData.totals?.loaded || 0);
      const oldReceivedQty =
        sumReceivedQty(oldPackages) ||
        Number(currentData.totals?.received || 0);
      const oldMissingQty =
        sumMissingQty(oldPackages) ||
        Number(currentData.totals?.missing || 0);
      const oldPendingQty = Math.max(
        oldTotalQty - oldLoadedQty - oldReceivedQty - oldMissingQty,
        0,
      );

      const deltaLoaded = newLoadedQty - oldLoadedQty;
      const deltaReceived = newReceivedQty - oldReceivedQty;
      const deltaMissing = newMissingQty - oldMissingQty;
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
        missingCount: newMissingQty,
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
  applyAdminPieceStatusOverride,
};
