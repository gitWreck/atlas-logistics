"use strict";

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const { FieldValue } = require("firebase-admin/firestore");
const { ALLOWED_SHIPMENT_STATUSES } = require("../../utilities/dataDetails");

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

exports.updateShipmentStatusDriver = onCall(
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
      proofOfReceipt,
      paymentStatus,
    } = req.data;

    if (!shipmentId || !newStatus) {
      throw new HttpsError("invalid-argument", "Missing shipmentId or status.");
    }

    if (!ALLOWED_SHIPMENT_STATUSES.includes(newStatus)) {
      throw new HttpsError("invalid-argument", "Invalid status transition.");
    }

    // 3. REFERENCES
    const shipmentRef = db.collection("shipments").doc(shipmentId);
    let tripRef = tripId ? db.collection("truck_trips").doc(tripId) : null;
    let tripShipmentRef = tripRef
      ? tripRef.collection("trip_shipments").doc(shipmentId)
      : null;

    // 4. TRANSACTION
    await db.runTransaction(async (tx) => {
      // --- PHASE 1: READS ---
      const shipmentSnap = await tx.get(shipmentRef);
      if (!shipmentSnap.exists)
        throw new HttpsError("not-found", "Shipment not found.");

      let tripShipSnap = null;
      if (tripShipmentRef) tripShipSnap = await tx.get(tripShipmentRef);

      const currentData = shipmentSnap.data();
      const oldStatus = currentData.status;

      // Avoid double-processing
      if (oldStatus === newStatus) return { success: true };

      // --- PHASE 2: CALCULATE PACKAGE COUNT ---
      const pkgCount =
        currentData.packages?.length || currentData.totals?.totalItems || 0;

      // --- PHASE 3: LOGIC & WRITES ---

      // Update the internal packages array so every box is synced
      const updatedPackages = (currentData.packages || []).map((pkg) => ({
        ...pkg,
        status: newStatus,
        deliveredAt:
          newStatus === "DELIVERED"
            ? new Date().toISOString()
            : pkg.deliveredAt || null,
      }));

      const historyEntry = {
        status: newStatus,
        at: new Date(),
        by: uid,
        note: remarks || `Status updated via Driver App`,
        location: location || null,
      };

      const updateData = {
        status: newStatus,
        packages: updatedPackages, // ✅ Sync all internal packages
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: uid,
        statusHistory: FieldValue.arrayUnion(historyEntry),
        "totals.loaded":
          newStatus === "LOADED"
            ? pkgCount
            : newStatus === "DELIVERED" || newStatus === "RECEIVED"
              ? 0
              : currentData.totals?.loaded,
        "totals.delivered":
          newStatus === "DELIVERED" ? pkgCount : currentData.totals?.delivered,
      };

      if (location) updateData.lastLocation = location;
      if (proofOfDelivery) updateData.proofOfDelivery = proofOfDelivery;
      if (proofOfReceipt) updateData.proofOfReceipt = proofOfReceipt;
      if (paymentStatus) updateData.paymentStatus = paymentStatus;

      // WRITE 1: Update Shipment
      tx.update(shipmentRef, updateData);

      // WRITE 2: Update Trip Link & Counters
      if (tripShipmentRef && tripRef && tripShipSnap?.exists) {
        const tripUpdate = { updatedAt: FieldValue.serverTimestamp() };

        // 🟢 THE FIX: Use pkgCount for all increments/decrements
        // Decrement Old
        if (oldStatus === "LOADED")
          tripUpdate.totalLoaded = FieldValue.increment(-pkgCount);
        if (oldStatus === "RECEIVED")
          tripUpdate.totalArrived = FieldValue.increment(-pkgCount);

        // Increment New
        if (newStatus === "DELIVERED")
          tripUpdate.totalDelivered = FieldValue.increment(pkgCount);
        if (newStatus === "LOADED")
          tripUpdate.totalLoaded = FieldValue.increment(pkgCount);
        if (newStatus === "RECEIVED")
          tripUpdate.totalArrived = FieldValue.increment(pkgCount);

        tx.update(tripShipmentRef, {
          status: newStatus,
          loadedCount: newStatus === "LOADED" ? pkgCount : 0,
          deliveredCount: newStatus === "DELIVERED" ? pkgCount : 0,
          arrivedCount: newStatus === "RECEIVED" ? pkgCount : 0,
          updatedAt: FieldValue.serverTimestamp(),
        });

        tx.update(tripRef, tripUpdate);
      }

      // WRITE 3: Audit Log
      const auditRef = db.collection("audit_logs").doc();
      tx.set(auditRef, {
        action: "DRIVER_UPDATE_STATUS",
        targetId: shipmentId,
        actorId: uid,
        details: {
          oldStatus,
          newStatus,
          packageCount: pkgCount,
          tripId: tripId || null,
        },
        timestamp: FieldValue.serverTimestamp(),
      });
    });

    return { success: true, status: newStatus };
  },
);
