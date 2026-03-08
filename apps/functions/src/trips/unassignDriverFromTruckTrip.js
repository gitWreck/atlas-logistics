"use strict";

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const { requireRole } = require("../utilities/helpers");

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

/* ======================================================
   UNASSIGN DRIVER FROM TRUCK TRIP (OPTION B — CANONICAL)
====================================================== */
exports.unassignDriverFromTruckTrip = onCall(
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
    const eventsRef = tripRef.collection("status_events");

    await db.runTransaction(async (tx) => {
      const tripSnap = await tx.get(tripRef);
      if (!tripSnap.exists) {
        throw new HttpsError("not-found", "Truck trip not found");
      }

      const trip = tripSnap.data();

      if (trip.manifestLocked) {
        throw new HttpsError(
          "failed-precondition",
          "Manifest is locked. Unlock it before changing drivers.",
        );
      }

      // 🔒 Hard stop: completed trip
      if (trip.active === false || trip.status === "COMPLETED") {
        throw new HttpsError(
          "failed-precondition",
          "Cannot unassign driver from completed trip",
        );
      }

      // 🔁 Idempotency: already unassigned
      if (!trip.driverId) {
        return;
      }

      const assignedTruckId = trip.truckId;
      const now = admin.firestore.FieldValue.serverTimestamp();

      if (assignedTruckId) {
        const truckRef = db.collection("trucks").doc(assignedTruckId);

        tx.update(truckRef, {
          status: "IDLE", // Set it back to available
          currentTripId: null, // Remove the link to this trip
          updatedAt: now,
          updatedBy: uid,
        });
      }

      // 🚚 Update trip
      tx.update(tripRef, {
        driverId: null,
        driverName: null, // <--- ADD THIS to clear the name
        driverPhone: null, // <--- ADD THIS to clear the phone
        truckPlateNumber: null, // <--- OPTIONAL: Do you want to remove the truck too? Usually yes.
        truckId: null,
        status: "CREATED", // Reset status to CREATED or maybe a new status like "UNASSIGNED"?
        // driverUnassignedAt: now,
        updatedAt: now,
        updatedBy: uid,
        updatedRole: role,
      });

      // 🧾 Trip status event
      tx.set(eventsRef.doc(), {
        type: "UNASSIGN_DRIVER",
        message: "Driver unassigned from truck trip",
        createdAt: now,
        createdBy: uid,
        createdRole: role,
      });

      // 📜 Admin audit log
      tx.set(db.collection("admin_logs").doc(), {
        action: "UNASSIGN_DRIVER_FROM_TRIP",
        truckTripId,
        actorId: uid,
        actorRole: role,
        createdAt: now,
      });
    });

    return {
      success: true,
      truckTripId,
    };
  },
);
