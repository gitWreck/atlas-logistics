"use strict";

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const { requireRole } = require("../utilities/helpers");

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

/* ======================================================
   ASSIGN DRIVER/TRUCK TO TRUCK TRIP
====================================================== */
exports.assignmentToTruckTrip = onCall(
  { region: "asia-southeast1", maxInstances: 10 },
  async (req) => {
    await requireRole(db, req, ["admin", "manager"]);

    const {
      truckTripId,
      driverId = null,
      truckId = null,
      truckPlateNumber = null,
    } = req.data || {};

    if (!truckTripId || typeof truckTripId !== "string") {
      throw new HttpsError("invalid-argument", "truckTripId is required");
    }

    if (!driverId && !truckId) {
      throw new HttpsError(
        "invalid-argument",
        "At least one of driverId or truckId is required",
      );
    }

    const uid = req.auth.uid;
    const role = req.auth.token?.role || "unknown";

    const tripRef = db.collection("truck_trips").doc(truckTripId);

    await db.runTransaction(async (tx) => {
      // =========================
      // 1. READ MAIN TRIP
      // =========================
      const tripSnap = await tx.get(tripRef);
      if (!tripSnap.exists) {
        throw new HttpsError("not-found", "Truck trip not found");
      }

      const trip = tripSnap.data();

      if (trip.manifestLocked) {
        throw new HttpsError(
          "failed-precondition",
          "Manifest is locked. Unlock it before changing the assignment.",
        );
      }

      if (trip.active === false || trip.status === "COMPLETED") {
        throw new HttpsError(
          "failed-precondition",
          "Cannot assign driver or truck to a completed trip",
        );
      }

      const currentDriverId = trip.driverId || null;
      const currentTruckId = trip.truckId || null;

      // =========================
      // 2. PREP REFS
      // =========================
      const driverRef = driverId ? db.collection("users").doc(driverId) : null;
      const newTruckRef = truckId ? db.collection("trucks").doc(truckId) : null;
      const oldTruckRef =
        currentTruckId && currentTruckId !== truckId
          ? db.collection("trucks").doc(currentTruckId)
          : null;

      // =========================
      // 3. READ RELATED DOCS
      //    (ALL READS BEFORE WRITES)
      // =========================
      let driverSnap = null;
      let newTruckSnap = null;

      if (driverRef) {
        driverSnap = await tx.get(driverRef);
        if (!driverSnap.exists) {
          throw new HttpsError("not-found", "Driver not found");
        }

        const driverData = driverSnap.data();
        const driverRole = String(driverData.role || "").toLowerCase();

        if (driverRole !== "driver") {
          throw new HttpsError(
            "failed-precondition",
            "Selected user is not a driver",
          );
        }
      }

      if (newTruckRef) {
        newTruckSnap = await tx.get(newTruckRef);
        if (!newTruckSnap.exists) {
          throw new HttpsError("not-found", "Truck not found");
        }
      }

      const driverData = driverSnap?.data() || null;
      const newTruckData = newTruckSnap?.data() || null;

      const resolvedDriverName =
        driverData?.fullName ||
        driverData?.name ||
        driverData?.displayName ||
        trip.driverName ||
        null;

      const resolvedDriverPhone =
        driverData?.phoneNumber || driverData?.mobileNumber || null;

      const resolvedTruckPlateNumber =
        truckPlateNumber ||
        newTruckData?.plateNumber ||
        trip.truckPlateNumber ||
        null;

      // Idempotent if nothing materially changes
      const sameDriver = currentDriverId === (driverId || null);
      const sameTruck = currentTruckId === (truckId || null);
      const samePlate =
        (trip.truckPlateNumber || null) === (resolvedTruckPlateNumber || null);

      if (sameDriver && sameTruck && samePlate) {
        return;
      }

      const now = admin.firestore.FieldValue.serverTimestamp();

      // =========================
      // 6. WRITE TRIP UPDATE
      // =========================
      tx.update(tripRef, {
        driverId: driverId || null,
        driverName: driverId ? resolvedDriverName : null,
        driverPhone: driverId ? resolvedDriverPhone : null,
        truckId: truckId || null,
        truckPlateNumber: truckId ? resolvedTruckPlateNumber : null,
        driverAssignedAt: now,
        updatedAt: now,
        updatedBy: uid,
        updatedRole: role,
        lastUpdatedAt: now,
        lastUpdatedBy: uid,
        lastUpdatedRole: role,
      });

      // =========================
      // 7. WRITE NEW TRUCK UPDATE
      // =========================
      if (newTruckRef && newTruckSnap?.exists) {
        tx.update(newTruckRef, {
          status: "ASSIGNED",
          // currentTripId: truckTripId,
          updatedAt: now,
          updatedBy: uid,
        });
      }

      // =========================
      // 9. STATUS EVENT
      // =========================
      tx.set(tripRef.collection("status_events").doc(), {
        type: "ASSIGN_DRIVER_TRUCK",
        message: "Driver and/or truck assignment updated for truck trip",
        createdAt: now,
        createdBy: uid,
        createdRole: role,
        driverId: driverId || null,
        truckId: truckId || null,
      });

      // =========================
      // 10. ADMIN LOG
      // =========================
      tx.set(db.collection("admin_logs").doc(), {
        action: "ASSIGN_DRIVER_TO_TRIP",
        truckTripId,
        previousDriverId: currentDriverId,
        newDriverId: driverId || null,
        previousTruckId: currentTruckId,
        newTruckId: truckId || null,
        actorId: uid,
        actorRole: role,
        createdAt: now,
      });
    });

    return {
      success: true,
      truckTripId,
      driverId: driverId || null,
      truckId: truckId || null,
    };
  },
);
