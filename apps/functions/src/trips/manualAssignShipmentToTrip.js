"use strict";

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const {
  requireRole,
  requireString,
  updatedBy,
} = require("../utilities/helpers");
const { getActorFromRequest } = require("../utilities/tripLogger");
const { writeCustodyAuditLog } = require("../utilities/custodyAuditLog");
const { normalizeQty } = require("../utilities/packageHelpers");
const { buildDerivedShipmentSnapshot } = require("../packages/shipmentStatus");
const {
  buildAssignmentTripFields,
  packageLinkedToTrip,
  getPackageIdentity,
  applyLinehaulLoad,
  applyLinehaulInTransit,
  applyLinehaulUnloadAtHub,
} = require("../packages/tripPackageOperations");
const {
  PACKAGE_STATUS,
  TERMINAL_STATUSES,
  ODIONGAN_WAREHOUSE,
  normalizePackageStatus,
} = require("../packages/packageStatus");
const {
  mapPackagesForDeliveryRelease,
} = require("../warehouse/packageDeliveryOperations");
const {
  summarizeTripScopedPackages,
} = require("./tripShipmentCounters");
const {
  MANIFEST_STATUS,
  resolveManifestStatus,
} = require("./manifestStatus");
const {
  normalizeCode,
  resolveShipmentReference,
} = require("../shipments/resolveShipmentReference");
const {
  appendPendingAmendmentEntry,
  tripRequiresAmendmentTracking,
} = require("./manifestAmendment");

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

const MANUAL_SYNC_STAGE = Object.freeze({
  ASSIGNED: "ASSIGNED",
  LOADED: "LOADED",
  IN_TRANSIT: "IN_TRANSIT",
  ARRIVED_AT_ODIONGAN: "ARRIVED_AT_ODIONGAN",
  RELEASED_FOR_DELIVERY: "RELEASED_FOR_DELIVERY",
});

const STAGE_RANK = Object.freeze({
  [MANUAL_SYNC_STAGE.ASSIGNED]: 0,
  [MANUAL_SYNC_STAGE.LOADED]: 1,
  [MANUAL_SYNC_STAGE.IN_TRANSIT]: 2,
  [MANUAL_SYNC_STAGE.ARRIVED_AT_ODIONGAN]: 3,
  [MANUAL_SYNC_STAGE.RELEASED_FOR_DELIVERY]: 4,
});

function laterStage(first, second) {
  return (STAGE_RANK[second] || 0) > (STAGE_RANK[first] || 0)
    ? second
    : first;
}

function stageFromPackage(pkg = {}) {
  const status = normalizePackageStatus(pkg);
  if (
    [
      PACKAGE_STATUS.RELEASED_FOR_DELIVERY,
      PACKAGE_STATUS.ROUTE_ASSIGNED,
      PACKAGE_STATUS.LOADED_TO_DELIVERY_VEHICLE,
      PACKAGE_STATUS.READY_FOR_DELIVERY,
      PACKAGE_STATUS.OUT_FOR_DELIVERY,
      PACKAGE_STATUS.DELIVERED,
      PACKAGE_STATUS.COMPLETED,
    ].includes(status)
  ) {
    return MANUAL_SYNC_STAGE.RELEASED_FOR_DELIVERY;
  }
  if (
    [
      PACKAGE_STATUS.ARRIVED_AT_ODIONGAN,
      PACKAGE_STATUS.AVAILABLE_AT_ODIONGAN_WAREHOUSE,
      PACKAGE_STATUS.AVAILABLE_AT_WAREHOUSE,
    ].includes(status)
  ) {
    return MANUAL_SYNC_STAGE.ARRIVED_AT_ODIONGAN;
  }
  if (status === PACKAGE_STATUS.IN_TRANSIT) {
    return MANUAL_SYNC_STAGE.IN_TRANSIT;
  }
  if (
    [
      PACKAGE_STATUS.LOADED,
      PACKAGE_STATUS.LOADED_TO_TRIP,
      PACKAGE_STATUS.PARTIALLY_LOADED,
    ].includes(status)
  ) {
    return MANUAL_SYNC_STAGE.LOADED;
  }
  return MANUAL_SYNC_STAGE.ASSIGNED;
}

async function detectTripPeerLifecycleStage(
  firestore,
  tripRef,
  excludedShipmentId,
) {
  const manifestSnap = await tripRef.collection("trip_shipments").limit(25).get();
  const peerIds = manifestSnap.docs
    .map((doc) => doc.id)
    .filter((id) => id !== excludedShipmentId);
  if (!peerIds.length) return MANUAL_SYNC_STAGE.ASSIGNED;

  const peerRefs = peerIds.map((id) => firestore.collection("shipments").doc(id));
  const peerSnaps = await firestore.getAll(...peerRefs);
  let stage = MANUAL_SYNC_STAGE.ASSIGNED;

  for (const snap of peerSnaps) {
    if (!snap.exists) continue;
    const packages = Array.isArray(snap.data()?.packages)
      ? snap.data().packages
      : [];
    for (const pkg of packages) {
      stage = laterStage(stage, stageFromPackage(pkg));
      if (stage === MANUAL_SYNC_STAGE.RELEASED_FOR_DELIVERY) return stage;
    }
  }

  return stage;
}

function resolveManualSyncStage(trip = {}, peerStage = null) {
  const status = String(trip.status || "").trim().toUpperCase();
  const manifestStatus = resolveManifestStatus(trip);

  if (
    trip.reconciledAt ||
    trip.adminOverrideReleaseAt ||
    manifestStatus === MANIFEST_STATUS.RECONCILED ||
    status === "OUT_FOR_DELIVERY"
  ) {
    return MANUAL_SYNC_STAGE.RELEASED_FOR_DELIVERY;
  }
  let tripStage = MANUAL_SYNC_STAGE.ASSIGNED;
  if (status === "ARRIVED") {
    tripStage = MANUAL_SYNC_STAGE.ARRIVED_AT_ODIONGAN;
  } else if (status === "IN_TRANSIT") {
    tripStage = MANUAL_SYNC_STAGE.IN_TRANSIT;
  } else if (status === "LOADED" || status === "LOADING") {
    tripStage = MANUAL_SYNC_STAGE.LOADED;
  }
  return laterStage(tripStage, peerStage);
}

function packageCommittedToOtherTrip(pkg = {}, tripId = "") {
  const activeTrip = String(
    pkg.currentTripId || pkg.loadedOnTrip || "",
  ).trim();
  return Boolean(activeTrip && activeTrip !== String(tripId));
}

function packageMayBeManuallyAdded(pkg = {}, tripId = "") {
  if (TERMINAL_STATUSES.has(normalizePackageStatus(pkg))) return false;
  return !packageCommittedToOtherTrip(pkg, tripId);
}

function promotePackageToTripStage(
  pkg = {},
  stage,
  { tripId, actorName, nowIso },
) {
  if (stage === MANUAL_SYNC_STAGE.ASSIGNED) {
    return {
      ...pkg,
      updatedAt: nowIso,
      updatedBy: actorName,
    };
  }

  const loaded = applyLinehaulLoad(pkg, {
    tripId,
    actorName,
    nowIso,
  });
  if (stage === MANUAL_SYNC_STAGE.LOADED) return loaded;

  const inTransit = applyLinehaulInTransit(loaded, { tripId, nowIso });
  if (stage === MANUAL_SYNC_STAGE.IN_TRANSIT) {
    return { ...inTransit, updatedBy: actorName };
  }

  const arrived = applyLinehaulUnloadAtHub(inTransit, { tripId, nowIso });
  if (stage === MANUAL_SYNC_STAGE.ARRIVED_AT_ODIONGAN) {
    return { ...arrived, updatedBy: actorName };
  }

  const [released] = mapPackagesForDeliveryRelease(
    [arrived],
    ODIONGAN_WAREHOUSE,
  );
  return {
    ...released,
    updatedBy: actorName,
  };
}

function addCounter(current, added) {
  return normalizeQty(current, 0) + normalizeQty(added, 0);
}

exports.manualAssignShipmentToTrip = onCall(
  { region: "asia-southeast1", maxInstances: 10 },
  async (req) => {
    await requireRole(db, req, ["admin"]);

    const { uid, role, name } = updatedBy(req);
    const userSnap = await db.collection("users").doc(req.auth.uid).get();
    const userData = userSnap.exists ? userSnap.data() : {};
    const actor = getActorFromRequest(req, userData);

    const tripId = requireString(req.data?.tripId, "tripId");
    const shipmentRef = normalizeCode(req.data?.shipmentRef || req.data?.shipmentId);
    const reason = requireString(req.data?.reason, "reason");

    if (!shipmentRef) {
      throw new HttpsError("invalid-argument", "Shipment or package label is required.");
    }

    const resolved = await resolveShipmentReference(db, shipmentRef);
    const trackingShipmentId = resolved.shipmentDocId;
    const tracking = resolved.shipment;

    const tripRef = db.collection("truck_trips").doc(tripId);
    const shipmentDocRef = db.collection("shipments").doc(trackingShipmentId);
    const tripShipmentRef = tripRef.collection("trip_shipments").doc(trackingShipmentId);
    const peerLifecycleStage = await detectTripPeerLifecycleStage(
      db,
      tripRef,
      trackingShipmentId,
    );

    let alreadyAssigned = false;
    let synchronizedStage = null;
    let addedPackageIds = [];

    await db.runTransaction(async (tx) => {
      const [tripSnap, shipmentSnap, tripShipmentSnap] = await Promise.all([
        tx.get(tripRef),
        tx.get(shipmentDocRef),
        tx.get(tripShipmentRef),
      ]);

      if (!tripSnap.exists) {
        throw new HttpsError("not-found", "Trip not found");
      }
      if (!shipmentSnap.exists) {
        throw new HttpsError("not-found", "Shipment not found");
      }

      const trip = tripSnap.data() || {};
      const currentTracking = shipmentSnap.data() || {};
      const tripStatus = String(trip.status || "").trim().toUpperCase();

      if (
        trip.active === false ||
        ["COMPLETED", "DELIVERED", "CANCELLED"].includes(tripStatus)
      ) {
        throw new HttpsError(
          "failed-precondition",
          "Cannot manually add cargo to an inactive or completed trip.",
        );
      }

      const packages = Array.isArray(currentTracking.packages)
        ? currentTracking.packages
        : [];
      const tripShipment = tripShipmentSnap.exists
        ? tripShipmentSnap.data() || {}
        : {};
      const manifestBarcodes = new Set(
        (tripShipment.packageBarcodes || []).filter(Boolean).map(String),
      );
      const scannedPackageIds = new Set(
        (tripShipment.scannedPackageIds || []).filter(Boolean).map(String),
      );
      const isAlreadyRepresented = (pkg) => {
        const packageId = getPackageIdentity(pkg);
        return (
          (packageId && manifestBarcodes.has(packageId)) ||
          packageLinkedToTrip(pkg, tripId, manifestBarcodes, {
            scannedPackageIds,
          })
        );
      };

      let packagesToAdd = [];
      if (resolved.packageLabel) {
        const target = packages.find(
          (pkg) => getPackageIdentity(pkg) === resolved.packageLabel,
        );
        if (!target) {
          throw new HttpsError(
            "not-found",
            `Package ${resolved.packageLabel} was not found in the shipment.`,
          );
        }
        if (isAlreadyRepresented(target)) {
          alreadyAssigned = true;
          synchronizedStage = resolveManualSyncStage(
            trip,
            peerLifecycleStage,
          );
          return;
        }
        if (!packageMayBeManuallyAdded(target, tripId)) {
          throw new HttpsError(
            "failed-precondition",
            `Package ${resolved.packageLabel} is terminal or belongs to another trip.`,
          );
        }
        packagesToAdd = [target];
      } else {
        packagesToAdd = packages.filter(
          (pkg) =>
            packageMayBeManuallyAdded(pkg, tripId) &&
            !isAlreadyRepresented(pkg),
        );
      }

      if (packagesToAdd.length === 0) {
        if (tripShipmentSnap.exists) {
          alreadyAssigned = true;
          synchronizedStage = resolveManualSyncStage(
            trip,
            peerLifecycleStage,
          );
          return;
        }
        throw new HttpsError(
          "failed-precondition",
          "No eligible packages can be manually added to this trip.",
        );
      }

      const now = admin.firestore.FieldValue.serverTimestamp();
      const nowIso = new Date().toISOString();
      const targetIds = new Set(packagesToAdd.map(getPackageIdentity));
      if (
        targetIds.has("") ||
        targetIds.size !== packagesToAdd.length
      ) {
        throw new HttpsError(
          "failed-precondition",
          "Every manually added package must have a unique tracking ID.",
        );
      }
      synchronizedStage = resolveManualSyncStage(trip, peerLifecycleStage);
      addedPackageIds = [...targetIds].filter(Boolean);

      const updatedPackages = packages.map((pkg) =>
        targetIds.has(getPackageIdentity(pkg))
          ? promotePackageToTripStage(pkg, synchronizedStage, {
              tripId,
              actorName: name,
              nowIso,
            })
          : pkg,
      );
      const promotedPackages = updatedPackages.filter((pkg) =>
        targetIds.has(getPackageIdentity(pkg)),
      );
      const addedStats = summarizeTripScopedPackages(promotedPackages);
      const derivedSnapshot = buildDerivedShipmentSnapshot(updatedPackages, {
        previousStatus: "",
      });
      const tripFields = buildAssignmentTripFields(currentTracking, tripId);

      tx.set(
        tripShipmentRef,
        {
          trackingShipmentId,
          shipmentId: currentTracking.shipmentId || null,
          route:
            (currentTracking.originCode || "?") +
            " -> " +
            (currentTracking.destinationCode || "?"),
          totalItems: addCounter(tripShipment.totalItems, addedStats.totalItems),
          pendingCount: addCounter(
            tripShipment.pendingCount,
            addedStats.pendingCount,
          ),
          loadedCount: addCounter(
            tripShipment.loadedCount,
            addedStats.loadedCount,
          ),
          deliveredCount: addCounter(
            tripShipment.deliveredCount,
            addedStats.deliveredCount,
          ),
          receivedCount: addCounter(
            tripShipment.receivedCount,
            addedStats.receivedCount,
          ),
          missingCount: addCounter(
            tripShipment.missingCount,
            addedStats.missingCount,
          ),
          damagedCount: addCounter(
            tripShipment.damagedCount,
            addedStats.damagedCount,
          ),
          sender: currentTracking.sender || null,
          recipient: currentTracking.recipient || null,
          packageBarcodes: [
            ...new Set([
              ...(tripShipment.packageBarcodes || []).map(String),
              ...addedPackageIds,
            ]),
          ],
          scannedPackageIds: [
            ...new Set([
              ...(tripShipment.scannedPackageIds || []).map(String),
              ...addedPackageIds,
            ]),
          ],
          ...(!tripShipmentSnap.exists
            ? {
                createdAt: now,
                createdBy: uid,
              }
            : {}),
          customAdded: true,
          addedVia: "MANUAL",
          customAddedBy: uid,
          customAddedByName: name || null,
          customAddedAt: admin.firestore.Timestamp.now(),
          customAddedPackageIds: admin.firestore.FieldValue.arrayUnion(
            ...addedPackageIds,
          ),
          customAddedPackageEntries: admin.firestore.FieldValue.arrayUnion(
            ...addedPackageIds.map((packageId) => ({
              packageId,
              addedBy: uid,
              addedByName: name || null,
              addedAt: admin.firestore.Timestamp.now(),
              addedVia: "MANUAL",
            })),
          ),
          updatedAt: now,
          updatedBy: name,
          updatedRole: role,
          status: synchronizedStage,
        },
        { merge: true },
      );

      const shipmentLifecycleFields =
        synchronizedStage === MANUAL_SYNC_STAGE.RELEASED_FOR_DELIVERY
          ? {
              availableForDeliveryAt: now,
              availableForDeliveryBy: name || uid,
              releasedForDeliveryAt: now,
              releasedForDeliveryBy: name || uid,
              custodyOwnerType: "WAREHOUSE",
              custodyOwnerId: ODIONGAN_WAREHOUSE,
              currentLocationState: ODIONGAN_WAREHOUSE,
              assignedCheckerId: null,
              assignedCheckerName: null,
              activeCheckerIds: [],
              deliveryManifestId: null,
            }
          : synchronizedStage === MANUAL_SYNC_STAGE.ARRIVED_AT_ODIONGAN
            ? {
                custodyOwnerType: "WAREHOUSE",
                custodyOwnerId: ODIONGAN_WAREHOUSE,
                currentLocationState: ODIONGAN_WAREHOUSE,
              }
            : synchronizedStage === MANUAL_SYNC_STAGE.ASSIGNED
              ? {}
              : {
                  custodyOwnerType: "TRIP",
                  custodyOwnerId: tripId,
                  currentLocationState: synchronizedStage,
                };

      tx.update(shipmentDocRef, {
        currentTripId: tripFields.currentTripId,
        currentTripIds: tripFields.currentTripIds,
        assignedToTripAt: now,
        updatedAt: now,
        updatedBy: name || uid,
        status: derivedSnapshot.status,
        packages: derivedSnapshot.packages,
        packageBreakdown: derivedSnapshot.packageBreakdown,
        availableForDelivery: derivedSnapshot.availableForDelivery,
        ...shipmentLifecycleFields,
        statusHistory: admin.firestore.FieldValue.arrayUnion({
          status: derivedSnapshot.status,
          at: admin.firestore.Timestamp.now(),
          by: name || uid,
          note: `Admin manually added ${resolved.packageLabel || "shipment"} to trip ${trip.tripId || tripId} and synchronized it to ${synchronizedStage}.`,
        }),
        updatedRole: role,
      });

      tx.update(tripRef, {
        totalItems: admin.firestore.FieldValue.increment(addedStats.totalItems),
        itemPending: admin.firestore.FieldValue.increment(
          addedStats.pendingCount,
        ),
        totalLoaded: admin.firestore.FieldValue.increment(
          addedStats.loadedCount,
        ),
        totalDelivered: admin.firestore.FieldValue.increment(
          addedStats.deliveredCount,
        ),
        totalArrived: admin.firestore.FieldValue.increment(
          addedStats.receivedCount,
        ),
        totalMissing: admin.firestore.FieldValue.increment(
          addedStats.missingCount,
        ),
        totalDamaged: admin.firestore.FieldValue.increment(
          addedStats.damagedCount,
        ),
        updatedAt: now,
        updatedBy: name,
      });

      tx.set(shipmentDocRef.collection("status_events").doc(), {
        type: "MANUAL_ASSIGN_TO_TRIP",
        message: "Manually assigned to truck trip",
        tripId,
        reason,
        synchronizedStage,
        packageIds: addedPackageIds,
        packageLabel: resolved.packageLabel,
        enteredRef: shipmentRef,
        createdAt: now,
        createdBy: uid,
      });

      writeCustodyAuditLog({
        db,
        tx,
        action: "MANUAL_ASSIGN_TO_TRIP",
        targetCollection: "shipments",
        targetId: trackingShipmentId,
        tripId: trip.tripId || tripId,
        tripDocId: tripId,
        actorId: actor.actorId,
        actorName: actor.actorName,
        actorRole: actor.actorRole,
        reason,
        previousValue: {
          currentTripId: currentTracking.currentTripId || null,
          currentTripIds: currentTracking.currentTripIds || [],
          enteredRef: shipmentRef,
          packageLabel: resolved.packageLabel,
        },
        newValue: {
          currentTripId: tripFields.currentTripId,
          currentTripIds: tripFields.currentTripIds,
          shipmentId: tracking.shipmentId || trackingShipmentId,
          matchedBy: resolved.matchedBy,
          synchronizedStage,
          packageIds: addedPackageIds,
        },
        note: `Admin manual assignment synchronized to ${synchronizedStage} on trip ${trip.tripId || tripId}.`,
      });

      if (tripRequiresAmendmentTracking(trip)) {
        appendPendingAmendmentEntry(tx, tripRef, trip, {
          changeType: resolved.packageLabel ? "CORRECTED" : "ADDED",
          shipmentId: tracking.shipmentId || trackingShipmentId,
          shipmentDocId: trackingShipmentId,
          packageId: resolved.packageLabel || null,
          reason: `${reason} Synchronized to ${synchronizedStage}.`,
          recordedBy: actor.actorId,
          recordedByName: actor.actorName,
        });
      }
    });

    return {
      success: true,
      alreadyAssigned,
      tripId,
      shipmentDocId: trackingShipmentId,
      shipmentId: tracking.shipmentId || trackingShipmentId,
      packageLabel: resolved.packageLabel,
      matchedBy: resolved.matchedBy,
    };
  },
);
