"use strict";

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const { requireRole } = require("../utilities/helpers");

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

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
    const shipmentRef = db.collection("shipments").doc(trackingDocId);
    const tripRef = db.collection("truck_trips").doc(truckTripId);
    const tripShipmentRef = tripRef
      .collection("trip_shipments")
      .doc(trackingDocId);

    await db.runTransaction(async (tx) => {
      const [shipmentSnap, tripSnap, tripShipmentSnap] = await Promise.all([
        tx.get(shipmentRef),
        tx.get(tripRef),
        tx.get(tripShipmentRef),
      ]);

      if (!shipmentSnap.exists || !tripSnap.exists) {
        throw new HttpsError("not-found", "Shipment or Trip not found");
      }

      const tracking = shipmentSnap.data();
      const trip = tripSnap.data();

      // If it's already gone from the manifest, just exit
      if (!tripShipmentSnap.exists) return { success: true };

      const tripShipment = tripShipmentSnap.data();

      // 🔒 LOCK CHECK
      if (trip.status === "COMPLETED" || trip.manifestLocked === true) {
        throw new HttpsError(
          "failed-precondition",
          "Cannot modify a locked/completed trip.",
        );
      }

      // ======================================================
      // 1. CALCULATE VALUES TO REMOVE (Based on Piece counts)
      // ======================================================
      // We use the counts stored in the trip_shipment manifest entry
      const removeTotal = Number(tripShipment.totalItems || 0);
      const removeLoaded = Number(tripShipment.loadedCount || 0);
      const removeDelivered = Number(tripShipment.deliveredCount || 0);
      const removePending = removeTotal - removeLoaded;

      const now = admin.firestore.FieldValue.serverTimestamp();

      // ======================================================
      // 2. UPDATE TRUCK TRIP (Dashboard Reset)
      // ======================================================
      tx.update(tripRef, {
        totalItems: admin.firestore.FieldValue.increment(-removeTotal),
        itemPending: admin.firestore.FieldValue.increment(-removePending),
        totalLoaded: admin.firestore.FieldValue.increment(-removeLoaded),
        totalDelivered: admin.firestore.FieldValue.increment(-removeDelivered),
        updatedAt: now,
      });

      // ======================================================
      // 3. RESET SHIPMENT & INTERNAL PACKAGES
      // ======================================================
      const updatedPackages = (tracking.packages || []).map((pkg) => {
        // Only reset packages that were part of THIS trip
        // This ensures we don't accidentally reset a package that might be on a different leg
        return {
          ...pkg,
          status: "RECEIVED", // Revert back to hub inventory
          loadedQty: 0, // ✅ RESET INTERNAL QUANTITY
          loadedAt: null,
          loadedOnTrip: null,
          deliveredAt: null,
        };
      });

      tx.update(shipmentRef, {
        currentTruckTripId: null,
        status: "RECEIVED",
        packages: updatedPackages,
        "totals.loaded": 0,
        "totals.delivered": 0,
        "totals.pending": removeTotal, // All pieces are now pending again
        updatedAt: now,
        statusHistory: admin.firestore.FieldValue.arrayUnion({
          status: "RECEIVED",
          at: new Date(),
          by: uid,
          note: `Unassigned from trip ${truckTripId}. Quantities reset.`,
        }),
      });

      // ======================================================
      // 4. CLEANUP
      // ======================================================
      tx.delete(tripShipmentRef); // Remove from the Manifest collection

      // Audit Log
      tx.set(db.collection("admin_logs").doc(), {
        action: "UNASSIGN_SHIPMENT_FROM_TRIP",
        trackingDocId,
        truckTripId,
        actorId: uid,
        timestamp: now,
      });
    });

    return { success: true };
  },
);
