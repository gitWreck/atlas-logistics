"use strict";

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const { requireRole } = require("../utilities/helpers");

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

const options = { region: "asia-southeast1", maxInstances: 10 };

function chunks(values, size = 10) {
  const result = [];
  for (let index = 0; index < values.length; index += size) {
    result.push(values.slice(index, index + size));
  }
  return result;
}

async function getCustomerShipments(req) {
  await requireRole(db, req, ["customer"]);
  if (!req.auth) {
    throw new HttpsError("unauthenticated", "User must be logged in.");
  }

  const uid = req.auth.uid;
  const snapshots = await Promise.all([
    db.collection("shipments").where("customerId", "==", uid).get(),
    db
      .collection("shipments")
      .where("visibilityUserIds", "array-contains", uid)
      .get(),
    db.collection("shipments").where("sender.uid", "==", uid).get(),
    db.collection("shipments").where("recipient.uid", "==", uid).get(),
  ]);
  const shipments = new Map();
  snapshots.forEach((snapshot) => {
    snapshot.docs.forEach((doc) => shipments.set(doc.id, { id: doc.id, ...doc.data() }));
  });
  return { uid, shipments: [...shipments.values()] };
}

exports.getMyInvoices = onCall(options, async (req) => {
  const { uid, shipments } = await getCustomerShipments(req);
  const queries = [
    db.collection("invoices").where("shipmentSnapshot.sender.uid", "==", uid).get(),
    db.collection("invoices").where("shipmentSnapshot.recipient.uid", "==", uid).get(),
  ];
  chunks(shipments.map((shipment) => shipment.id)).forEach((ids) => {
    queries.push(db.collection("invoices").where("shipmentId", "in", ids).get());
  });

  const invoices = new Map();
  (await Promise.all(queries)).forEach((snapshot) => {
    snapshot.docs.forEach((doc) => invoices.set(doc.id, { id: doc.id, ...doc.data() }));
  });
  return { invoices: [...invoices.values()] };
});

exports.getMySchedules = onCall(options, async (req) => {
  const { shipments } = await getCustomerShipments(req);
  const tripIds = new Set();
  shipments.forEach((shipment) => {
    [shipment.currentTripId, shipment.currentTruckTripId, shipment.tripId].forEach((id) => {
      if (id) tripIds.add(String(id));
    });
  });

  const schedules = await Promise.all(
    [...tripIds].map(async (tripId) => {
      const snapshot = await db.collection("truck_trips").doc(tripId).get();
      return snapshot.exists ? { id: snapshot.id, ...snapshot.data() } : null;
    }),
  );
  return { schedules: schedules.filter(Boolean) };
});
