"use strict";

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const { FieldValue } = admin.firestore;
const { requireRole, updatedBy } = require("../utilities/helpers");
const { writeShipmentActionLog } = require("../utilities/shipmentLogger");
const { writeCustodyAuditLog } = require("../utilities/custodyAuditLog");
const { packageOnTrip, buildShipmentSnapshot } = require("../packages/tripPackageOperations");

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

/* ======================================================
   UNASSIGN SHIPMENT FROM TRUCK TRIP (OPTION B — CANONICAL)
====================================================== */
exports.unassignShipmentFromTrip = onCall(
  { region: "asia-southeast1", maxInstances: 10 },
  async (req) => {
    await requireRole(db, req, ["admin", "manager"]);

    const {
      trackingShipmentId,
      tripId,
      // updatedBy
    } = req.data || {};
    if (!trackingShipmentId || typeof trackingShipmentId !== "string") {
      throw new HttpsError("invalid-argument", "trackingShipmentId required");
    }
    if (!tripId || typeof tripId !== "string") {
      throw new HttpsError("invalid-argument", "tripId required");
    }

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

      // 🔒 LOCK CHECKS
      if (trip.active === false || trip.status === "COMPLETED") {
        throw new HttpsError(
          "failed-precondition",
          "Cannot unassign from a completed or inactive trip.",
        );
      }
      if (trip.manifestLocked === true) {
        throw new HttpsError(
          "failed-precondition",
          "Trip Manifest is LOCKED. Reopen it first.",
        );
      }
      if (
        tracking.currentTripId &&
        tracking.currentTripId !== tripId &&
        !shipSnap.exists
      ) {
        throw new HttpsError(
          "failed-precondition",
          `Shipment belongs to another trip (${tracking.currentTripId}).`,
        );
      }

      const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
      const packageQty = (pkg = {}) =>
        Math.max(normalizeQty(pkg.quantity, 1), 1);
      const sumQty = (packages = [], field) =>
        packages.reduce(
          (sum, pkg) =>
            sum + clamp(normalizeQty(pkg[field], 0), 0, packageQty(pkg)),
          0,
        );
      const deriveResetPackageStatus = (pkg = {}) => {
        const quantity = packageQty(pkg);
        const missingQty = clamp(normalizeQty(pkg.missingQty, 0), 0, quantity);
        const damagedQty = clamp(normalizeQty(pkg.damagedQty, 0), 0, quantity);

        if (damagedQty > 0) return "DAMAGED";
        if (missingQty > 0) return "MISSING";
        return "RECEIVED";
      };

      // ======================================================
      // 1. CALCULATE VALUES TO REMOVE (The Subtraction Logic)
      // ======================================================
      const removeTotal = normalizeQty(tripShipment.totalItems, 0);
      const removePending = normalizeQty(tripShipment.pendingCount, 0);
      const removeLoaded = normalizeQty(tripShipment.loadedCount, 0);
      // Fallback to receivedCount if deliveredCount isn't explicitly used
      const removeDelivered = normalizeQty(
        tripShipment.deliveredCount || tripShipment.receivedCount || 0,
      );
      const removeMissing = normalizeQty(tripShipment.missingCount, 0);
      const removeDamaged = normalizeQty(tripShipment.damagedCount, 0);

      const now = FieldValue.serverTimestamp();
      const nowTs = admin.firestore.Timestamp.now();

      // ======================================================
      // 2. UPDATE TRUCK TRIP (Subtract Everything)
      // ======================================================
      // We subtract ALL counters that this shipment contributed to the trip
      tx.update(tripRef, {
        totalItems: FieldValue.increment(-removeTotal),
        itemPending: FieldValue.increment(-removePending),
        totalLoaded: FieldValue.increment(-removeLoaded),
        totalDelivered: FieldValue.increment(-removeDelivered),
        totalArrived: FieldValue.increment(-removeDelivered), // Ensures sync if you use Arrived metric
        totalMissing: FieldValue.increment(-removeMissing),
        totalDamaged: FieldValue.increment(-removeDamaged),
        updatedAt: now,
        updatedBy: name,
      });

      // ======================================================
      // 3. RESET SHIPMENT & PACKAGES
      // ======================================================
      // Only reset packages that belonged to this trip; leave other trips untouched.
      const updatedPackages = (tracking.packages || []).map((pkg) => {
        if (!packageOnTrip(pkg, tripId)) {
          return pkg;
        }

        const quantity = packageQty(pkg);
        const missingQty = clamp(normalizeQty(pkg.missingQty, 0), 0, quantity);
        const damagedQty = clamp(normalizeQty(pkg.damagedQty, 0), 0, quantity);

        const resetPkg = {
          ...pkg,
          quantity,
          loadedQty: 0,
          receivedQty: 0,
          missingQty,
          damagedQty,
          loadedAt: null,
          loadedBy: null,
          loadedOnTrip: null,
          deliveredAt: null,
          deliveredBy: null,
          updatedAt: new Date().toISOString(),
          updatedBy: name,
        };

        return {
          ...resetPkg,
          status: deriveResetPackageStatus(resetPkg),
        };
      });

      const snapshot = buildShipmentSnapshot(updatedPackages, {
        previousStatus: tracking.status,
      });
      const shipmentStatus = snapshot.status;

      const activeTripIds = snapshot.currentTripIds || [];
      const singleCurrentTripId = snapshot.currentTripId;

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

      // ======================================================
      // 4. CLEANUP & LOGS
      // ======================================================
      tx.delete(shipRef);

      tx.set(trackingRef.collection("status_events").doc(), {
        type: "UNASSIGN_FROM_TRIP",
        message: `Unassigned from trip ${trip.tripId || tripId}`,
        tripId,
        createdAt: now,
        createdBy: uid,
        createdByName: name || null,
        createdRole: role || null,
      });

      writeShipmentActionLog({
        db,
        tx,
        action: "UNASSIGN_SHIPMENT_FROM_TRIP",
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
        },
        note: `Shipment ${trackingShipmentId} unassigned from trip.`,
        meta: {
          removedTotal: removeTotal,
          removedLoaded: removeLoaded,
        },
      });
    });

    return { success: true, trackingShipmentId, tripId };
  },
);
