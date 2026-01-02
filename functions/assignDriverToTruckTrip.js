"use strict";

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const { requireRole } = require("./_shared");

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

/* ======================================================
   ASSIGN DRIVER TO TRUCK TRIP (OPTION B — CANONICAL)
====================================================== */
exports.assignDriverToTruckTrip = onCall(
  { region: "asia-southeast1" },
  async (req) => {
    await requireRole(req, ["admin", "manager"]);

    const { truckTripId, driverId } = req.data || {};
    if (!truckTripId || typeof truckTripId !== "string") {
      throw new HttpsError("invalid-argument", "truckTripId required");
    }
    if (!driverId || typeof driverId !== "string") {
      throw new HttpsError("invalid-argument", "driverId required");
    }

    const uid = req.auth.uid;
    const role = req.auth.token?.role || "unknown";

    const tripRef = db.collection("truck_trips").doc(truckTripId);

    await db.runTransaction(async (tx) => {
      const snap = await tx.get(tripRef);
      if (!snap.exists) {
        throw new HttpsError("not-found", "Truck trip not found");
      }

      const trip = snap.data();

      // 🔒 Hard stop: completed trip
      if (trip.active === false || trip.status === "COMPLETED") {
        throw new HttpsError(
          "failed-precondition",
          "Cannot assign driver to a completed trip"
        );
      }

      // 🔁 Idempotent: already assigned
      if (trip.driverId === driverId) {
        return;
      }

      const now = admin.firestore.FieldValue.serverTimestamp();

      // ✅ Update trip
      tx.update(tripRef, {
        driverId,
        driverAssignedAt: now,
        lastUpdatedAt: now,
        lastUpdatedBy: uid,
        lastUpdatedRole: role
      });

      // 🧾 Audit log
      tx.set(db.collection("admin_logs").doc(), {
        action: "ASSIGN_DRIVER",
        truckTripId,
        driverId,
        actorId: uid,
        actorRole: role,
        createdAt: now
      });
    });

    return {
      success: true,
      truckTripId,
      driverId
    };
  }
);
