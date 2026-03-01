"use strict";

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const { FieldValue } = require("firebase-admin/firestore");
const { ALLOWED_SHIPMENT_STATUSES } = require("../utilities/dataDetails");

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

exports.updateShipmentStatus = onCall(
  { region: "asia-southeast1", maxInstances: 10 },
  async (req) => {
    // 1. AUTHENTICATION
    if (!req.auth) {
      throw new HttpsError("unauthenticated", "You must be logged in.");
    }
    const uid = req.auth.uid;

    // 2. INPUT VALIDATION
    const {
      shipmentId,
      tripId,
      newStatus,
      remarks,
      location,
      proofOfDelivery,
      proofOfReceipt, // ✅ NEW: For local pickups
      paymentStatus, // ✅ NEW: For COD collection
    } = req.data;

    if (!shipmentId || !newStatus) {
      throw new HttpsError("invalid-argument", "Missing shipmentId or status.");
    }

    const ALLOWED = ALLOWED_SHIPMENT_STATUSES;
    if (!ALLOWED.includes(newStatus)) {
      throw new HttpsError("invalid-argument", "Invalid status transition.");
    }

    // 3. REFERENCES
    const shipmentRef = db.collection("shipments").doc(shipmentId);

    let tripRef = null;
    let tripShipmentRef = null;
    if (tripId) {
      tripRef = db.collection("truck_trips").doc(tripId);
      tripShipmentRef = tripRef.collection("trip_shipments").doc(shipmentId);
    }

    // 4. TRANSACTION
    await db.runTransaction(async (tx) => {
      // ============================================================
      // PHASE 1: READS (MUST BE DONE BEFORE ANY WRITES)
      // ============================================================

      // Read 1: The Shipment
      const shipmentSnap = await tx.get(shipmentRef);
      if (!shipmentSnap.exists) {
        throw new HttpsError("not-found", "Shipment not found.");
      }

      // Read 2: The Trip Sub-document (If trip exists)
      // We must read this NOW, even if we don't use it until later.
      let tripShipSnap = null;
      if (tripShipmentRef) {
        tripShipSnap = await tx.get(tripShipmentRef);
      }

      const currentData = shipmentSnap.data();
      const oldStatus = currentData.status;

      // ============================================================
      // PHASE 2: LOGIC & WRITES
      // ============================================================

      // Logic Check: Enforce ARRIVED before OUT_FOR_DELIVERY
      if (newStatus === "OUT_FOR_DELIVERY" && oldStatus !== "ARRIVED") {
        throw new HttpsError(
          "failed-precondition",
          "Shipment must be scanned as ARRIVED at the destination hub first.",
        );
      }

      // A. Prepare Updates
      const historyEntry = {
        status: newStatus,
        at: new Date(),
        by: uid,
        note: remarks || `Marked via Driver App`,
        location: location || null,
      };

      const updateData = {
        status: newStatus,
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: uid,
        statusHistory: FieldValue.arrayUnion(historyEntry),
      };

      if (location) updateData.lastLocation = location;
      if (proofOfDelivery) updateData.proofOfDelivery = proofOfDelivery;
      if (proofOfReceipt) updateData.proofOfReceipt = proofOfReceipt; // ✅ NEW
      if (paymentStatus) updateData.paymentStatus = paymentStatus; // ✅ NEW

      // WRITE 1: Update Main Shipment
      tx.update(shipmentRef, updateData);

      // WRITE 2: Update Trip Link & Counters
      // We use the 'tripShipSnap' variable we read earlier
      if (tripShipmentRef && tripRef && tripShipSnap && tripShipSnap.exists) {
        const tripShipData = tripShipSnap.data();
        const currentTripShipStatus = tripShipData.status;

        if (currentTripShipStatus !== newStatus) {
          // Update Sub-doc Status
          tx.update(tripShipmentRef, {
            status: newStatus,
            updatedAt: FieldValue.serverTimestamp(),
          });

          // Update Parent Trip Counters
          const tripUpdate = { updatedAt: FieldValue.serverTimestamp() };

          // Decrement Old Count logic
          if (currentTripShipStatus === "LOADED") {
            tripUpdate.totalLoaded = FieldValue.increment(-1);
          } else if (currentTripShipStatus === "ARRIVED") {
            tripUpdate.totalArrived = FieldValue.increment(-1);
          }

          // Increment New Count logic
          if (newStatus === "DELIVERED") {
            tripUpdate.totalDelivered = FieldValue.increment(1);
          } else if (newStatus === "ARRIVED") {
            tripUpdate.totalArrived = FieldValue.increment(1);
          }

          tx.update(tripRef, tripUpdate);
        }
      }

      // WRITE 3: Audit Log
      const auditRef = db.collection("audit_logs").doc();
      tx.set(auditRef, {
        action: "UPDATE_SHIPMENT_STATUS",
        targetCollection: "shipments",
        targetId: shipmentId,
        actorId: uid,
        details: {
          oldStatus: oldStatus || null,
          newStatus: newStatus,
          tripId: tripId || null, // <--- FORCE NULL IF UNDEFINED
          remarks: remarks || null, // <--- FORCE NULL IF UNDEFINED
          photoCount:
            (proofOfDelivery ? proofOfDelivery.length : 0) +
            (proofOfReceipt ? proofOfReceipt.length : 0),
        },
        timestamp: FieldValue.serverTimestamp(),
      });
    });

    return { success: true, status: newStatus };
  },
);
