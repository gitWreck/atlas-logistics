"use strict";

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const { requireRole } = require("../../utilities/helpers");

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

/* ======================================================
   REMOVE DRIVER/TRUCK ASSIGNMENT FROM TRUCK TRIP
====================================================== */
exports.removeAssignmentFromTruckTrip = onCall(
  { region: "asia-southeast1", maxInstances: 10 },
  async (req) => {
    await requireRole(db, req, ["admin", "manager"]);

    const { truckTripId } = req.data || {};
    if (!truckTripId || typeof truckTripId !== "string") {
      throw new HttpsError("invalid-argument", "truckTripId is required");
    }

    const uid = req.auth?.uid;
    const role = req.auth?.token?.role || "unknown";

    const tripRef = db.collection("truck_trips").doc(truckTripId);
    const eventsRef = tripRef.collection("status_events");
    const adminLogRef = db.collection("admin_logs").doc();

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
          "Cannot remove assignment from a completed trip",
        );
      }

      const assignedTruckId = trip.truckId || null;
      const assignedDriverId = trip.driverId || null;

      const hadAssignment = Boolean(
        assignedTruckId ||
        assignedDriverId ||
        trip.driverName ||
        trip.driverPhone ||
        trip.truckPlateNumber,
      );

      // Idempotent: nothing assigned anymore
      if (!hadAssignment) {
        return;
      }

      const now = admin.firestore.FieldValue.serverTimestamp();

      let truckRef = null;
      let truckSnap = null;
      let otherTripsUsingTruckSnap = null;

      // =========================
      // 2. READ TRUCK + OTHER TRIPS
      //    (ALL READS BEFORE WRITES)
      // =========================
      if (assignedTruckId) {
        truckRef = db.collection("trucks").doc(assignedTruckId);
        truckSnap = await tx.get(truckRef);

        const otherTripsQuery = db
          .collection("truck_trips")
          .where("truckId", "==", assignedTruckId)
          .where("active", "==", true);

        otherTripsUsingTruckSnap = await tx.get(otherTripsQuery);
      }

      // Determine remaining active/non-terminal trips still using this truck
      const remainingTripsUsingTruck = assignedTruckId
        ? (otherTripsUsingTruckSnap?.docs || [])
            .filter((doc) => doc.id !== truckTripId)
            .map((doc) => ({ id: doc.id, ...doc.data() }))
            .filter((otherTrip) => {
              const status = String(otherTrip.status || "").toUpperCase();
              return (
                otherTrip.active !== false &&
                status !== "COMPLETED" &&
                status !== "CANCELLED"
              );
            })
        : [];

      const stillAssignedElsewhere = remainingTripsUsingTruck.length > 0;
      const nextCurrentTripId = stillAssignedElsewhere
        ? remainingTripsUsingTruck.sort((a, b) => {
            const aTime =
              a.plannedDeparture?.toMillis?.() ||
              a.plannedDeparture?._seconds * 1000 ||
              (a.plannedDeparture
                ? new Date(a.plannedDeparture).getTime()
                : Number.POSITIVE_INFINITY);
            const bTime =
              b.plannedDeparture?.toMillis?.() ||
              b.plannedDeparture?._seconds * 1000 ||
              (b.plannedDeparture
                ? new Date(b.plannedDeparture).getTime()
                : Number.POSITIVE_INFINITY);
            return aTime - bTime;
          })[0]?.id || null
        : null;

      // =========================
      // 3. WRITE TRIP UPDATE
      // =========================
      tx.update(tripRef, {
        driverId: null,
        driverName: null,
        driverPhone: null,
        truckId: null,
        truckPlateNumber: null,
        updatedAt: now,
        updatedBy: uid,
        updatedRole: role,
      });

      // =========================
      // 4. WRITE TRUCK SUMMARY UPDATE
      // =========================
      if (assignedTruckId && truckSnap?.exists) {
        const truckUpdate = {
          updatedAt: now,
          updatedBy: uid,
        };

        if (stillAssignedElsewhere) {
          // Truck is still in use somewhere else, so keep it non-idle
          truckUpdate.status = "ACTIVE";
          truckUpdate.currentTripId = nextCurrentTripId;
        } else {
          // No more active trips for this truck
          truckUpdate.status = "IDLE";
          truckUpdate.currentTripId = null;
        }

        tx.update(truckRef, truckUpdate);
      }

      // =========================
      // 5. STATUS EVENT
      // =========================
      tx.set(eventsRef.doc(), {
        type: "REMOVE_ASSIGNMENT",
        message: stillAssignedElsewhere
          ? "Driver and truck assignment removed from trip. Truck remains assigned to another active trip."
          : "Driver and truck assignment removed from trip. Truck is now idle.",
        createdAt: now,
        createdBy: uid,
        createdRole: role,
        previousDriverId: assignedDriverId,
        previousTruckId: assignedTruckId,
        truckStillAssignedElsewhere: stillAssignedElsewhere,
        nextCurrentTripId: nextCurrentTripId,
      });

      // =========================
      // 6. ADMIN LOG
      // =========================
      tx.set(adminLogRef, {
        action: "REMOVE_ASSIGNMENT_FROM_TRIP",
        truckTripId,
        previousDriverId: assignedDriverId,
        previousTruckId: assignedTruckId,
        truckMarkedIdle: assignedTruckId ? !stillAssignedElsewhere : false,
        truckStillAssignedElsewhere: assignedTruckId
          ? stillAssignedElsewhere
          : false,
        nextCurrentTripId: nextCurrentTripId,
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
