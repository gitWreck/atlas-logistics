"use strict";

const { chunk, unique } = require("./helpers");
const {
  customerOwnsShipment,
  getShipmentOwnerUserIds,
} = require("./customerShipmentAccess");

function normalizeNotificationChannels({
  notificationChannels,
  notify,
  notifySms,
  notifyEmail,
  notifyPush,
}) {
  if (notificationChannels && typeof notificationChannels === "object") {
    return {
      sms: notificationChannels.sms === true,
      email: notificationChannels.email === true,
      push: notificationChannels.push === true,
    };
  }

  if (notify === false) {
    return { sms: false, email: false, push: false };
  }

  return {
    sms: notifySms !== false && notify === true,
    email: notifyEmail === true,
    push: notifyPush === true,
  };
}

function getShipmentTargetUserIds(shipment = {}) {
  return getShipmentOwnerUserIds(shipment);
}

async function filterShipmentNotificationTargets(db, shipment = {}, candidateIds = []) {
  const uniqueCandidates = unique(
    (Array.isArray(candidateIds) ? candidateIds : []).filter(Boolean).map(String),
  );

  if (!uniqueCandidates.length) return [];

  const authorized = [];

  await Promise.all(
    uniqueCandidates.map(async (uid) => {
      if (getShipmentOwnerUserIds(shipment).includes(uid)) {
        authorized.push(uid);
        return;
      }

      const userSnap = await db.collection("users").doc(uid).get();
      if (!userSnap.exists) return;

      const user = userSnap.data() || {};
      if (user.active === false) return;
      if (user.role && user.role !== "customer") return;

      if (customerOwnsShipment(shipment, { uid, ...user })) {
        authorized.push(uid);
      }
    }),
  );

  return unique(authorized);
}

function getShipmentTargetEmails(shipment = {}) {
  return unique([
    shipment.sender?.email,
    shipment.senderEmail,
    shipment.recipient?.email,
    shipment.recipientEmail,
  ]);
}

function getShipmentTrackingId(shipment = {}, docId = null) {
  return String(shipment.trackingNumber || shipment.shipmentId || docId || "")
    .trim()
    .toUpperCase();
}

async function getTripNotificationTargets(db, tripId) {
  // Multi-trip shipments have currentTripId=null, so also match the
  // currentTripIds array and the trip_shipments manifest subcollection.
  const [
    currentTripSnap,
    currentTruckTripSnap,
    tripIdsArraySnap,
    tripShipSnap,
  ] = await Promise.all([
    db.collection("shipments").where("currentTripId", "==", tripId).get(),
    db.collection("shipments").where("currentTruckTripId", "==", tripId).get(),
    db
      .collection("shipments")
      .where("currentTripIds", "array-contains", tripId)
      .get()
      .catch(() => ({ docs: [] })),
    db
      .collection("truck_trips")
      .doc(tripId)
      .collection("trip_shipments")
      .get()
      .catch(() => ({ docs: [] })),
  ]);

  const shipmentMap = new Map();
  currentTripSnap.docs.forEach((doc) =>
    shipmentMap.set(doc.id, { id: doc.id, ...doc.data() }),
  );
  currentTruckTripSnap.docs.forEach((doc) =>
    shipmentMap.set(doc.id, { id: doc.id, ...doc.data() }),
  );
  tripIdsArraySnap.docs.forEach((doc) =>
    shipmentMap.set(doc.id, { id: doc.id, ...doc.data() }),
  );

  const missingManifestIds = tripShipSnap.docs
    .map((doc) => doc.id)
    .filter((id) => !shipmentMap.has(id));
  if (missingManifestIds.length) {
    const manifestSnaps = await Promise.all(
      missingManifestIds.map((id) =>
        db.collection("shipments").doc(id).get(),
      ),
    );
    manifestSnaps.forEach((snap) => {
      if (snap.exists) shipmentMap.set(snap.id, { id: snap.id, ...snap.data() });
    });
  }

  const shipments = [...shipmentMap.values()];
  const trackingIds = unique(
    shipments.map((shipment) => getShipmentTrackingId(shipment, shipment.id)),
  );
  const trackedUserIds = [];

  await Promise.all(
    chunk(trackingIds).map(async (trackingChunk) => {
      if (!trackingChunk.length) return;

      const trackedSnap = await db
        .collectionGroup("tracked_shipments")
        .where("trackingNumber", "in", trackingChunk)
        .get();

      trackedSnap.docs.forEach((doc) => {
        const userRef = doc.ref.parent.parent;
        if (userRef?.id) trackedUserIds.push(userRef.id);
      });
    }),
  );

  return {
    targetUserIds: unique([
      ...shipments.flatMap(getShipmentTargetUserIds),
      ...trackedUserIds,
    ]),
    emails: unique(shipments.flatMap(getShipmentTargetEmails)),
    shipmentCount: shipments.length,
  };
}

module.exports = {
  filterShipmentNotificationTargets,
  getShipmentTargetEmails,
  getShipmentTargetUserIds,
  getShipmentTrackingId,
  getTripNotificationTargets,
  normalizeNotificationChannels,
};
