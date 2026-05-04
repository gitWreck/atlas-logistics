"use strict";

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const { FieldValue } = admin.firestore;
const {
  requireRole,
} = require("../../../../../../atlas-trucking-platform/apps/functions/src/utilities/helpers");
const { writeTripActionLog } = require("../utilities/tripLogger");

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

/* ======================================================
   UNASSIGN SHIPMENT FROM TRUCK TRIP (OPTION B — CANONICAL)
====================================================== */
exports.unassignShipmentFromTrip = onCall(
  { region: "asia-southeast1", maxInstances: 10 },
  async (req) => {
    await requireRole(db, req, ["admin", "manager"]);

    const { trackingShipmentId, tripId } = req.data || {};
    if (!trackingShipmentId || !tripId) {
      throw new HttpsError(
        "invalid-argument",
        "trackingShipmentId and tripId required",
      );
    }

    const uid = req.auth.uid;
    const userSnap = await db.collection("users").doc(uid).get();
    if (!userSnap.exists || userSnap.data().active !== true) {
      throw new HttpsError("permission-denied", "Inactive user");
    }
    const role = userSnap.data().role;

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
        // Just return success if it's already gone to ensure idempotency
        return;
      }

      const tracking = trackingSnap.data();
      const trip = tripSnap.data();
      const tripShipment = shipSnap.data();

      // 🔒 LOCK CHECKS
      if (trip.status === "COMPLETED") {
        throw new HttpsError(
          "failed-precondition",
          "Cannot unassign from completed trip.",
        );
      }
      if (trip.manifestLocked === true) {
        throw new HttpsError(
          "failed-precondition",
          "Trip Manifest is LOCKED. Reopen it first.",
        );
      }

      // ======================================================
      // 1. CALCULATE VALUES TO REMOVE (The Subtraction Logic)
      // ======================================================
      const removeTotal = Number(tripShipment.totalItems || 0);
      const removePending = Number(tripShipment.pendingCount || 0);
      const removeLoaded = Number(tripShipment.loadedCount || 0);
      // Fallback to receivedCount if deliveredCount isn't explicitly used
      const removeDelivered = Number(
        tripShipment.deliveredCount || tripShipment.receivedCount || 0,
      );

      const now = FieldValue.serverTimestamp();

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
        updatedAt: now,
        updatedBy: uid,
      });

      // ======================================================
      // 3. RESET SHIPMENT & PACKAGES (Revert to Warehouse)
      // ======================================================
      // Because we now track partial quantities, we MUST zero out loadedQty and receivedQty
      const updatedPackages = (tracking.packages || []).map((pkg) => {
        return {
          ...pkg,
          status: "RECEIVED", // Reset to warehouse inventory baseline
          loadedQty: 0, // Clear partial counts
          receivedQty: 0, // Clear partial counts
          loadedAt: null,
          loadedBy: null,
          loadedOnTrip: null,
          deliveredAt: null,
          deliveredBy: null,
        };
      });

      tx.update(trackingRef, {
        currentTripId: null,
        status: "RECEIVED",

        // Reset Totals assuming the whole shipment is now back at the origin warehouse floor
        "totals.pending": removeTotal, // Everything is pending loading again
        "totals.loaded": 0,
        "totals.delivered": 0,
        "totals.received": 0,

        packages: updatedPackages,

        updatedAt: now,
        updatedBy: uid,
        updatedRole: role,

        // Append History
        statusHistory: FieldValue.arrayUnion({
          status: "RECEIVED",
          at: new Date(), // using local JS date for arrayUnion compatibility
          by: uid,
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
      });

      writeTripActionLog({
        db,
        tx,
        action: "UNASSIGN_SHIPMENT_FROM_TRIP",
        trackingShipmentId,
        tripId,
        details: {
          removedTotal: removeTotal,
          removedLoaded: removeLoaded,
          removedDelivered: removeDelivered,
        },
        actorId: uid,
        actorName: req.auth.token?.name || null,
        actorRole: req.auth.token?.role || null,
        createdAt: now,
      });
    });

    return { success: true, trackingShipmentId, tripId };
  },
);
