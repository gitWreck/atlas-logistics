"use strict";

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const { FieldValue } = admin.firestore;
const { requireRole, updatedBy } = require("../utilities/helpers");
const { normalizeQty } = require("../utilities/packageHelpers");
const { writeShipmentActionLog } = require("../utilities/shipmentLogger");
const { writeCustodyAuditLog } = require("../utilities/custodyAuditLog");
const {
  packageLinkedToTrip,
  getPackageIdentity,
  buildShipmentSnapshot,
} = require("../packages/tripPackageOperations");
const {
  PACKAGE_STATUS,
  DIVISORIA_WAREHOUSE,
  normalizePackageStatus,
} = require("../packages/packageStatus");
const { appendPendingAmendmentEntry } = require("./manifestAmendment");
const {
  classifyPieceForTripCounters,
} = require("./tripShipmentCounters");

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

function resetPackageToDivisoria(pkg = {}, actorName = null, nowIso) {
  return {
    ...pkg,
    status: PACKAGE_STATUS.RECEIVED_AT_DIVISORIA,
    loadedQty: 0,
    receivedQty: 0,
    missingQty: 0,
    damagedQty: 0,
    availableForDelivery: false,

    currentTripId: null,
    loadedOnTrip: null,
    loadedAt: null,
    loadedAtLocation: null,
    loadedBy: null,
    loadedByUid: null,
    loadedByRole: null,

    hubReceivedAt: null,
    hubReceivedOnTrip: null,
    hubReceivedByName: null,
    receivedBy: null,
    releasedToDeliveryOpsAt: null,

    custodyOwnerType: "WAREHOUSE",
    custodyOwnerId: DIVISORIA_WAREHOUSE,
    currentLocationState: "RECEIVED_AT_DIVISORIA",

    assignedRouteId: null,
    assignedRouteName: null,
    suggestedRouteId: null,
    suggestedRouteName: null,
    routeAssignedAt: null,
    routeAssignedBy: null,
    assignedCheckerId: null,
    assignedCheckerName: null,
    checkerAssignedAt: null,
    assignedVehicleId: null,
    assignedVehicleName: null,
    loadedByCheckerId: null,
    loadedByCheckerName: null,
    outForDeliveryAt: null,
    deliveryManifestId: null,
    deliveryVehicleId: null,
    deliveryVehicleName: null,

    deliveredAt: null,
    deliveredBy: null,
    deliveredByCheckerId: null,
    deliveredByCheckerName: null,
    failedDeliveryAt: null,
    failedDeliveryReason: null,
    proofPhotoUrl: null,
    podPhotoUrl: null,
    podUrl: null,

    updatedAt: nowIso,
    updatedBy: actorName,
  };
}

function remainingValue(packages = [], field) {
  return (
    packages
      .map((pkg) => pkg?.[field])
      .find((value) => value !== null && value !== undefined && value !== "") ||
    null
  );
}

function subtractCounter(trip = {}, field, amount) {
  return Math.max(normalizeQty(trip[field], 0) - normalizeQty(amount, 0), 0);
}

/* ======================================================
   UNASSIGN SHIPMENT FROM TRUCK TRIP (OPTION B — CANONICAL)
====================================================== */
exports.unassignShipmentFromTrip = onCall(
  { region: "asia-southeast1", maxInstances: 10 },
  async (req) => {
    const actor = await requireRole(db, req, ["admin", "manager"]);

    const {
      trackingShipmentId,
      tripId,
      packageId: requestedPackageIdRaw,
      // updatedBy
    } = req.data || {};
    if (!trackingShipmentId || typeof trackingShipmentId !== "string") {
      throw new HttpsError("invalid-argument", "trackingShipmentId required");
    }
    if (!tripId || typeof tripId !== "string") {
      throw new HttpsError("invalid-argument", "tripId required");
    }
    const requestedPackageId = String(requestedPackageIdRaw || "").trim();

    const { uid, role, name } = updatedBy(req);

    const userSnap = await db.collection("users").doc(req.auth.uid).get();
    if (!userSnap.exists || userSnap.data().active !== true) {
      throw new HttpsError("permission-denied", "Inactive user");
    }
    // const role = userSnap.data().role;

    const trackingRef = db.collection("shipments").doc(trackingShipmentId);
    const tripRef = db.collection("truck_trips").doc(tripId);
    const shipRef = tripRef
      .collection("trip_shipments")
      .doc(trackingShipmentId);
    let manifestRemoved = false;

    await db.runTransaction(async (tx) => {
      const [trackingSnap, tripSnap, shipSnap] = await Promise.all([
        tx.get(trackingRef),
        tx.get(tripRef),
        tx.get(shipRef),
      ]);

      if (!trackingSnap.exists) {
        throw new HttpsError("not-found", "Tracking record not found");
      }
      if (!tripSnap.exists) {
        throw new HttpsError("not-found", "Truck trip not found");
      }
      if (!shipSnap.exists) {
        if (trackingSnap.data()?.currentTripId === tripId) {
          throw new HttpsError(
            "failed-precondition",
            "Trip shipment record is missing. Cannot safely unassign this shipment.",
          );
        }

        // Already detached from this trip.
        return;
      }

      const tracking = trackingSnap.data() || {};
      const trip = tripSnap.data() || {};
      const tripShipment = shipSnap.data() || {};
      const protectedTrip =
        trip.manifestLocked === true ||
        trip.active === false ||
        ["COMPLETED", "DELIVERED"].includes(
          String(trip.status || "").toUpperCase(),
        );

      if (protectedTrip && actor.role !== "admin") {
        throw new HttpsError(
          "permission-denied",
          "Only an Admin can remove shipments from a locked, inactive, or completed trip.",
        );
      }

      const packageBarcodes = new Set(
        Array.isArray(tripShipment.packageBarcodes)
          ? tripShipment.packageBarcodes.map(String)
          : [],
      );
      const scannedPackageIds = new Set(
        Array.isArray(tripShipment.scannedPackageIds)
          ? tripShipment.scannedPackageIds.map(String)
          : [],
      );
      const targetPackage = requestedPackageId
        ? (tracking.packages || []).find(
            (pkg) => getPackageIdentity(pkg) === requestedPackageId,
          )
        : null;

      if (requestedPackageId && !targetPackage) {
        throw new HttpsError("not-found", "Package not found in shipment");
      }
      if (
        targetPackage &&
        !packageLinkedToTrip(targetPackage, tripId, packageBarcodes, {
          scannedPackageIds,
        })
      ) {
        throw new HttpsError(
          "failed-precondition",
          "Package is not linked to this trip.",
        );
      }

      // ======================================================
      // 1. CALCULATE VALUES TO REMOVE (The Subtraction Logic)
      // ======================================================
      const pieceCounter = targetPackage
        ? classifyPieceForTripCounters(targetPackage)
        : null;
      const pieceQty = targetPackage
        ? Math.max(normalizeQty(targetPackage.quantity, 1), 1)
        : 0;
      const removeTotal = targetPackage
        ? pieceQty
        : normalizeQty(tripShipment.totalItems, 0);
      const removePending = targetPackage
        ? pieceCounter.bucket === "unknown"
          ? pieceQty
          : 0
        : normalizeQty(tripShipment.pendingCount, 0);
      const removeLoaded = targetPackage
        ? pieceCounter.bucket === "loaded"
          ? pieceCounter.qty
          : 0
        : normalizeQty(tripShipment.loadedCount, 0);
      const removeDelivered = targetPackage
        ? pieceCounter.bucket === "received"
          ? pieceCounter.qty
          : 0
        : normalizeQty(
            tripShipment.deliveredCount ?? tripShipment.receivedCount ?? 0,
          );
      const removeMissing = targetPackage
        ? pieceCounter.bucket === "missing"
          ? pieceCounter.qty
          : 0
        : normalizeQty(tripShipment.missingCount, 0);
      const removeDamaged = targetPackage
        ? pieceCounter.bucket === "damaged"
          ? pieceCounter.qty
          : 0
        : normalizeQty(tripShipment.damagedCount, 0);
      const remainingManifestTotal = Math.max(
        normalizeQty(tripShipment.totalItems, 0) - removeTotal,
        0,
      );
      const pieceRemovalKeepsManifest =
        Boolean(requestedPackageId) && remainingManifestTotal > 0;

      const now = FieldValue.serverTimestamp();
      const nowTs = admin.firestore.Timestamp.now();
      const nowIso = new Date().toISOString();

      const packagesBeingRemoved = (tracking.packages || []).filter((pkg) => {
        const packageId = getPackageIdentity(pkg);
        return requestedPackageId
          ? packageId === requestedPackageId
          : packageLinkedToTrip(pkg, tripId, packageBarcodes, {
              scannedPackageIds,
            });
      });
      const removedPackageIdList = packagesBeingRemoved
        .map(getPackageIdentity)
        .filter(Boolean);

      // ======================================================
      // 2. UPDATE TRUCK TRIP (Subtract Everything)
      // ======================================================
      // We subtract ALL counters that this shipment contributed to the trip
      const removedEntry = {
        shipmentDocId: trackingShipmentId,
        shipmentId: tracking.shipmentId || trackingShipmentId,
        packageId: requestedPackageId || null,
        packageIds: removedPackageIdList,
        recipientName: tracking.recipient?.name || null,
        destinationCity: tracking.recipient?.address?.city || null,
        reason: requestedPackageId
          ? `Package ${requestedPackageId} removed from trip and reset to Received at Divisoria.`
          : "Shipment removed from trip and reset to Received at Divisoria.",
        removedAt: nowTs,
        removedBy: uid,
        removedByName: name || null,
      };

      tx.update(tripRef, {
        totalItems: subtractCounter(trip, "totalItems", removeTotal),
        itemPending: subtractCounter(trip, "itemPending", removePending),
        totalLoaded: subtractCounter(trip, "totalLoaded", removeLoaded),
        totalDelivered: subtractCounter(trip, "totalDelivered", removeDelivered),
        totalArrived: subtractCounter(trip, "totalArrived", removeDelivered),
        totalMissing: subtractCounter(trip, "totalMissing", removeMissing),
        totalDamaged: subtractCounter(trip, "totalDamaged", removeDamaged),
        removedManifestEntries: FieldValue.arrayUnion(removedEntry),
        updatedAt: now,
        updatedBy: name,
      });

      // ======================================================
      // 3. RESET SHIPMENT & PACKAGES
      // ======================================================
      const resetPackageIds = [];
      let resetPackageCount = 0;
      const resetDeliveryManifestIds = new Set();
      const resetPackageIdsByManifest = new Map();

      // Only reset pieces represented by this trip; pieces on other trips stay intact.
      const updatedPackages = (tracking.packages || []).map((pkg) => {
        const packageId = getPackageIdentity(pkg);
        const shouldReset = requestedPackageId
          ? packageId === requestedPackageId
          : packageLinkedToTrip(pkg, tripId, packageBarcodes, {
              scannedPackageIds,
            });
        if (!shouldReset) {
          return pkg;
        }

        resetPackageCount += 1;
        if (packageId) resetPackageIds.push(packageId);
        if (pkg.deliveryManifestId) {
          const manifestId = String(pkg.deliveryManifestId);
          resetDeliveryManifestIds.add(manifestId);
          if (!resetPackageIdsByManifest.has(manifestId)) {
            resetPackageIdsByManifest.set(manifestId, []);
          }
          if (packageId) {
            resetPackageIdsByManifest.get(manifestId).push(packageId);
          }
        }
        return resetPackageToDivisoria(pkg, name, nowIso);
      });

      if (tracking.deliveryManifestId && resetPackageIds.length > 0) {
        const rootManifestId = String(tracking.deliveryManifestId);
        resetDeliveryManifestIds.add(rootManifestId);
        if (!resetPackageIdsByManifest.has(rootManifestId)) {
          resetPackageIdsByManifest.set(rootManifestId, [...resetPackageIds]);
        }
      }

      const snapshot = buildShipmentSnapshot(updatedPackages, {
        previousStatus: "",
      });
      const shipmentStatus = snapshot.status;

      const activeTripIds = pieceRemovalKeepsManifest
        ? [
            ...new Set([
              ...(snapshot.currentTripIds || []),
              String(tripId),
            ]),
          ]
        : snapshot.currentTripIds || [];
      const singleCurrentTripId =
        activeTripIds.length === 1 ? activeTripIds[0] : null;
      const hasDeliveredPieces = snapshot.packages.some((pkg) =>
        ["DELIVERED", "COMPLETED"].includes(normalizePackageStatus(pkg)),
      );
      const hasNonDivisoriaPieces = snapshot.packages.some(
        (pkg) =>
          normalizePackageStatus(pkg) !==
          PACKAGE_STATUS.RECEIVED_AT_DIVISORIA,
      );

      tx.update(trackingRef, {
        currentTripId: singleCurrentTripId,
        currentTripIds: activeTripIds,
        assignedToTripAt: singleCurrentTripId ? tracking.assignedToTripAt || now : null,
        status: shipmentStatus,
        packageBreakdown: snapshot.packageBreakdown,
        availableForDelivery: snapshot.packageBreakdown?.available > 0,

        "totals.pending": snapshot.totals.pending,
        "totals.loaded": snapshot.totals.loaded,
        "totals.delivered": snapshot.totals.delivered,
        "totals.received": snapshot.totals.received,
        "totals.missing": snapshot.totals.missing,
        "totals.damaged": snapshot.totals.damaged,
        "totals.totalContentQty": snapshot.totals.totalContentQty,
        "totals.totalItems": snapshot.totals.totalItems,

        packages: snapshot.packages,

        assignedRouteId: remainingValue(snapshot.packages, "assignedRouteId"),
        assignedRouteName: remainingValue(snapshot.packages, "assignedRouteName"),
        suggestedRouteId: remainingValue(snapshot.packages, "suggestedRouteId"),
        suggestedRouteName: remainingValue(snapshot.packages, "suggestedRouteName"),
        routeAssignedAt: remainingValue(snapshot.packages, "routeAssignedAt"),
        routeAssignedBy: remainingValue(snapshot.packages, "routeAssignedBy"),
        assignedCheckerId: remainingValue(snapshot.packages, "assignedCheckerId"),
        assignedCheckerName: remainingValue(snapshot.packages, "assignedCheckerName"),
        assignedVehicleId: remainingValue(snapshot.packages, "assignedVehicleId"),
        assignedVehicleName: remainingValue(snapshot.packages, "assignedVehicleName"),
        deliveryManifestId: remainingValue(snapshot.packages, "deliveryManifestId"),
        deliveryVehicleId: remainingValue(snapshot.packages, "deliveryVehicleId"),
        deliveryVehicleName: remainingValue(snapshot.packages, "deliveryVehicleName"),
        custodyOwnerType: hasNonDivisoriaPieces
          ? tracking.custodyOwnerType || null
          : "WAREHOUSE",
        custodyOwnerId: hasNonDivisoriaPieces
          ? tracking.custodyOwnerId || null
          : DIVISORIA_WAREHOUSE,
        currentLocationState: hasNonDivisoriaPieces
          ? tracking.currentLocationState || null
          : "RECEIVED_AT_DIVISORIA",
        releasedAt: hasNonDivisoriaPieces ? tracking.releasedAt || null : null,
        releasedByUid: hasNonDivisoriaPieces
          ? tracking.releasedByUid || null
          : null,
        releasedByName: hasNonDivisoriaPieces
          ? tracking.releasedByName || null
          : null,
        outForDeliveryAt: hasNonDivisoriaPieces
          ? tracking.outForDeliveryAt || null
          : null,
        deliveredAt: hasDeliveredPieces ? tracking.deliveredAt || null : null,
        deliveredBy: hasDeliveredPieces ? tracking.deliveredBy || null : null,
        failedDeliveryAt: hasNonDivisoriaPieces
          ? tracking.failedDeliveryAt || null
          : null,
        failedDeliveryReason: hasNonDivisoriaPieces
          ? tracking.failedDeliveryReason || null
          : null,
        proofOfDelivery: hasDeliveredPieces
          ? tracking.proofOfDelivery || null
          : null,

        updatedAt: now,
        updatedBy: name,
        updatedRole: role,

        // Append History
        statusHistory: FieldValue.arrayUnion({
          status: shipmentStatus,
          at: nowTs,
          by: name,
          note: `Unassigned from trip ${tripId}`,
        }),
      });

      for (const manifestId of resetDeliveryManifestIds) {
        const manifestRef = db.collection("delivery_manifests").doc(manifestId);
        const manifestPackageIds = resetPackageIdsByManifest.get(manifestId) || [];
        const shipmentStillOnManifest =
          snapshot.packages.some(
            (pkg) => String(pkg.deliveryManifestId || "") === manifestId,
          ) ||
          (String(tracking.deliveryManifestId || "") === manifestId &&
            resetPackageCount < snapshot.packages.length);
        tx.set(
          manifestRef,
          {
            ...(!shipmentStillOnManifest
              ? { shipmentIds: FieldValue.arrayRemove(trackingShipmentId) }
              : {}),
            ...(manifestPackageIds.length > 0
              ? { packageIds: FieldValue.arrayRemove(...manifestPackageIds) }
              : {}),
            updatedAt: now,
            updatedBy: name,
          },
          { merge: true },
        );
      }

      // ======================================================
      // 4. CLEANUP & LOGS
      // ======================================================
      if (requestedPackageId && remainingManifestTotal > 0) {
        tx.update(shipRef, {
          totalItems: remainingManifestTotal,
          pendingCount: subtractCounter(
            tripShipment,
            "pendingCount",
            removePending,
          ),
          loadedCount: subtractCounter(
            tripShipment,
            "loadedCount",
            removeLoaded,
          ),
          deliveredCount: subtractCounter(
            tripShipment,
            "deliveredCount",
            removeDelivered,
          ),
          receivedCount: subtractCounter(
            tripShipment,
            "receivedCount",
            removeDelivered,
          ),
          missingCount: subtractCounter(
            tripShipment,
            "missingCount",
            removeMissing,
          ),
          damagedCount: subtractCounter(
            tripShipment,
            "damagedCount",
            removeDamaged,
          ),
          packageBarcodes: FieldValue.arrayRemove(requestedPackageId),
          scannedPackageIds: FieldValue.arrayRemove(requestedPackageId),
          removedPackageIds: FieldValue.arrayUnion(requestedPackageId),
          customAddedPackageIds: FieldValue.arrayRemove(requestedPackageId),
          removedPackageEntries: FieldValue.arrayUnion({
            packageId: requestedPackageId,
            removedBy: uid,
            removedByName: name || null,
            removedAt: nowTs,
          }),
          updatedAt: now,
          updatedBy: name,
        });
      } else {
        tx.delete(shipRef);
        manifestRemoved = true;
      }

      appendPendingAmendmentEntry(
        tx,
        tripRef,
        trip,
        {
          changeType: "REMOVED",
          shipmentId: tracking.shipmentId || trackingShipmentId,
          shipmentDocId: trackingShipmentId,
          packageId: requestedPackageId || null,
          reason: requestedPackageId
            ? `Package ${requestedPackageId} removed from trip and reset to Received at Divisoria.`
            : "Shipment removed from trip and reset to Received at Divisoria.",
          recordedBy: uid,
          recordedByName: name || null,
        },
        FieldValue,
      );

      tx.set(trackingRef.collection("status_events").doc(), {
        type: requestedPackageId
          ? "UNASSIGN_PACKAGE_FROM_TRIP"
          : "UNASSIGN_FROM_TRIP",
        message: requestedPackageId
          ? `Package ${requestedPackageId} removed from trip ${trip.tripId || tripId}`
          : `Unassigned from trip ${trip.tripId || tripId}`,
        tripId,
        createdAt: now,
        createdBy: uid,
        createdByName: name || null,
        createdRole: role || null,
      });

      writeShipmentActionLog({
        db,
        tx,
        action: requestedPackageId
          ? "UNASSIGN_PACKAGE_FROM_TRIP"
          : "UNASSIGN_SHIPMENT_FROM_TRIP",
        shipmentDocId: trackingShipmentId,
        shipmentId: tracking.shipmentId || trackingShipmentId,
        tripId,
        actorId: uid,
        actorName: name || null,
        actorRole: role || null,
        details: {
          removedTotal: removeTotal,
          removedPending: removePending,
          removedLoaded: removeLoaded,
          removedDelivered: removeDelivered,
          removedMissing: removeMissing,
          removedDamaged: removeDamaged,
          resultingStatus: shipmentStatus,
          resetTo: PACKAGE_STATUS.RECEIVED_AT_DIVISORIA,
          resetPackageIds,
          requestedPackageId: requestedPackageId || null,
          tripWasLocked: trip.manifestLocked === true,
          tripStatus: trip.status || null,
        },
        createdAt: now,
      });

      writeCustodyAuditLog({
        db,
        tx,
        action: "UNASSIGN_SHIPMENT_FROM_TRIP",
        targetCollection: "shipments",
        targetId: trackingShipmentId,
        tripDocId: tripId,
        tripId: trip.tripId || tripId,
        actorId: uid,
        actorName: name || null,
        actorRole: role || null,
        previousValue: {
          currentTripId: tracking.currentTripId || null,
          currentTripIds: tracking.currentTripIds || [],
        },
        newValue: {
          currentTripId: singleCurrentTripId,
          currentTripIds: activeTripIds,
          resultingStatus: shipmentStatus,
          resetTo: PACKAGE_STATUS.RECEIVED_AT_DIVISORIA,
        },
        note: requestedPackageId
          ? `Package ${requestedPackageId} removed from trip and reset to Divisoria intake.`
          : `Shipment ${trackingShipmentId} unassigned from trip and reset to Divisoria intake.`,
        meta: {
          removedTotal: removeTotal,
          removedLoaded: removeLoaded,
          resetPackageIds,
          tripWasLocked: trip.manifestLocked === true,
          tripStatus: trip.status || null,
        },
      });
    });

    return {
      success: true,
      trackingShipmentId,
      tripId,
      packageId: requestedPackageId || null,
      manifestRemoved,
    };
  },
);
