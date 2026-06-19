"use strict";

const { FieldValue } = require("firebase-admin/firestore");
const { buildDerivedShipmentSnapshot } = require("../packages/shipmentStatus");
const {
  PACKAGE_STATUS,
  normalizePackageStatus,
  ODIONGAN_WAREHOUSE,
} = require("../packages/packageStatus");
const { normalizeQty } = require("../utilities/packageHelpers");
const {
  applyLinehaulUnloadAtHub,
  packageOnTrip,
  packageLinkedToTrip,
  getPackageIdentity,
  sumLoadedQty,
  sumReceivedQty,
  sumMissingQty,
  sumTotalQty,
} = require("../packages/tripPackageOperations");
const { resolveShipmentReference } = require("../shipments/resolveShipmentReference");
const { appendPendingAmendmentEntry } = require("./manifestAmendment");
const { writeShipmentActionLog } = require("../utilities/shipmentLogger");
const { writeCustodyAuditLog } = require("../utilities/custodyAuditLog");
const { writeShipmentEvent } = require("../tracking/writeShipmentEvent");
const { EVENT_TYPES } = require("../tracking/eventTypes");
const { MANIFEST_STATUS } = require("./manifestStatus");
const { TRIP_STATUSES } = require("./tripLifecycle");

const LOADED_ON_TRUCK_STATUSES = new Set([
  PACKAGE_STATUS.LOADED,
  PACKAGE_STATUS.LOADED_TO_TRIP,
  PACKAGE_STATUS.IN_TRANSIT,
  PACKAGE_STATUS.PARTIALLY_LOADED,
]);

const HUB_RECEIVED_STATUSES = new Set([
  PACKAGE_STATUS.ARRIVED_AT_ODIONGAN,
  PACKAGE_STATUS.AVAILABLE_AT_ODIONGAN_WAREHOUSE,
  PACKAGE_STATUS.RELEASED_FOR_DELIVERY,
  PACKAGE_STATUS.READY_FOR_DELIVERY,
]);

class RecoverFoundPackageError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

function packageMatchesLabel(pkg = {}, label = "") {
  const target = String(label || "").trim();
  if (!target) return false;
  const identity = getPackageIdentity(pkg);
  return identity === target;
}

function classifyRecoverablePiece(pkg = {}, tripId = "") {
  const status = normalizePackageStatus(pkg);
  const quantity = Math.max(normalizeQty(pkg.quantity, 1), 1);
  const receivedQty = normalizeQty(pkg.receivedQty, 0);
  const missingQty = normalizeQty(pkg.missingQty, 0);

  if (status === PACKAGE_STATUS.DELIVERED || status === PACKAGE_STATUS.CANCELLED) {
    return { recoverable: false, reason: "terminal", quantity };
  }

  if (
    status === PACKAGE_STATUS.RELEASED_FOR_DELIVERY &&
    pkg.availableForDelivery === true
  ) {
    return {
      recoverable: false,
      reason: "already_released",
      quantity,
    };
  }

  if (
    (HUB_RECEIVED_STATUSES.has(status) || pkg.hubReceivedAt) &&
    receivedQty >= quantity &&
    missingQty === 0 &&
    status !== PACKAGE_STATUS.MISSING
  ) {
    return {
      recoverable: false,
      reason: "already_received",
      quantity,
    };
  }

  if (status === PACKAGE_STATUS.MISSING || missingQty > 0) {
    return { recoverable: true, bucket: "missing", quantity };
  }

  if (LOADED_ON_TRUCK_STATUSES.has(status) && packageOnTrip(pkg, tripId)) {
    return { recoverable: true, bucket: "on_truck", quantity };
  }

  if (packageOnTrip(pkg, tripId)) {
    return { recoverable: true, bucket: "on_trip", quantity };
  }

  return { recoverable: false, reason: "not_missing_on_trip", quantity };
}

function applyFoundPackageRecovery(pkg = {}, { tripId, actorUid, actorName, nowIso }) {
  const timestamp = nowIso || new Date().toISOString();
  const quantity = Math.max(normalizeQty(pkg.quantity, 1), 1);

  let next = packageOnTrip(pkg, tripId)
    ? applyLinehaulUnloadAtHub(pkg, { tripId, nowIso: timestamp })
    : {
        ...pkg,
        quantity,
        status: PACKAGE_STATUS.ARRIVED_AT_ODIONGAN,
        loadedQty: 0,
        receivedQty: quantity,
        missingQty: 0,
        currentTripId: null,
        loadedOnTrip: null,
        hubReceivedOnTrip: tripId,
        custodyOwnerType: "WAREHOUSE",
        custodyOwnerId: ODIONGAN_WAREHOUSE,
        hubReceivedAt: timestamp,
        availableForDelivery: false,
        updatedAt: timestamp,
      };

  return {
    ...next,
    missingQty: 0,
    availableForDelivery: false,
    recoveredAt: timestamp,
    recoveredBy: actorName || actorUid || "Admin",
    recoveredByUid: actorUid || null,
    recoveredOnTrip: tripId,
    recoverySource: "SCAN_FOUND_PACKAGE",
  };
}

function shipmentHasReleasedPoolPiece(packages = []) {
  return packages.some((pkg) => {
    const status = normalizePackageStatus(pkg);
    return (
      pkg.releasedToDeliveryOpsAt ||
      (status === PACKAGE_STATUS.RELEASED_FOR_DELIVERY &&
        pkg.availableForDelivery === true)
    );
  });
}

function tripDocumentIndicatesRelease(trip = {}) {
  return Boolean(
    trip.adminOverrideReleaseAt ||
      trip.adminOverrideReleaseBy ||
      trip.reconciliationVariance?.releasedAt,
  );
}

async function resolveTripDeliveryPoolActive(
  db,
  tripId,
  { shipmentDocId = null, shipmentPackages = [] } = {},
) {
  if (shipmentHasReleasedPoolPiece(shipmentPackages)) return true;

  const tripSnap = await db.collection("truck_trips").doc(tripId).get();
  if (!tripSnap.exists) return false;
  const trip = tripSnap.data() || {};
  if (tripDocumentIndicatesRelease(trip)) return true;

  const tripShipSnap = await db
    .collection("truck_trips")
    .doc(tripId)
    .collection("trip_shipments")
    .limit(100)
    .get();

  for (const doc of tripShipSnap.docs) {
    if (shipmentDocId && doc.id === shipmentDocId) continue;
    const shipSnap = await db.collection("shipments").doc(doc.id).get();
    if (!shipSnap.exists) continue;
    const packages = shipSnap.data()?.packages || [];
    if (shipmentHasReleasedPoolPiece(packages)) return true;
  }

  return false;
}

function assertTripEligibleForRecovery(trip = {}) {
  const status = String(trip.status || "").trim().toUpperCase();
  if ([TRIP_STATUSES.COMPLETED, TRIP_STATUSES.CANCELLED].includes(status)) {
    throw new RecoverFoundPackageError(
      "failed-precondition",
      "Cannot recover packages on a completed or cancelled trip.",
    );
  }

  const manifestStatus = String(trip.manifestStatus || "").trim().toUpperCase();
  const reconciled =
    Boolean(trip.reconciledAt) ||
    manifestStatus === MANIFEST_STATUS.RECONCILED;

  if (!reconciled) {
    throw new RecoverFoundPackageError(
      "failed-precondition",
      "Trip must be reconciled before scanning found packages.",
    );
  }

  if (
    status !== TRIP_STATUSES.ARRIVED &&
    status !== "UNLOADING" &&
    status !== TRIP_STATUSES.OUT_FOR_DELIVERY
  ) {
    throw new RecoverFoundPackageError(
      "failed-precondition",
      "Trip must be at Odiongan (ARRIVED) before recovering found packages.",
    );
  }
}

async function runRecoverFoundPackage(
  db,
  {
    tripId,
    packageLabel,
    remarks = null,
    sourceUI = "TRIP_DRAWER",
    actor = {},
    fieldValue = FieldValue,
  },
) {
  const { uid, role, name } = actor;
  const fv = fieldValue || FieldValue;
  const normalizedTripId = String(tripId || "").trim();
  const label = String(packageLabel || "").trim();

  if (!normalizedTripId || !label) {
    throw new RecoverFoundPackageError(
      "invalid-argument",
      "tripId and packageLabel are required.",
    );
  }

  const resolved = await resolveShipmentReference(db, label).catch((error) => {
    const message = error?.message || "Shipment or package label not found.";
    throw new RecoverFoundPackageError("not-found", message);
  });
  const shipmentDocId = resolved.shipmentDocId;
  const packageLabelResolved = resolved.packageLabel || label;

  const tripRef = db.collection("truck_trips").doc(normalizedTripId);
  const shipmentRef = db.collection("shipments").doc(shipmentDocId);
  const tripShipmentRef = tripRef.collection("trip_shipments").doc(shipmentDocId);

  const tripDeliveryPoolActive = await resolveTripDeliveryPoolActive(
    db,
    normalizedTripId,
    { shipmentDocId },
  );

  const result = await db.runTransaction(async (tx) => {
    const [tripSnap, shipmentSnap, tripShipmentSnap] = await Promise.all([
      tx.get(tripRef),
      tx.get(shipmentRef),
      tx.get(tripShipmentRef),
    ]);

    if (!tripSnap.exists) {
      throw new RecoverFoundPackageError("not-found", "Trip not found.");
    }
    if (!shipmentSnap.exists) {
      throw new RecoverFoundPackageError("not-found", "Shipment not found.");
    }

    const trip = tripSnap.data() || {};
    assertTripEligibleForRecovery(trip);

    const shipment = shipmentSnap.data() || {};
    const tripShipment = tripShipmentSnap.exists ? tripShipmentSnap.data() : null;
    const packages = Array.isArray(shipment.packages) ? shipment.packages : [];
    const barcodeSet = new Set(
      (tripShipment?.packageBarcodes || shipment.packageBarcodes || [])
        .filter(Boolean)
        .map(String),
    );

    const pkgIndex = packages.findIndex((pkg) =>
      packageMatchesLabel(pkg, packageLabelResolved),
    );

    if (pkgIndex === -1) {
      throw new RecoverFoundPackageError(
        "not-found",
        `Package ${packageLabelResolved} not found on shipment.`,
      );
    }

    const targetPkg = packages[pkgIndex];
    const linked = packageLinkedToTrip(targetPkg, normalizedTripId, barcodeSet);

    if (!linked && !tripShipmentSnap.exists) {
      throw new RecoverFoundPackageError(
        "failed-precondition",
        "This package is not on this trip manifest.",
      );
    }

    const classification = classifyRecoverablePiece(targetPkg, normalizedTripId);
    if (!classification.recoverable) {
      if (classification.reason === "already_released") {
        throw new RecoverFoundPackageError(
          "failed-precondition",
          "Package is already in the delivery operations pool.",
        );
      }
      if (classification.reason === "already_received") {
        throw new RecoverFoundPackageError(
          "failed-precondition",
          "Package is already received at Odiongan. Release it to delivery operations if needed.",
        );
      }
      throw new RecoverFoundPackageError(
        "failed-precondition",
        "Package is not in a missing or on-truck state for this trip.",
      );
    }

    const oldPackages = packages.map((pkg) => ({ ...pkg }));
    const oldLoadedQty = sumLoadedQty(oldPackages);
    const oldReceivedQty = sumReceivedQty(oldPackages);
    const oldMissingQty = sumMissingQty(oldPackages);
    const oldTotalQty = sumTotalQty(oldPackages);

    const nowIso = new Date().toISOString();
    const updatedPackages = [...packages];
    updatedPackages[pkgIndex] = applyFoundPackageRecovery(targetPkg, {
      tripId: normalizedTripId,
      actorUid: uid,
      actorName: name,
      nowIso,
    });

    const newLoadedQty = sumLoadedQty(updatedPackages);
    const newReceivedQty = sumReceivedQty(updatedPackages);
    const newMissingQty = sumMissingQty(updatedPackages);
    const newTotalQty = sumTotalQty(updatedPackages) || oldTotalQty;
    const newPendingQty = Math.max(newTotalQty - newLoadedQty, 0);

    const derivedSnapshot = buildDerivedShipmentSnapshot(updatedPackages, {
      previousStatus: shipment.status,
      totals: {
        totalQty: newTotalQty,
        receivedQty: newReceivedQty,
        loadedQty: newLoadedQty,
        missingQty: newMissingQty,
      },
    });

    tx.update(shipmentRef, {
      status: derivedSnapshot.status,
      packages: derivedSnapshot.packages,
      packageBreakdown: derivedSnapshot.packageBreakdown,
      availableForDelivery: derivedSnapshot.availableForDelivery,
      currentTripId: shipment.currentTripId || normalizedTripId,
      updatedAt: fv.serverTimestamp(),
      updatedBy: name,
      "totals.totalItems": derivedSnapshot.packages.length,
      "totals.totalContentQty": newTotalQty,
      "totals.loaded": newLoadedQty,
      "totals.pending": newPendingQty,
      "totals.received": newReceivedQty,
      "totals.delivered": newReceivedQty,
      "totals.missing": newMissingQty,
      statusHistory: fv.arrayUnion({
        status: derivedSnapshot.status,
        at: new Date(),
        by: name,
        note:
          remarks ||
          `Found package ${packageLabelResolved} recovered at Odiongan warehouse.`,
        packageId: packageLabelResolved,
        recoverySource: "SCAN_FOUND_PACKAGE",
      }),
    });

    if (tripShipmentSnap.exists) {
      const qty = classification.quantity;
      const tripLoadedBefore = normalizeQty(tripShipment.loadedCount, 0);
      const tripReceivedBefore = normalizeQty(
        tripShipment.receivedCount ?? tripShipment.deliveredCount,
        0,
      );
      const tripMissingBefore = normalizeQty(tripShipment.missingCount, 0);

      let loadedCount = tripLoadedBefore;
      let receivedCount = tripReceivedBefore;
      let missingCount = tripMissingBefore;

      if (classification.bucket === "on_truck") {
        loadedCount = Math.max(loadedCount - qty, 0);
      }
      if (
        classification.bucket === "missing" ||
        classification.bucket === "on_truck" ||
        classification.bucket === "on_trip"
      ) {
        receivedCount += qty;
        missingCount = Math.max(missingCount - qty, 0);
      }

      const tripShipmentUpdate = {
        status: derivedSnapshot.status,
        totalItems: newTotalQty,
        loadedCount,
        receivedCount,
        deliveredCount: receivedCount,
        pendingCount: newPendingQty,
        missingCount,
        updatedAt: fv.serverTimestamp(),
        updatedBy: name,
      };

      if (!barcodeSet.has(packageLabelResolved)) {
        tripShipmentUpdate.packageBarcodes = fv.arrayUnion(packageLabelResolved);
      }

      tx.update(tripShipmentRef, tripShipmentUpdate);

      const deltaLoaded = loadedCount - tripLoadedBefore;
      const deltaReceived = receivedCount - tripReceivedBefore;
      const deltaMissing = missingCount - tripMissingBefore;

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
      if (deltaMissing !== 0) {
        tripUpdate.totalMissing = fv.increment(deltaMissing);
      }
      if (classification.bucket === "missing" || classification.bucket === "on_truck") {
        tripUpdate.recoveredPackageCount = fv.increment(1);
        tripUpdate.lastRecoveredPackageAt = fv.serverTimestamp();
      }

      tx.update(tripRef, tripUpdate);
    }

    appendPendingAmendmentEntry(
      tx,
      tripRef,
      trip,
      {
        changeType: "FOUND_RECOVERED",
        shipmentId: shipment.shipmentId || shipmentDocId,
        shipmentDocId,
        packageId: packageLabelResolved,
        reason:
          remarks ||
          `Physically found at Odiongan after reconciliation (${classification.bucket}).`,
        recordedBy: uid,
        recordedByName: name,
      },
      fv,
    );

    writeShipmentActionLog({
      db,
      tx,
      collection: "audit_logs",
      action: `${sourceUI}_RECOVER_FOUND_PACKAGE`,
      targetId: shipmentDocId,
      shipmentId: shipmentDocId,
      tripId: trip.tripId || normalizedTripId,
      actorId: uid,
      actorName: name,
      actorRole: role,
      details: {
        packageId: packageLabelResolved,
        tripDocId: normalizedTripId,
        previousBucket: classification.bucket,
        oldLoadedQty,
        newLoadedQty,
        oldReceivedQty,
        newReceivedQty,
        oldMissingQty,
        newMissingQty,
        remarks: remarks || null,
      },
      createdAt: fv.serverTimestamp(),
    });

    writeCustodyAuditLog({
      db,
      tx,
      action: "PACKAGE_FOUND_RECOVERED",
      targetCollection: "shipments",
      targetId: shipmentDocId,
      tripId: trip.tripId || normalizedTripId,
      tripDocId: normalizedTripId,
      actorId: uid,
      actorName: name,
      actorRole: role,
      reason:
        remarks ||
        `Found package ${packageLabelResolved} recovered at Odiongan.`,
      previousValue: targetPkg.status || null,
      newValue: PACKAGE_STATUS.ARRIVED_AT_ODIONGAN,
      meta: {
        packageId: packageLabelResolved,
        bucket: classification.bucket,
      },
      fieldValue: fv,
    });

    return {
      packageId: packageLabelResolved,
      shipmentDocId,
      shipmentId: shipment.shipmentId || shipmentDocId,
      shipmentStatus: derivedSnapshot.status,
      tripDeliveryPoolActive,
      counters: {
        loaded: { before: oldLoadedQty, after: newLoadedQty },
        received: { before: oldReceivedQty, after: newReceivedQty },
        missing: { before: oldMissingQty, after: newMissingQty },
      },
    };
  });

  await writeShipmentEvent({
    db,
    fieldValue: fv,
    event: {
      shipmentId: shipmentDocId,
      eventType: EVENT_TYPES.ARRIVED_ODIONGAN,
      packageId: result.packageId,
      tripId: normalizedTripId,
      remarks:
        remarks ||
        `Found package ${result.packageId} scanned at Odiongan warehouse.`,
      createdBy: uid || null,
      createdByRole: role || "admin",
      source: "recover_found_package",
    },
  });

  return {
    success: true,
    ...result,
    actorRole: role,
  };
}

module.exports = {
  RecoverFoundPackageError,
  runRecoverFoundPackage,
  classifyRecoverablePiece,
  applyFoundPackageRecovery,
};
