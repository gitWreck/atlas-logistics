"use strict";

const { HttpsError } = require("firebase-functions/v2/https");
const { FieldValue } = require("firebase-admin/firestore");
const { isValidEventType } = require("./eventTypes");

async function writeShipmentEvent({ db, event, fieldValue = null }) {
  if (!db || typeof db.collection !== "function") {
    throw new HttpsError("internal", "Missing Firestore db instance.");
  }

  const fv = fieldValue || FieldValue;

  const payload = event || {};
  const shipmentId = String(payload.shipmentId || "").trim();
  const eventType = String(payload.eventType || "").trim().toUpperCase();

  if (!shipmentId) {
    throw new HttpsError("invalid-argument", "Missing shipmentId for event.");
  }
  if (!eventType || !isValidEventType(eventType)) {
    throw new HttpsError("invalid-argument", `Invalid eventType: ${eventType}`);
  }

  const eventRef = db.collection("shipment_events").doc();

  const doc = {
    eventId: eventRef.id,
    shipmentId,
    eventType,
    pieceId: payload.pieceId || null,

    tripId: payload.tripId || null,
    manifestId: payload.manifestId || null,
    truckId: payload.truckId || null,
    truckName: payload.truckName || null,
    truckPlate: payload.truckPlate || null,

    driverId: payload.driverId || null,
    driverName: payload.driverName || null,
    checkerId: payload.checkerId || null,
    checkerName: payload.checkerName || null,
    warehouseManagerId: payload.warehouseManagerId || null,
    warehouseManagerName: payload.warehouseManagerName || null,

    deliveryVehicleId: payload.deliveryVehicleId || null,
    deliveryVehicleName: payload.deliveryVehicleName || null,

    location: payload.location || null,
    timestamp: payload.timestamp || fv.serverTimestamp(),
    gpsCoordinates: payload.gpsCoordinates || null,
    proofPhotoUrl: payload.proofPhotoUrl || null,

    createdBy: payload.createdBy || null,
    createdByRole: payload.createdByRole || null,
    remarks: payload.remarks || null,
    source: payload.source || null,

    createdAt: fv.serverTimestamp(),
  };

  await eventRef.set(doc);
  return doc;
}

module.exports = {
  writeShipmentEvent,
};
