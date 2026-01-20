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
    if (!trackingDocId || typeof trackingDocId !== "string") {
      throw new HttpsError("invalid-argument", "trackingDocId required");
    }
    if (!truckTripId || typeof truckTripId !== "string") {
      throw new HttpsError("invalid-argument", "truckTripId required");
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

      const tracking = trackingSnap.data();
      const trip = tripSnap.data();

      // 🔒 Hard stop: completed trip
      if (trip.active === false || trip.status === "COMPLETED") {
        throw new HttpsError(
          "failed-precondition",
          "Cannot unassign from completed trip",
        );
      }

      // 🔁 Idempotency: already unassigned
      if (tracking.currentTruckTripId !== truckTripId) {
        return;
      }

      // ❌ MISSING CHECK: MANIFEST LOCK
      if (trip.manifestLocked === true) {
        throw new HttpsError(
          "failed-precondition",
          "Trip Manifest is LOCKED. Unlock it first to remove items.",
        );
      }

      // 🚫 Cannot unassign if any items are loaded
      if (shipSnap.exists) {
        const pkg = shipSnap.data();
        if (Number(pkg.loadedCount || 0) > 0) {
          throw new HttpsError(
            "failed-precondition",
            "Unload all items before unassigning shipment from trip",
          );
        }
      }

      const now = admin.firestore.FieldValue.serverTimestamp();

      // 🧹 Remove trip_shipments (safe: no loaded items)
      if (shipSnap.exists) {
        tx.delete(shipRef);
      }

      // 🔗 Update tracking record
      tx.update(trackingRef, {
        currentTruckTripId: null,
        // unassignedFromTripAt: now,

        updatedAt: now,
        updatedBy: uid,
        updatedRole: role,

        status: "RECEIVED",
        statusHistory: [
          ...(tracking.statusHistory ?? []),
          {
            status: "RECEIVED",
            at: admin.firestore.Timestamp.now(),
          },
        ],
      });

      // 🧾 Status event (timeline-visible)
      tx.set(trackingRef.collection("status_events").doc(), {
        type: "UNASSIGN_FROM_TRIP",
        message: "Unassigned from truck trip",
        truckTripId,
        createdAt: now,
        createdBy: uid,
        updatedRole: role,
      });

      // 📜 Admin audit log
      tx.set(db.collection("admin_logs").doc(), {
        action: "UNASSIGN_SHIPMENT_FROM_TRIP",
        trackingDocId,
        truckTripId,
        actorId: uid,
        actorRole: role,
        createdAt: now,
      });
    });

    return {
      success: true,
      trackingDocId,
      truckTripId,
    };
  },
);
