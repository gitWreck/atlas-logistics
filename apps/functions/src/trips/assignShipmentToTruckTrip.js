"use strict";

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const { requireRole } = require("../utilities/helpers");

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

exports.assignShipmentToTruckTrip = onCall(
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
    const role = userSnap.data()?.role;

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

      if (!shipmentSnap.exists)
        throw new HttpsError("not-found", "Shipment not found");
      if (!tripSnap.exists) throw new HttpsError("not-found", "Trip not found");

      const tracking = shipmentSnap.data();
      const trip = tripSnap.data();

      if (trip.status === "COMPLETED" || trip.manifestLocked === true) {
        throw new HttpsError(
          "failed-precondition",
          "Trip is locked or completed.",
        );
      }

      // Idempotency check
      if (tracking.currentTruckTripId === truckTripId) return;

      if (tracking.currentTruckTripId) {
        throw new HttpsError(
          "failed-precondition",
          `Shipment already on trip: ${tracking.currentTruckTripId}`,
        );
      }

      const now = admin.firestore.FieldValue.serverTimestamp();

      // ✅ 1. CALCULATE PIECE TOTALS (Bundled vs Individual logic)
      // We prioritize totalContentQty (sum of pieces in sacks) over totalItems (count of boxes)
      const pieceCount = Number(
        tracking.totals?.totalContentQty || tracking.totals?.totalItems || 0,
      );

      // ✅ 2. SET TRIP MANIFEST (trip_shipments)
      if (!tripShipmentSnap.exists) {
        tx.set(tripShipmentRef, {
          trackingDocId,
          trackingNumber: tracking.trackingNumber,
          route: `${tracking.originCode} -> ${tracking.destinationCode}`,
          totalItems: pieceCount, // True piece count for the driver to see
          pendingCount: pieceCount,
          loadedCount: 0,
          deliveredCount: 0,
          sender: { name: tracking.sender.name, phone: tracking.sender.phone },
          recipient: {
            name: tracking.recipient.name,
            phone: tracking.recipient.phone,
          },
          createdAt: now,
          createdBy: uid,
          status: "ASSIGNED",
        });
      }

      // ✅ 3. UPDATE MAIN SHIPMENT
      tx.update(shipmentRef, {
        currentTruckTripId: truckTripId,
        assignedToTruckTripAt: now,
        updatedAt: now,
        updatedBy: uid,
        status: "ASSIGNED",
        statusHistory: admin.firestore.FieldValue.arrayUnion({
          status: "ASSIGNED",
          at: new Date(),
          by: uid,
          note: `Assigned to trip ${truckTripId}`,
        }),
      });

      // ✅ 4. UPDATE TRIP COUNTERS (Dashboard Sync)
      tx.update(tripRef, {
        totalItems: admin.firestore.FieldValue.increment(pieceCount),
        itemPending: admin.firestore.FieldValue.increment(pieceCount),
        updatedAt: now,
      });

      // 5. Audit Log
      tx.set(db.collection("admin_logs").doc(), {
        action: "ASSIGN_SHIPMENT_TO_TRIP",
        trackingDocId,
        truckTripId,
        actorId: uid,
        timestamp: now,
      });
    });

    return { success: true };
  },
);
