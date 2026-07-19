"use strict";

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const { requireRole } = require("../utilities/helpers");

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();
const timestamp = () => admin.firestore.FieldValue.serverTimestamp();
const clean = (value) => String(value || "").trim();

function assignedIds(trip = {}) {
  return [...new Set([
    trip.assignedCheckerId, trip.checkerId,
    trip.assignedManagerId, trip.managerId, trip.warehouseManagerId,
    trip.dispatcherId, trip.operationsManagerId,
  ].map(clean).filter(Boolean))];
}

async function resolveRecipients(trip = {}) {
  const ids = new Set(assignedIds(trip));
  const warehouseId = clean(trip.destinationWarehouseId || trip.warehouseId);
  const warehouseCode = clean(trip.destinationWarehouseCode || trip.warehouseCode);
  const snapshots = [];
  if (warehouseId) snapshots.push(await db.collection("users").where("warehouseId", "==", warehouseId).get());
  else if (warehouseCode) snapshots.push(await db.collection("users").where("warehouseCode", "==", warehouseCode).get());
  snapshots.forEach((snapshot) => snapshot.forEach((row) => {
    const user = row.data() || {};
    const role = clean(user.role).toLowerCase();
    const title = clean(user.position || user.jobTitle || user.staffRole).toLowerCase();
    if (["checker", "manager", "warehouse_manager", "dispatcher", "operations_manager"].includes(role) || title.includes("warehouse manager") || title.includes("dispatcher") || title.includes("operations manager")) ids.add(row.id);
  }));
  return [...ids];
}

function notificationData({ type, title, message, trip, extra = {} }) {
  return { type, title, message, entityId: trip.id, tripId: trip.id, read: false, createdAt: timestamp(), data: { screen: "trip", tripId: trip.id, type, ...extra } };
}

async function requireAssignedDriver(req) {
  const actor = await requireRole(db, req, ["driver"]);
  const tripId = clean(req.data?.tripId);
  if (!tripId) throw new HttpsError("invalid-argument", "tripId is required.");
  const reference = db.collection("truck_trips").doc(tripId);
  const snapshot = await reference.get();
  if (!snapshot.exists) throw new HttpsError("not-found", "Trip not found.");
  const trip = { id: snapshot.id, ...snapshot.data() };
  if (clean(trip.driverId || trip.driverUid) !== clean(actor.uid)) throw new HttpsError("permission-denied", "This trip is not assigned to your Driver account.");
  return { actor, trip, reference };
}

exports.confirmDriverArrival = onCall({ region: "asia-southeast1", maxInstances: 10 }, async (req) => {
  const { actor, trip, reference } = await requireAssignedDriver(req);
  const currentStatus = clean(trip.status).toUpperCase();
  if (currentStatus === "ARRIVED") return { success: true, status: "ARRIVED", alreadyConfirmed: true };
  if (currentStatus !== "IN_TRANSIT") throw new HttpsError("failed-precondition", "Only an in-transit trip can confirm arrival.");
  const recipients = await resolveRecipients(trip);
  const driverName = actor.user?.name || actor.user?.fullName || trip.driverName || "Driver";
  const batch = db.batch();
  batch.update(reference, { status: "ARRIVED", arrivedAt: timestamp(), arrivalConfirmedAt: timestamp(), arrivalConfirmedBy: actor.uid, updatedAt: timestamp() });
  batch.set(reference.collection("trip_events").doc(), { type: "DRIVER_CONFIRMED_ARRIVAL", oldStatus: currentStatus, newStatus: "ARRIVED", by: actor.uid, at: timestamp(), shipmentStatusesChanged: false });
  recipients.forEach((uid) => batch.set(db.collection("users").doc(uid).collection("notifications").doc(), notificationData({ type: "TRIP_ARRIVAL_CONFIRMED", title: "Truck arrived", message: `${driverName} confirmed arrival for ${trip.tripId || trip.id}. Receiving and offloading can now begin.`, trip })));
  await batch.commit();
  return { success: true, status: "ARRIVED", notified: recipients.length, shipmentStatusesChanged: false };
});

exports.reportDriverTripIssue = onCall({ region: "asia-southeast1", maxInstances: 10 }, async (req) => {
  const { actor, trip, reference } = await requireAssignedDriver(req);
  const issueType = clean(req.data?.issueType);
  const description = clean(req.data?.description);
  const allowed = new Set(["Vehicle Breakdown", "Traffic Delay", "Accident", "Road Closure", "Weather Delay", "Other"]);
  if (!allowed.has(issueType)) throw new HttpsError("invalid-argument", "Select a valid issue type.");
  if (!description) throw new HttpsError("invalid-argument", "Description is required.");
  if (description.length > 2000) throw new HttpsError("invalid-argument", "Description is too long.");
  const photoURL = clean(req.data?.photoURL) || null;
  const rawLocation = req.data?.location;
  const lat = Number(rawLocation?.lat ?? rawLocation?.latitude);
  const lng = Number(rawLocation?.lng ?? rawLocation?.longitude);
  const location = Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
  const recipients = await resolveRecipients(trip);
  const driverName = actor.user?.name || actor.user?.fullName || trip.driverName || "Driver";
  const issueRef = reference.collection("issues").doc();
  const batch = db.batch();
  batch.set(issueRef, { issueType, description, photoURL, location, tripId: trip.id, driverId: actor.uid, driverName, status: "OPEN", reportedAt: timestamp() });
  batch.update(reference, { hasIssue: true, lastIssueType: issueType, lastIssueAt: timestamp(), issueCount: admin.firestore.FieldValue.increment(1), updatedAt: timestamp(), ...(issueType.includes("Delay") ? { delayCleared: false, lastDelayReason: issueType } : {}) });
  batch.set(db.collection("admin_alerts").doc(), { type: "DRIVER_TRIP_ISSUE", subType: issueType, tripId: trip.id, tripCode: trip.tripId || trip.id, details: { description, photoURL, location, driverId: actor.uid, driverName }, status: "UNREAD", priority: ["Accident", "Vehicle Breakdown"].includes(issueType) ? "HIGH" : "NORMAL", createdAt: timestamp() });
  recipients.forEach((uid) => batch.set(db.collection("users").doc(uid).collection("notifications").doc(), notificationData({ type: "DRIVER_TRIP_ISSUE", title: issueType, message: `${driverName} reported an issue on ${trip.tripId || trip.id}: ${description}`, trip, extra: { issueId: issueRef.id } })));
  await batch.commit();
  return { success: true, issueId: issueRef.id, notified: recipients.length };
});
