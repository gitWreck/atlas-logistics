"use strict";

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const { FieldValue } = require("firebase-admin/firestore");
const { requireRole, requireString } = require("../utilities/helpers");
const { writeTripActionLog } = require("../utilities/tripLogger");
const { writeShipmentEvent } = require("../tracking/writeShipmentEvent");
const { EVENT_TYPES } = require("../tracking/eventTypes");
const { extractTripEventContext } = require("../tracking/tripEventContext");
const {
  packageOnTrip,
  applyLinehaulInTransit,
  buildShipmentSnapshot,
  normalizePackageRow,
} = require("../packages/tripPackageOperations");
const { PACKAGE_STATUS } = require("../packages/packageStatus");
const {
  canDispatchTrip,
  canDispatchCorrectionTrip,
  isHubTransferTrip,
  MANIFEST_STATUS,
} = require("./manifestStatus");
const { sealManifestAmendment } = require("./manifestAmendment");
const {
  sendAutomaticTripLifecycleNotification,
  CUSTOMER_NOTIFICATION_TYPES,
} = require("../notifications/customerNotificationService");
const {
  SEMAPHORE_API_KEY,
  SEMAPHORE_SENDER_NAME,
} = require("../../shared/sms-service");
const { defineSecret } = require("firebase-functions/params");

const SMTP_EMAIL = defineSecret("SMTP_EMAIL");
const SMTP_PASSWORD = defineSecret("SMTP_PASSWORD");

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

exports.dispatchTrip = onCall(
  {
    region: "asia-southeast1",
    maxInstances: 10,
    secrets: [SEMAPHORE_API_KEY, SEMAPHORE_SENDER_NAME, SMTP_EMAIL, SMTP_PASSWORD],
  },
  async (req) => {
    await requireRole(db, req, ["admin", "manager"]);

    const tripId = requireString(req.data?.tripId, "tripId");
    const location = req.data?.location || null;
    const uid = req.auth.uid;

    const userSnap = await db.collection("users").doc(uid).get();
    const actorName =
      String(userSnap.data()?.name || "").trim() || "Unknown User";

    const tripRef = db.collection("truck_trips").doc(tripId);
    const tripSnap = await tripRef.get();

    if (!tripSnap.exists) {
      throw new HttpsError("not-found", "Trip not found");
    }

    const trip = tripSnap.data() || {};
    const isCorrectionDispatch = canDispatchCorrectionTrip(trip);

    if (!isHubTransferTrip(trip)) {
      throw new HttpsError(
        "failed-precondition",
        "Dispatch Trip is only available for hub transfer trips.",
      );
    }

    if (!canDispatchTrip(trip) && !isCorrectionDispatch) {
      throw new HttpsError(
        "failed-precondition",
        "Trip must be LOADED (or IN_TRANSIT pending dispatch) with a locked manifest before dispatch.",
      );
    }

    const shipQuery = await tripRef.collection("trip_shipments").get();
    const shipmentCount = shipQuery.size;
    const nowIso = new Date().toISOString();
    const timestamp = FieldValue.serverTimestamp();

    await db.runTransaction(async (tx) => {
      const freshTripSnap = await tx.get(tripRef);
      const freshTrip = freshTripSnap.data() || trip;
      const shipmentWrites = [];

      for (const tripShipDoc of shipQuery.docs) {
        const shipmentId = tripShipDoc.id;
        const shipmentRef = db.collection("shipments").doc(shipmentId);
        const shipmentSnap = await tx.get(shipmentRef);

        if (!shipmentSnap.exists) continue;

        const shipmentData = shipmentSnap.data() || {};
        const oldPackages = Array.isArray(shipmentData.packages)
          ? shipmentData.packages.map(normalizePackageRow)
          : [];

        const hasTripPackages = oldPackages.some((pkg) =>
          packageOnTrip(pkg, tripId),
        );
        if (!hasTripPackages) continue;

        const updatedPackages = oldPackages.map((pkg) => {
          if (!packageOnTrip(pkg, tripId)) return pkg;

          if (isCorrectionDispatch) {
            const pkgStatus = String(pkg.status || "").toUpperCase();
            if (pkgStatus !== PACKAGE_STATUS.LOADED_TO_TRIP) return pkg;
          }

          return applyLinehaulInTransit(pkg, { tripId, nowIso });
        });

        const snapshot = buildShipmentSnapshot(updatedPackages, {
          previousStatus: shipmentData.status,
        });

        const historyEntry = {
          status: snapshot.status,
          at: admin.firestore.Timestamp.now(),
          note: isCorrectionDispatch
            ? `Trip ${trip.tripId || tripId} correction dispatch — newly loaded packages marked in transit.`
            : `Trip ${trip.tripId || tripId} dispatched — packages on this trip marked in transit.`,
          by: uid,
          location: location || null,
        };

        shipmentWrites.push({
          tripShipRef: tripShipDoc.ref,
          shipmentRef,
          snapshot,
          historyEntry,
        });
      }

      tx.update(
        tripRef,
        isCorrectionDispatch
          ? {
              status: "ARRIVED",
              manifestStatus: MANIFEST_STATUS.LOCKED,
              manifestLocked: true,
              correctionDispatchedAt: timestamp,
              correctionDispatchedBy: uid,
              correctionDispatchedByName: actorName,
              updatedAt: timestamp,
              updatedBy: actorName,
            }
          : {
              status: "IN_TRANSIT",
              manifestStatus: MANIFEST_STATUS.LOCKED,
              manifestLocked: true,
              startedAt: timestamp,
              dispatchedAt: timestamp,
              dispatchedBy: uid,
              dispatchedByName: actorName,
              updatedAt: timestamp,
              updatedBy: actorName,
              startedBy: uid,
            },
      );

      for (const {
        tripShipRef,
        shipmentRef,
        snapshot,
        historyEntry,
      } of shipmentWrites) {
        tx.update(tripShipRef, {
          status: snapshot.status,
          updatedAt: timestamp,
        });

        tx.update(shipmentRef, {
          status: snapshot.status,
          packages: snapshot.packages,
          packageBreakdown: snapshot.packageBreakdown,
          currentTripIds: snapshot.currentTripIds,
          currentTripId: snapshot.currentTripId,
          updatedAt: timestamp,
          statusHistory: FieldValue.arrayUnion(historyEntry),
          ...(location ? { lastLocation: location } : {}),
        });
      }

      writeTripActionLog({
        db,
        tx,
        collection: "audit_logs",
        action: isCorrectionDispatch ? "DISPATCH_CORRECTION" : "DISPATCH_TRIP",
        targetCollection: "truck_trips",
        targetId: tripId,
        tripId,
        actorId: uid,
        actorName,
        actorRole: req.auth.token?.role || null,
        details: {
          tripNumber: trip.tripId || tripId,
          plateNumber: trip.truckPlateNumber || trip.plateNumber || "N/A",
          driverName: trip.driverName || null,
          driverId: trip.driverId || null,
          packagesUpdated: shipmentCount,
          previousStatus: trip.status || "LOADED",
          newStatus: isCorrectionDispatch ? "ARRIVED" : "IN_TRANSIT",
          correctionDispatch: isCorrectionDispatch,
        },
        note: isCorrectionDispatch
          ? "Correction loads dispatched on arrived trip."
          : "Trip dispatched from origin hub.",
        timestamp,
      });

      if (isCorrectionDispatch) {
        sealManifestAmendment({
          tx,
          db,
          tripRef,
          trip: freshTrip,
          tripDocId: tripId,
          actorId: uid,
          actorName,
          actorRole: req.auth.token?.role || null,
          reason:
            freshTrip.manifestReopenReason ||
            "Correction dispatch — manifest addendum sealed.",
        });
      }
    });

    const tripContext = extractTripEventContext(trip, tripId);
    await Promise.all(
      shipQuery.docs.map((doc) =>
        writeShipmentEvent({
          db,
          event: {
            shipmentId: doc.id,
            eventType: EVENT_TYPES.IN_TRANSIT,
            ...tripContext,
            location: location || null,
            createdBy: uid,
            createdByRole: req.auth.token?.role || null,
            remarks: `Trip ${tripContext.tripId || tripId} dispatched`,
            source: "DISPATCH_TRIP",
          },
        }).catch((error) => {
          console.error(`IN_TRANSIT event write failed for ${doc.id}:`, error);
        }),
      ),
    );

    let customerNotificationResult = null;
    if (!isCorrectionDispatch) {
      try {
        const manifestShipmentSnaps = await Promise.all(
          shipQuery.docs.map((doc) =>
            db.collection("shipments").doc(doc.id).get(),
          ),
        );
        const manifestShipments = manifestShipmentSnaps
          .filter((snap) => snap.exists)
          .map((snap) => ({ id: snap.id, ...snap.data() }));

        customerNotificationResult = await sendAutomaticTripLifecycleNotification({
          db,
          tripId,
          notificationType: CUSTOMER_NOTIFICATION_TYPES.IN_TRANSIT,
          shipments: manifestShipments,
          source: "DISPATCH_TRIP",
          actor: {
            uid,
            name: actorName,
            role: req.auth.token?.role || null,
          },
        });

        if (customerNotificationResult?.skipped && manifestShipments.length) {
          console.warn(
            "[dispatchTrip] Customer notification skipped:",
            customerNotificationResult.reason,
            { tripId, shipmentCount: manifestShipments.length },
          );
        }
      } catch (notificationError) {
        console.error(
          "[dispatchTrip] Customer notification failed:",
          notificationError,
        );
        customerNotificationResult = {
          success: false,
          error: notificationError?.message || String(notificationError),
        };
      }
    }

    return {
      success: true,
      message: isCorrectionDispatch
        ? `Correction dispatch complete. Newly loaded package(s) marked in transit.`
        : `Trip dispatched. ${shipmentCount} shipment(s) marked in transit.`,
      status: isCorrectionDispatch ? "ARRIVED" : "IN_TRANSIT",
      manifestStatus: MANIFEST_STATUS.LOCKED,
      correctionDispatch: isCorrectionDispatch,
      customerNotification: customerNotificationResult,
    };
  },
);
