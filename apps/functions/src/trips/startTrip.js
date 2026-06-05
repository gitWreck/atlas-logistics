"use strict";

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const { FieldValue } = require("firebase-admin/firestore");
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
const { isHubTransferTrip } = require("./manifestStatus");

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

exports.startTrip = onCall({ region: "asia-southeast1" }, async (req) => {
  if (!req.auth) {
    throw new HttpsError("unauthenticated", "User must be logged in.");
  }
  const uid = req.auth.uid;

  const { tripId, location } = req.data || {};
  if (!tripId) throw new HttpsError("invalid-argument", "Missing tripId");

  const tripRef = db.collection("truck_trips").doc(tripId);
  const tripSnap = await tripRef.get();

  if (!tripSnap.exists) throw new HttpsError("not-found", "Trip not found");
  const trip = tripSnap.data();

  if (isHubTransferTrip(trip)) {
    throw new HttpsError(
      "failed-precondition",
      "Hub transfer trips must be dispatched from the web dashboard. Drivers cannot start hub trips from mobile.",
    );
  }

  if (trip.status !== "LOADED") {
    throw new HttpsError(
      "failed-precondition",
      "Trip must be LOADED to start.",
    );
  }

  const shipQuery = await tripRef.collection("trip_shipments").get();
  const shipmentCount = shipQuery.size;
  const nowIso = new Date().toISOString();
  const timestamp = FieldValue.serverTimestamp();

  await db.runTransaction(async (tx) => {
    tx.update(tripRef, {
      status: "IN_TRANSIT",
      startedAt: timestamp,
      updatedAt: timestamp,
      startedBy: uid,
    });

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

      const updatedPackages = oldPackages.map((pkg) =>
        applyLinehaulInTransit(pkg, { tripId, nowIso }),
      );

      const snapshot = buildShipmentSnapshot(updatedPackages, {
        previousStatus: shipmentData.status,
      });

      const historyEntry = {
        status: snapshot.status,
        at: admin.firestore.Timestamp.now(),
        note: `Trip ${trip.tripId || tripId} started — packages on this trip marked in transit.`,
        by: uid,
        location: location || null,
      };

      tx.update(tripShipDoc.ref, {
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
      action: "START_TRIP",
      targetCollection: "truck_trips",
      targetId: tripId,
      actorId: uid,
      actorName: req.auth.token?.name || null,
      actorRole: req.auth.token?.role || null,
      details: {
        tripNumber: trip.tripId || tripId,
        plateNumber: trip.plateNumber || "N/A",
        packagesUpdated: shipmentCount,
        previousStatus: trip.status,
      },
      timestamp,
    });
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
          remarks: `Trip ${tripContext.tripId || tripId} started`,
          source: "START_TRIP",
        },
      }).catch((error) => {
        console.error(`IN_TRANSIT event write failed for ${doc.id}:`, error);
      }),
    ),
  );

  return {
    success: true,
    message: `Trip started. ${shipmentCount} shipment(s) updated; only packages on this trip were marked in transit.`,
  };
});
