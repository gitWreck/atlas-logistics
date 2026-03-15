"use strict";

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const { requireRole } = require("../utilities/helpers");

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

/* ======================================================
   UNASSIGN SHIPMENT FROM TRUCK TRIP (OPTION B — CANONICAL)
====================================================== */
exports.unassignShipmentFromTruckTrip = onCall(
  { region: "asia-southeast1", maxInstances: 10 },
  async (req) => {
    await requireRole(db, req, ["admin", "manager"]);

    const { trackingDocId, truckTripId } = req.data || {};
    if (!trackingDocId || !truckTripId) {
      throw new HttpsError(
        "invalid-argument",
        "trackingDocId and truckTripId required",
      );
    }

    const uid = req.auth.uid;
    const userSnap = await db.collection("users").doc(uid).get();
    if (!userSnap.exists || userSnap.data().active !== true) {
      throw new HttpsError("permission-denied", "Inactive user");
    }
    const role = userSnap.data().role;

    const trackingRef = db.collection("shipments").doc(trackingDocId);
    const tripRef = db.collection("truck_trips").doc(truckTripId);
    const shipRef = tripRef.collection("trip_shipments").doc(trackingDocId);

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
        // Optional: just return success if it's already gone
        return;
      }

      const tracking = trackingSnap.data();
      const trip = tripSnap.data();
      const tripShipment = shipSnap.data();

      // 🔒 LOCK CHECK: Fixed your commented-out code
      if (trip.status === "COMPLETED") {
        throw new HttpsError(
          "failed-precondition",
          "Cannot unassign from completed trip.",
        );
      }
      // If you use a strict lock flag:
      if (trip.manifestLocked === true) {
        throw new HttpsError(
          "failed-precondition",
          "Trip Manifest is LOCKED. Reopen it first.",
        );
      }

      // --------------------------
      // ======================================================
      // 1. CALCULATE VALUES TO REMOVE (The Subtraction Logic)
      // ======================================================
      const removeTotal = Number(tripShipment.totalItems || 0);
      // const removePending = Number(tripShipment.pendingCount || 0);
      const removeLoaded = Number(tripShipment.loadedCount || 0);
      const removeReceived = Number(tripShipment.receivedCount || 0); // ✅ Track received pieces
      const removeDelivered = Number(tripShipment.deliveredCount || 0);

      const now = admin.firestore.FieldValue.serverTimestamp();

      // ======================================================
      // 2. UPDATE TRUCK TRIP (Subtract Everything)
      // ======================================================
      // We subtract ALL counters that this shipment contributed
      tx.update(tripRef, {
        totalItems: admin.firestore.FieldValue.increment(-removeTotal),
        totalLoaded: admin.firestore.FieldValue.increment(-removeLoaded),
        totalReceived: admin.firestore.FieldValue.increment(-removeReceived), // ✅ Replaced itemPending
        totalDelivered: admin.firestore.FieldValue.increment(-removeDelivered),

        // 🆕 Handle Scenario 2: Remove loaded/delivered stats too
        // itemPending: admin.firestore.FieldValue.increment(-removePending),

        updatedAt: now,
        updatedBy: uid,
      });

      // ======================================================
      // 3. RESET SHIPMENT (Revert Packages)
      // ======================================================
      // If items were loaded, we must reset the individual packages back to "RECEIVED"
      let updatedPackages = tracking.packages || [];

      if (removeLoaded > 0 || removeDelivered > 0) {
        updatedPackages = updatedPackages.map((pkg) => {
          // Only reset packages that belong to THIS trip
          if (pkg.loadedOnTrip === truckTripId) {
            return {
              ...pkg,
              status: "RECEIVED", // Reset to warehouse inventory

              loadedQty: 0,
              loadedAt: null,
              loadedBy: null,
              loadedOnTrip: null,

              deliveredAt: null,
              deliveredBy: null,
            };
          }
          return pkg;
        });
      }

      tx.update(trackingRef, {
        currentTruckTripId: null,
        status: "RECEIVED",

        // 🆕 Reset Totals
        // We assume the whole shipment is now back at the warehouse
        // "totals.pending": removeTotal,
        "totals.loaded": 0,
        "totals.delivered": 0,
        "totals.received": removeTotal, // Assuming they are all physically present

        packages: updatedPackages,

        updatedAt: now,
        updatedBy: uid,
        updatedRole: role,

        // Append History
        statusHistory: [
          ...(tracking.statusHistory ?? []),
          {
            status: "RECEIVED",
            at: admin.firestore.Timestamp.now(),
            note: `Unassigned from ${truckTripId}`,
          },
        ],
      });

      // ======================================================
      // 4. CLEANUP
      // ======================================================
      tx.delete(shipRef);

      // Logs...
      tx.set(trackingRef.collection("status_events").doc(), {
        type: "UNASSIGN_FROM_TRIP",
        message: `Unassigned from trip ${trip.tripId || truckTripId}`,
        truckTripId,
        createdAt: now,
        createdBy: uid,
      });

      tx.set(db.collection("admin_logs").doc(), {
        action: "UNASSIGN_SHIPMENT_FROM_TRIP",
        trackingDocId,
        truckTripId,
        details: {
          removedLoaded: removeLoaded,
          removedPending: removePending,
        },
        actorId: uid,
        createdAt: now,
      });
    });

    return { success: true, trackingDocId, truckTripId };
  },
);
