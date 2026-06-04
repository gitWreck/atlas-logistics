"use strict";

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const { FieldValue } = admin.firestore;
const { requireRole, updatedBy } = require("../utilities/helpers");
const { writeTripActionLog } = require("../utilities/tripLogger");
const { deleteSubcollection } = require("../utilities/firestoreCleanup");

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

function snapshotTrip(trip = {}) {
  return {
    tripId: trip.tripId || null,
    status: trip.status || null,
    active: trip.active ?? null,
    tripType: trip.tripType || null,
    origin: trip.origin || null,
    destination: trip.destination || null,
    driverName: trip.driverName || null,
    truckPlateNumber: trip.truckPlateNumber || null,
    truckId: trip.truckId || null,
    totalItems: trip.totalItems ?? trip.packageTotal ?? null,
    manifestLocked: trip.manifestLocked ?? null,
  };
}

async function detachShipmentsFromTrip(tripDocId, actorName) {
  const shipmentIds = new Set();

  const tripShipSnap = await db
    .collection("truck_trips")
    .doc(tripDocId)
    .collection("trip_shipments")
    .get();

  tripShipSnap.docs.forEach((doc) => shipmentIds.add(doc.id));

  const [byTripIdSnap, byTruckTripIdSnap] = await Promise.all([
    db.collection("shipments").where("currentTripId", "==", tripDocId).get(),
    db
      .collection("shipments")
      .where("currentTruckTripId", "==", tripDocId)
      .get(),
  ]);

  byTripIdSnap.docs.forEach((doc) => shipmentIds.add(doc.id));
  byTruckTripIdSnap.docs.forEach((doc) => shipmentIds.add(doc.id));

  const now = FieldValue.serverTimestamp();
  const ids = Array.from(shipmentIds);

  for (let i = 0; i < ids.length; i += 400) {
    const chunk = ids.slice(i, i + 400);
    const batch = db.batch();

    chunk.forEach((shipmentId) => {
      const shipmentRef = db.collection("shipments").doc(shipmentId);
      batch.update(shipmentRef, {
        currentTripId: null,
        currentTruckTripId: null,
        assignedToTripAt: null,
        updatedAt: now,
        updatedBy: actorName || "SYSTEM",
      });
    });

    await batch.commit();
  }

  return {
    detachedShipmentCount: ids.length,
    tripShipmentLinkCount: tripShipSnap.size,
  };
}

exports.deleteTruckTrip = onCall(
  { region: "asia-southeast1", maxInstances: 10 },
  async (req) => {
    const { user } = await requireRole(db, req, ["admin", "manager"]);

    const tripId = req.data?.tripId || req.data?.tripDocId;
    const reason =
      String(req.data?.reason || "").trim() || "Deleted from admin UI";

    if (!tripId || typeof tripId !== "string") {
      throw new HttpsError("invalid-argument", "tripId is required");
    }

    const { uid, role, name } = updatedBy(req);
    const actorName = name || user.name || null;

    const tripRef = db.collection("truck_trips").doc(tripId);
    const tripSnap = await tripRef.get();

    if (!tripSnap.exists) {
      throw new HttpsError("not-found", "Trip not found");
    }

    const trip = tripSnap.data() || {};
    const before = snapshotTrip(trip);

    const detachStats = await detachShipmentsFromTrip(tripId, actorName);

    await deleteSubcollection(tripRef, "trip_shipments");
    await deleteSubcollection(tripRef, "status_events");

    if (trip.truckId) {
      const truckRef = db.collection("trucks").doc(trip.truckId);
      const truckSnap = await truckRef.get();
      if (truckSnap.exists && truckSnap.data()?.currentTripId === tripId) {
        await truckRef.update({
          currentTripId: null,
          updatedAt: FieldValue.serverTimestamp(),
        });
      }
    }

    await db.runTransaction(async (tx) => {
      writeTripActionLog({
        db,
        tx,
        action: "DELETE_TRUCK_TRIP",
        tripDocId: tripId,
        tripId: trip.tripId || tripId,
        actorId: uid,
        actorName,
        actorRole: role,
        details: {
          reason,
          before,
          ...detachStats,
          hardDelete: true,
        },
      });

      tx.delete(tripRef);
    });

    return {
      success: true,
      tripId,
      ...detachStats,
    };
  },
);
