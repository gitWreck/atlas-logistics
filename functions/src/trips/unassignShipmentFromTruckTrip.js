"use strict";

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const { requireRole } = require("./../../_shared");

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

/* ======================================================
   UNASSIGN SHIPMENT FROM TRUCK TRIP (OPTION B — CANONICAL)
====================================================== */
exports.unassignShipmentFromTruckTrip = onCall(
  { region: "asia-southeast1" },
  async (req) => {
    await requireRole(req, ["admin", "manager"]);

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

    const trackingRef = db.collection("tracking_records").doc(trackingDocId);
    const tripRef = db.collection("truck_trips").doc(truckTripId);
    const pkgRef = tripRef.collection("trip_packages").doc(trackingDocId);

    await db.runTransaction(async (tx) => {
      const [trackingSnap, tripSnap, pkgSnap] = await Promise.all([
        tx.get(trackingRef),
        tx.get(tripRef),
        tx.get(pkgRef),
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
          "Cannot unassign from completed trip"
        );
      }

      // 🔁 Idempotency: already unassigned
      if (tracking.currentTruckTripId !== truckTripId) {
        return;
      }

      // 🚫 Cannot unassign if any items are loaded
      if (pkgSnap.exists) {
        const pkg = pkgSnap.data();
        if (Number(pkg.loadedCount || 0) > 0) {
          throw new HttpsError(
            "failed-precondition",
            "Unload all items before unassigning shipment from trip"
          );
        }
      }

      const now = admin.firestore.FieldValue.serverTimestamp();

      // 🧹 Remove trip_package (safe: no loaded items)
      if (pkgSnap.exists) {
        tx.delete(pkgRef);
      }

      // 🔗 Update tracking record
      tx.update(trackingRef, {
        currentTruckTripId: null,
        unassignedFromTripAt: now,
        lastUpdatedAt: now,
        lastUpdatedBy: uid,
        lastUpdatedRole: role,
      });

      // 🧾 Status event (timeline-visible)
      tx.set(trackingRef.collection("status_events").doc(), {
        type: "UNASSIGN_FROM_TRIP",
        message: "Unassigned from truck trip",
        truckTripId,
        createdAt: now,
        createdBy: uid,
        createdRole: role,
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
  }
);
