"use strict";

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const { requireRole } = require("./_shared");

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

/* ======================================================
   ASSIGN SHIPMENT TO TRUCK TRIP (OPTION B — CANONICAL)
====================================================== */
exports.assignShipmentToTruckTrip = onCall(
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
          "Cannot assign shipment to completed trip"
        );
      }

      // 🔁 Idempotency: already assigned to this trip
      if (tracking.currentTruckTripId === truckTripId) {
        return;
      }

      const now = admin.firestore.FieldValue.serverTimestamp();

      // 📦 Ensure trip_package exists (NO loading yet)
      if (!pkgSnap.exists) {
        tx.set(pkgRef, {
          trackingDocId,
          trackingNumber: tracking.trackingNumber || null,
          route: tracking.route || null,
          totalItems:
            Number(tracking.totalItems || tracking.itemCount || 0) || null,

          loadedCount: 0,
          pendingCount: Number(tracking.pendingCount || 0),

          createdAt: now,
          createdBy: uid,
          createdRole: role,
          lastUpdatedAt: now,
        });
      }

      // 🔗 Update tracking record
      tx.update(trackingRef, {
        currentTruckTripId: truckTripId,
        assignedToTripAt: now,
        lastUpdatedAt: now,
        lastUpdatedBy: uid,
        lastUpdatedRole: role,
      });

      // 🧾 Status event (timeline-visible)
      tx.set(trackingRef.collection("status_events").doc(), {
        type: "ASSIGN_TO_TRIP",
        message: `Assigned to truck trip`,
        truckTripId,
        createdAt: now,
        createdBy: uid,
        createdRole: role,
      });

      // 🧾 Admin audit log
      tx.set(db.collection("admin_logs").doc(), {
        action: "ASSIGN_SHIPMENT_TO_TRIP",
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
