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
const {
  sendAutomaticTripLifecycleNotification,
  CUSTOMER_NOTIFICATION_TYPES,
} = require("../notifications/customerNotificationService");
const {
  SEMAPHORE_API_KEY,
  SEMAPHORE_SENDER_NAME,
} = require("../../shared/sms-service");
const { defineSecret } = require("firebase-functions/params");
const { canAccessRecord } = require("../manager/managerAccess");

const SMTP_EMAIL = defineSecret("SMTP_EMAIL");
const SMTP_PASSWORD = defineSecret("SMTP_PASSWORD");

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

exports.startReceiving = onCall(
  {
    region: "asia-southeast1",
    maxInstances: 10,
    secrets: [SEMAPHORE_API_KEY, SEMAPHORE_SENDER_NAME, SMTP_EMAIL, SMTP_PASSWORD],
  },
  async (req) => {
    const actor = await requireRole(db, req, ["admin", "manager"]);

    const tripId = requireString(req.data?.tripId, "tripId");
    const uid = req.auth.uid;

    const userSnap = await db.collection("users").doc(uid).get();
    const actorName = String(userSnap.data()?.name || "").trim() || "Unknown User";

    const tripRef = db.collection("truck_trips").doc(tripId);

    const result = await db.runTransaction(async (tx) => {
      const tripSnap = await tx.get(tripRef);
      if (!tripSnap.exists) {
        throw new HttpsError("not-found", "Trip not found");
      }

      const trip = tripSnap.data() || {};
      if (
        actor.role === "manager" &&
        !canAccessRecord(actor.user, { id: tripId, ...trip })
      ) {
        throw new HttpsError(
          "permission-denied",
          "This trip is outside your assigned warehouse or municipality.",
        );
      }
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

    if (result.success && !result.resumed && result.status === "ARRIVED") {
      try {
        const tripShipSnap = await tripRef.collection("trip_shipments").get();
        const manifestShipmentSnaps = await Promise.all(
          tripShipSnap.docs.map((doc) =>
            db.collection("shipments").doc(doc.id).get(),
          ),
        );
        const manifestShipments = manifestShipmentSnaps
          .filter((snap) => snap.exists)
          .map((snap) => ({ id: snap.id, ...snap.data() }));

        result.customerNotification = await sendAutomaticTripLifecycleNotification({
          db,
          tripId,
          notificationType: CUSTOMER_NOTIFICATION_TYPES.ARRIVED_AT_ODIONGAN,
          shipments: manifestShipments,
          source: "START_RECEIVING",
          actor: {
            uid,
            name: actorName,
            role: req.auth.token?.role || null,
          },
        });
      } catch (notificationError) {
        console.error(
          "[startReceiving] Customer notification failed:",
          notificationError,
        );
      }
    }

    return result;
  },
);
