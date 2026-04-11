"use strict";

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const { requireRole } = require("../../utilities/helpers");

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

/* ======================================================
   ASSIGN DRIVER TO TRUCK TRIP (OPTION B — CANONICAL)
====================================================== */
exports.assignDriverToTruckTrip = onCall(
  { region: "asia-southeast1", maxInstances: 10 },
  async (req) => {
    await requireRole(db, req, ["admin", "manager"]);

    const { truckTripId, driverId, truckPlateNumber, truckId } = req.data || {};
    if (!truckTripId || typeof truckTripId !== "string") {
      throw new HttpsError("invalid-argument", "truckTripId required");
    }
    // if (!driverId || typeof driverId !== "string") {
    //   throw new HttpsError("invalid-argument", "driverId required");
    // }

    const uid = req.auth.uid;
    const role = req.auth.token?.role || "unknown";

    const tripRef = db.collection("truck_trips").doc(truckTripId);
    const driverRef = db.collection("users").doc(driverId);

    await db.runTransaction(async (tx) => {
      const [tripSnap, driverSnap] = await Promise.all([
        tx.get(tripRef),
        tx.get(driverRef),
      ]);

      if (!tripSnap.exists) {
        throw new HttpsError("not-found", "Truck trip not found");
      }
      if (!driverSnap.exists) {
        throw new HttpsError("not-found", "Driver profile not found");
      }

      const trip = tripSnap.data();
      const driver = driverSnap.data();

      if (driver.role !== "driver") {
        throw new HttpsError("failed-precondition", "User is not a driver");
      }

      // 🔒 Hard stop: completed trip
      if (trip.active === false || trip.status === "COMPLETED") {
        throw new HttpsError(
          "failed-precondition",
          "Cannot assign driver to a completed trip",
        );
      }

      // 🔁 Idempotent: already assigned
      if (
        trip.driverId === driverId &&
        trip.truckPlateNumber === truckPlateNumber
      ) {
        return;
      }

      const now = admin.firestore.FieldValue.serverTimestamp();

      // ✅ Update trip
      tx.update(tripRef, {
        driverId,
        driverName: driver.name || "Unknown Driver", // <--- CRITICAL FIX
        truckPlateNumber: truckPlateNumber || trip.truckPlateNumber || null,
        driverAssignedAt: now,
        driverPhone: driver.phone || null, // <--- CRITICAL FIX

        status: "ASSIGNED",

        updatedAt: now,
        updatedBy: uid,
        updatedRole: role,
      });

      // --- Inside the transaction block ---
      // 1. If a new truck is being assigned, update its status
      if (truckId) {
        const truckRef = db.collection("trucks").doc(truckId);

        tx.update(truckRef, {
          status: "ASSIGNED",
          currentTripId: truckTripId,
          updatedAt: now,
        });
      }

      // 2. (Optional but Pro) If the trip already HAD a truck and you are REPLACING it,
      // you should set the OLD truck back to "IDLE"
      if (trip.truckId && trip.truckId !== truckId) {
        const oldTruckRef = db.collection("trucks").doc(trip.truckId);
        tx.update(oldTruckRef, {
          status: "IDLE",
          currentTripId: null,
          updatedAt: now,
        });
      }

      // 🧾 Audit log
      tx.set(db.collection("admin_logs").doc(), {
        action: "ASSIGN_DRIVER",
        truckTripId,
        driverId,
        actorId: uid,
        actorRole: role,
        createdAt: now,
      });
    });

    return {
      success: true,
      truckTripId,
      driverId,
    };
  },
);
