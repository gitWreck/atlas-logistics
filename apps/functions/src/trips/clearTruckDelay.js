"use strict";

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const { requireRole } = require("../utilities/helpers");

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

/* ======================================================
   CLEAR TRUCK DELAY (OPTION B — CANONICAL)
====================================================== */
exports.clearTruckDelay = onCall(
  { region: "asia-southeast1", maxInstances: 10 },
  async (req) => {
    await requireRole(db, req, ["admin", "manager"]);

    const { truckTripId } = req.data || {};
    if (!truckTripId || typeof truckTripId !== "string") {
      throw new HttpsError("invalid-argument", "truckTripId required");
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
          "Cannot clear delay on a completed trip",
        );
      }

      // 🔁 Idempotent: already cleared
      if (!trip.delayReason && trip.delayClearedAt) {
        return;
      }

      const now = admin.firestore.FieldValue.serverTimestamp();

      tx.update(tripRef, {
        delayReason: null,
        delayClearedAt: now,
        delayCleared: true,

        updatedAt: now,
        updatedBy: uid,
        updatedRole: role,
      });

      // 🧾 Audit log
      tx.set(db.collection("admin_logs").doc(), {
        action: "CLEAR_TRUCK_DELAY",
        truckTripId,
        actorId: uid,
        actorRole: role,
        createdAt: now,
      });
    });

    return {
      success: true,
      truckTripId,
      delayed: false,
    };
  },
);
