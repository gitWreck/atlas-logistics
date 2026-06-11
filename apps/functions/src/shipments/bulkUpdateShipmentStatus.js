"use strict";

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const { updatedBy } = require("../utilities/helpers");
const { writeShipmentActionLog } = require("../utilities/shipmentLogger");
const {
  packageOnTrip,
  applyLinehaulDelivered,
  applyLinehaulUnloadAtHub,
  buildShipmentSnapshot,
  normalizePackageRow,
  sumLoadedQty,
  sumReceivedQty,
  sumTotalQty,
} = require("../packages/tripPackageOperations");
const { tryAutoCompleteTrip } = require("../trips/autoCompleteTrip");
const { assertCustodyScanStatusAllowed } = require("../trips/manifestLockGuard");

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

exports.bulkUpdateShipmentStatus = onCall(
  { region: "asia-southeast1", maxInstances: 10 },
  async (req) => {
    const { tripId, shipmentIds, newStatus, location } = req.data || {};

    if (!tripId || !shipmentIds || !Array.isArray(shipmentIds) || !newStatus) {
      throw new HttpsError("invalid-argument", "Missing required fields.");
    }

    const { uid, role, name } = updatedBy(req);

    if (shipmentIds.length > 150) {
      throw new HttpsError(
        "invalid-argument",
        "Too many items. Select fewer than 150.",
      );
    }

    const timestamp = admin.firestore.FieldValue.serverTimestamp();
    const isoDate = new Date().toISOString();
    const batch = db.batch();

    let tripPendingDelta = 0;
    let tripLoadedDelta = 0;
    let tripDeliveredDelta = 0;
    let updateCount = 0;

    const tripRef = db.collection("truck_trips").doc(tripId);
    const tripSnap = await tripRef.get();
    const tripData = tripSnap.exists ? tripSnap.data() : null;

    const shipmentRefs = shipmentIds.map((id) =>
      db.collection("shipments").doc(id),
    );
    const snapshots = await db.getAll(...shipmentRefs);

    snapshots.forEach((doc) => {
      if (!doc.exists) return;
      assertCustodyScanStatusAllowed(doc.data(), tripData, newStatus);
    });

    snapshots.forEach((doc) => {
      if (!doc.exists) return;

      const data = doc.data();
      const currentStatus = data.status || "PENDING";

      if (currentStatus === newStatus && newStatus !== "COMPLETED") return;
      if (currentStatus === "COMPLETED") return;

      updateCount++;
      const shipmentRef = db.collection("shipments").doc(doc.id);
      const tripShipmentRef = db
        .collection("truck_trips")
        .doc(tripId)
        .collection("trip_shipments")
        .doc(doc.id);

      const oldPackages = Array.isArray(data.packages)
        ? data.packages.map(normalizePackageRow)
        : [];

      const oldLoadedQty = sumLoadedQty(oldPackages);
      const oldReceivedQty = sumReceivedQty(oldPackages);
      const oldTotalQty = sumTotalQty(oldPackages);

      let updatedPackages = oldPackages;

      if (newStatus === "DELIVERED" || newStatus === "COMPLETED") {
        updatedPackages = oldPackages.map((pkg) => {
          if (!packageOnTrip(pkg, tripId)) return pkg;
          return applyLinehaulDelivered(pkg, { tripId, nowIso: isoDate });
        });
      } else if (newStatus === "ARRIVED" || newStatus === "RECEIVED") {
        updatedPackages = oldPackages.map((pkg) => {
          if (!packageOnTrip(pkg, tripId)) return pkg;
          return applyLinehaulUnloadAtHub(pkg, { tripId, nowIso: isoDate });
        });
      }

      const snapshot = buildShipmentSnapshot(updatedPackages, {
        previousStatus: data.status,
        isHubReceive: newStatus === "ARRIVED" || newStatus === "RECEIVED",
      });

      const deltaLoaded = snapshot.totals.loaded - oldLoadedQty;
      const deltaDelivered = snapshot.totals.received - oldReceivedQty;
      const deltaPending =
        snapshot.totals.pending - Math.max(oldTotalQty - oldLoadedQty, 0);

      tripPendingDelta += deltaPending;
      tripLoadedDelta += deltaLoaded;
      tripDeliveredDelta += deltaDelivered;

      const packagesChanged =
        newStatus === "DELIVERED" ||
        newStatus === "COMPLETED" ||
        newStatus === "ARRIVED" ||
        newStatus === "RECEIVED";

      const historyEntry = {
        status: packagesChanged ? snapshot.status : newStatus,
        at: new Date(),
        by: name,
        note: packagesChanged
          ? `Bulk ${newStatus} applied to packages on trip ${tripId}.`
          : `Bulk manifest status set to ${newStatus}.`,
        location: location || null,
      };

      if (packagesChanged) {
        batch.update(shipmentRef, {
          status: snapshot.status,
          packages: snapshot.packages,
          packageBreakdown: snapshot.packageBreakdown,
          currentTripIds: snapshot.currentTripIds,
          currentTripId: snapshot.currentTripId,
          "totals.totalItems": snapshot.totals.totalItems,
          "totals.totalContentQty": snapshot.totals.totalContentQty,
          "totals.loaded": snapshot.totals.loaded,
          "totals.pending": snapshot.totals.pending,
          "totals.received": snapshot.totals.received,
          "totals.delivered": snapshot.totals.delivered,
          "totals.missing": snapshot.totals.missing,
          "totals.damaged": snapshot.totals.damaged,
          updatedAt: timestamp,
          updatedBy: name,
          statusHistory: admin.firestore.FieldValue.arrayUnion(historyEntry),
          ...(location ? { lastLocation: location } : {}),
        });
      } else {
        batch.update(shipmentRef, {
          packageBreakdown: snapshot.packageBreakdown,
          updatedAt: timestamp,
          updatedBy: name,
          statusHistory: admin.firestore.FieldValue.arrayUnion(historyEntry),
          ...(location ? { lastLocation: location } : {}),
        });
      }

      let manifestStatus = newStatus;
      if (newStatus === "OUT_FOR_DELIVERY") manifestStatus = "UNLOADING";
      if (packagesChanged) manifestStatus = snapshot.status;

      batch.update(tripShipmentRef, {
        status: manifestStatus,
        loadedCount: snapshot.totals.loaded,
        pendingCount: snapshot.totals.pending,
        deliveredCount: snapshot.totals.received,
        receivedCount: snapshot.totals.received,
        missingCount: snapshot.totals.missing,
        damagedCount: snapshot.totals.damaged,
        updatedAt: timestamp,
      });

      const shipEventRef = shipmentRef.collection("status_events").doc();
      batch.set(shipEventRef, {
        type: "BULK_UPDATE",
        status: packagesChanged ? snapshot.status : newStatus,
        message: `Bulk updated to ${newStatus}`,
        updatedBy: name,
        createdAt: timestamp,
      });
    });

    if (
      tripPendingDelta !== 0 ||
      tripLoadedDelta !== 0 ||
      tripDeliveredDelta !== 0
    ) {
      batch.update(tripRef, {
        itemPending: admin.firestore.FieldValue.increment(tripPendingDelta),
        totalLoaded: admin.firestore.FieldValue.increment(tripLoadedDelta),
        totalDelivered:
          admin.firestore.FieldValue.increment(tripDeliveredDelta),
        updatedAt: timestamp,
      });
    }

    if (updateCount > 0) {
      const tripEventRef = tripRef.collection("status_events").doc();
      batch.set(tripEventRef, {
        type: "BULK_UPDATE",
        message: `Bulk updated ${updateCount} shipments to ${newStatus}`,
        newStatus,
        affectedCount: updateCount,
        performedBy: name,
        createdAt: timestamp,
      });

      writeShipmentActionLog({
        db,
        batch,
        collection: "audit_logs",
        action: "BULK_STATUS_UPDATE",
        tripId,
        newStatus,
        count: updateCount,
        actorId: uid,
        actorRole: role,
        actorName: name,
        timestamp,
      });
    }

    await batch.commit();

    await tryAutoCompleteTrip(tripId, {
      actorId: uid,
      actorName: name,
      actorRole: role,
      source: "BULK_UPDATE_SHIPMENT_STATUS",
    });

    return {
      success: true,
      count: updateCount,
      message: `Successfully updated ${updateCount} shipments.`,
    };
  },
);
