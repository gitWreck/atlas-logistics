"use strict";

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const { FieldValue } = require("firebase-admin/firestore");
const { requireRole, requireString } = require("../utilities/helpers");
const { writeTripActionLog } = require("../utilities/tripLogger");
const {
  MANIFEST_STATUS,
  canStartReceiving,
  canResumeReceiving,
  isHubTransferTrip,
  normalizeTripStatus,
} = require("./manifestStatus");

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

exports.startReceiving = onCall(
  { region: "asia-southeast1", maxInstances: 10 },
  async (req) => {
    await requireRole(db, req, ["admin", "manager"]);

    const tripId = requireString(req.data?.tripId, "tripId");
    const uid = req.auth.uid;

    const userSnap = await db.collection("users").doc(uid).get();
    const actorName = String(userSnap.data()?.name || "").trim() || "Unknown User";

    const tripRef = db.collection("truck_trips").doc(tripId);

    return db.runTransaction(async (tx) => {
      const tripSnap = await tx.get(tripRef);
      if (!tripSnap.exists) {
        throw new HttpsError("not-found", "Trip not found");
      }

      const trip = tripSnap.data() || {};
      const isResume = canResumeReceiving(trip);

      if (!isHubTransferTrip(trip)) {
        throw new HttpsError(
          "failed-precondition",
          "Start Receiving is only available for hub transfer trips.",
        );
      }

      if (!canStartReceiving(trip) && !isResume) {
        const status = String(trip.status || "").toUpperCase();
        if (trip.receivingStartedAt && !trip.manifestReopenedAt) {
          throw new HttpsError(
            "failed-precondition",
            "Receiving has already been started on this trip.",
          );
        }
        if (trip.manifestReopenedAt && !trip.correctionDispatchedAt && !trip.dispatchedAt) {
          throw new HttpsError(
            "failed-precondition",
            "Dispatch correction loads before resuming receiving.",
          );
        }
        throw new HttpsError(
          "failed-precondition",
          `Cannot start receiving from trip status ${status}. Trip must be IN_TRANSIT with a locked manifest, or ARRIVED after correction dispatch.`,
        );
      }

      const now = FieldValue.serverTimestamp();
      const manifestId = trip.manifestId || null;

      if (isResume) {
        const resumeFromInTransit =
          normalizeTripStatus(trip.status) === "IN_TRANSIT";

        tx.update(tripRef, {
          ...(resumeFromInTransit ? { status: "ARRIVED" } : {}),
          manifestStatus: MANIFEST_STATUS.RECEIVING_IN_PROGRESS,
          manifestLocked: true,
          receivingResumedAt: now,
          receivingResumedBy: uid,
          receivingResumedByName: actorName,
          updatedAt: now,
          updatedBy: actorName,
        });

        if (manifestId) {
          const manifestRef = db.collection("manifests").doc(manifestId);
          tx.update(manifestRef, {
            status: MANIFEST_STATUS.RECEIVING_IN_PROGRESS,
            updatedAt: now,
          });
        }

        const manifestEventRef = tripRef.collection("manifest_events").doc();
        tx.set(manifestEventRef, {
          type: "RECEIVING_RESUMED",
          manifestId,
          createdAt: now,
          createdBy: uid,
          createdByName: actorName,
        });

        writeTripActionLog({
          db,
          tx,
          collection: "audit_logs",
          action: "RESUME_RECEIVING",
          targetCollection: "truck_trips",
          targetId: tripId,
          tripId,
          actorId: uid,
          actorName,
          actorRole: req.auth.token?.role || null,
          details: {
            tripNumber: trip.tripId || tripId,
            previousManifestStatus: trip.manifestStatus || null,
            newManifestStatus: MANIFEST_STATUS.RECEIVING_IN_PROGRESS,
            plateNumber: trip.truckPlateNumber || trip.plateNumber || null,
            driverName: trip.driverName || null,
          },
          note: "Receiving resumed after manifest correction on arrived trip.",
          timestamp: now,
        });

        return {
          success: true,
          tripId,
          status: "ARRIVED",
          manifestStatus: MANIFEST_STATUS.RECEIVING_IN_PROGRESS,
          resumed: true,
        };
      }

      tx.update(tripRef, {
        status: "ARRIVED",
        manifestStatus: MANIFEST_STATUS.RECEIVING_IN_PROGRESS,
        manifestLocked: true,
        arrivedAt: now,
        receivingStartedAt: now,
        receivingStartedBy: uid,
        receivingStartedByName: actorName,
        updatedAt: now,
        updatedBy: actorName,
      });

      if (manifestId) {
        const manifestRef = db.collection("manifests").doc(manifestId);
        tx.update(manifestRef, {
          status: MANIFEST_STATUS.RECEIVING_IN_PROGRESS,
          updatedAt: now,
        });
      }

      const manifestEventRef = tripRef.collection("manifest_events").doc();
      tx.set(manifestEventRef, {
        type: "RECEIVING_STARTED",
        manifestId,
        createdAt: now,
        createdBy: uid,
        createdByName: actorName,
      });

      writeTripActionLog({
        db,
        tx,
        collection: "audit_logs",
        action: "START_RECEIVING",
        targetCollection: "truck_trips",
        targetId: tripId,
        tripId,
        actorId: uid,
        actorName,
        actorRole: req.auth.token?.role || null,
        details: {
          tripNumber: trip.tripId || tripId,
          previousStatus: trip.status || null,
          newStatus: "ARRIVED",
          previousManifestStatus: trip.manifestStatus || null,
          newManifestStatus: MANIFEST_STATUS.RECEIVING_IN_PROGRESS,
          plateNumber: trip.truckPlateNumber || trip.plateNumber || null,
          driverName: trip.driverName || null,
        },
        note: "Trip arrived and receiving started at destination hub.",
        timestamp: now,
      });

      writeTripActionLog({
        db,
        tx,
        collection: "audit_logs",
        action: "TRIP_ARRIVED",
        targetCollection: "truck_trips",
        targetId: tripId,
        tripId,
        actorId: uid,
        actorName,
        actorRole: req.auth.token?.role || null,
        details: {
          tripNumber: trip.tripId || tripId,
          source: "START_RECEIVING",
        },
        timestamp: now,
      });

      return {
        success: true,
        tripId,
        status: "ARRIVED",
        manifestStatus: MANIFEST_STATUS.RECEIVING_IN_PROGRESS,
      };
    });
  },
);
