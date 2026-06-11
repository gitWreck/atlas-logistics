"use strict";

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const { FieldValue } = require("firebase-admin/firestore");
const { requireString } = require("../utilities/helpers");
const { writeCustodyAuditLog } = require("../utilities/custodyAuditLog");
const {
  requireTripLifecycleAdmin,
  snapshotTripLifecycleState,
  assertTripNotArchived,
  updatedBy,
} = require("./tripLifecycleAdmin");

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

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
      batch.update(db.collection("shipments").doc(shipmentId), {
        currentTripId: null,
        currentTruckTripId: null,
        assignedToTripAt: null,
        updatedAt: now,
        updatedBy: actorName || "SYSTEM",
      });
    });

    await batch.commit();
  }

  return { detachedShipmentCount: ids.length };
}

exports.cancelTruckTrip = onCall(
  { region: "asia-southeast1", maxInstances: 10 },
  async (req) => {
    await requireTripLifecycleAdmin(db, req);

    const { uid, role, name } = updatedBy(req);
    const tripDocId = requireString(
      req.data?.tripDocId || req.data?.tripId,
      "tripId",
    );
    const reason = requireString(req.data?.reason, "reason");

    const tripRef = db.collection("truck_trips").doc(tripDocId);

    await db.runTransaction(async (tx) => {
      const tripSnap = await tx.get(tripRef);
      if (!tripSnap.exists) {
        throw new HttpsError("not-found", "Trip not found");
      }

      const trip = tripSnap.data() || {};
      assertTripNotArchived(trip);

      const status = String(trip.status || "").toUpperCase();
      if (status === "CANCELLED") {
        throw new HttpsError("failed-precondition", "Trip is already cancelled.");
      }
      if (status === "COMPLETED" || status === "DELIVERED") {
        throw new HttpsError(
          "failed-precondition",
          "Completed trips cannot be cancelled. Archive the trip instead.",
        );
      }

      const before = snapshotTripLifecycleState(trip);
      const after = {
        ...before,
        status: "CANCELLED",
        active: false,
      };

      tx.update(tripRef, {
        status: "CANCELLED",
        active: false,
        cancellationReason: reason,
        cancelledAt: FieldValue.serverTimestamp(),
        cancelledBy: uid,
        cancelledByName: name || null,
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: name || uid,
      });

      writeCustodyAuditLog({
        db,
        tx,
        action: "CANCEL_TRIP",
        targetCollection: "truck_trips",
        targetId: tripDocId,
        tripDocId,
        tripId: trip.tripId || tripDocId,
        actorId: uid,
        actorName: name,
        actorRole: role,
        reason,
        previousValue: before,
        newValue: after,
        note: "Trip cancelled (soft). Shipments and audit history are preserved.",
      });

      const eventRef = tripRef.collection("manifest_events").doc();
      tx.set(eventRef, {
        type: "TRIP_CANCELLED",
        reason,
        cancelledBy: name || uid,
        createdAt: FieldValue.serverTimestamp(),
      });
    });

    const detachStats = await detachShipmentsFromTrip(tripDocId, name);

    const tripSnap = await tripRef.get();
    const trip = tripSnap.data() || {};
    if (trip.truckId) {
      const truckRef = db.collection("trucks").doc(trip.truckId);
      const truckSnap = await truckRef.get();
      if (truckSnap.exists && truckSnap.data()?.currentTripId === tripDocId) {
        await truckRef.update({
          currentTripId: null,
          updatedAt: FieldValue.serverTimestamp(),
        });
      }
    }

    return { success: true, tripId: tripDocId, ...detachStats };
  },
);
