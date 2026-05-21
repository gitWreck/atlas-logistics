"use strict";

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const { FieldValue } = require("firebase-admin/firestore");

// Import your existing auth helper
const {
  requireAuth,
} = require("../utilities/helpers");

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

exports.reportCheckerTrip = onCall(
  { region: "asia-southeast1", maxInstances: 10 },
  async (req) => {
    // 1. AUTHENTICATION
    const uid = await requireAuth(req);

    // 2. EXTRACT PAYLOAD
    const { shipmentId, tripId, actionCode, location, remarks } = req.data;

    if (!shipmentId || !actionCode) {
      throw new HttpsError(
        "invalid-argument",
        "Missing shipmentId or actionCode.",
      );
    }

    // 3. REFERENCES
    const shipmentRef = db.collection("shipments").doc(shipmentId);
    let tripRef = null;
    let tripShipmentRef = null;

    if (tripId) {
      tripRef = db.collection("truck_trips").doc(tripId);
      tripShipmentRef = tripRef.collection("trip_shipments").doc(shipmentId);
    }

    // Reference for the new Admin Alert
    const alertRef = db.collection("admin_alerts").doc();

    // =========================================================
    // PHASE 1: DATABASE TRANSACTION (Atomic Updates)
    // =========================================================
    await db.runTransaction(async (tx) => {
      // --- READS ---
      const shipmentSnap = await tx.get(shipmentRef);
      if (!shipmentSnap.exists)
        throw new HttpsError("not-found", "Shipment not found.");

      let tripShipSnap = null;
      if (tripShipmentRef) tripShipSnap = await tx.get(tripShipmentRef);

      const currentData = shipmentSnap.data();
      const oldStatus = currentData.status;

      // --- LOGIC CHECKS ---
      if (actionCode === "OUT_FOR_DELIVERY" && oldStatus !== "ARRIVED") {
        throw new HttpsError(
          "failed-precondition",
          "Shipment must be scanned as ARRIVED first.",
        );
      }
      if (oldStatus === actionCode) return; // Already updated

      // --- WRITES ---
      const historyEntry = {
        status: actionCode,
        at: new Date(),
        by: uid,
        note: remarks || `Status updated via Checker App`,
        location: location || null,
      };

      // 1. Update Main Shipment
      tx.update(shipmentRef, {
        status: actionCode,
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: uid,
        statusHistory: FieldValue.arrayUnion(historyEntry),
      });

      // 2. Update Trip & Counters
      if (tripShipmentRef && tripRef && tripShipSnap && tripShipSnap.exists) {
        const tripShipData = tripShipSnap.data();
        const currentTripShipStatus = tripShipData.status;

        if (currentTripShipStatus !== actionCode) {
          tx.update(tripShipmentRef, {
            status: actionCode,
            updatedAt: FieldValue.serverTimestamp(),
          });

          const tripUpdate = { updatedAt: FieldValue.serverTimestamp() };

          // Decrement old status
          if (currentTripShipStatus === "LOADED")
            tripUpdate.totalLoaded = FieldValue.increment(-1);
          if (currentTripShipStatus === "ARRIVED")
            tripUpdate.totalArrived = FieldValue.increment(-1);

          // Increment new status
          if (actionCode === "DELIVERED")
            tripUpdate.totalDelivered = FieldValue.increment(1);
          if (actionCode === "ARRIVED")
            tripUpdate.totalArrived = FieldValue.increment(1);
          if (actionCode === "LOADED")
            tripUpdate.totalLoaded = FieldValue.increment(1);

          tx.update(tripRef, tripUpdate);
        }
      }

      // =========================================================
      // PHASE 2: ADMIN ALERT LOGGING
      // =========================================================
      // Write the alert in the same transaction so it only saves if the update succeeds
      tx.set(alertRef, {
        type: "SHIPMENT_STATUS_UPDATE",
        subType: actionCode,
        tripId: tripId || "No Trip",
        shipmentId: shipmentId,
        details: {
          reason: `Shipment status updated to ${actionCode}`,
          userId: uid,
          location: location || null,
          notes: remarks || "",
        },
        status: "UNREAD",
        priority: "LOW", // Adjust to "MEDIUM" or "HIGH" if you want notifications to be louder
        createdAt: FieldValue.serverTimestamp(),
      });
    });

    return { success: true, status: actionCode };
  },
);
