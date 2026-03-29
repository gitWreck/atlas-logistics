"use strict";

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const { FieldValue } = require("firebase-admin/firestore");
const { requireRole } = require("../utilities/helpers");
const { ALLOWED_SHIPMENT_STATUSES } = require("../utilities/dataDetails");

if (!admin.apps.length) admin.initializeApp();
<<<<<<< HEAD
=======

>>>>>>> 1e96fa07aebda305237fba42d8e25897dacf33eb
const db = admin.firestore();

exports.updateShipmentStatus = onCall(
  { region: "asia-southeast1", maxInstances: 10 },
<<<<<<< HEAD
  async (req) => {
    // 1. AUTH & ROLE CHECK (Covers Admin, Manager, Checker, and Driver)
    if (!req.auth) throw new HttpsError("unauthenticated", "Auth required.");
    const uid = req.auth.uid;

    // Check if the user has any of the allowed roles
    await requireRole(db, req, ["admin", "manager", "checker", "driver"]);

    // 2. INPUT VALIDATION
=======

  async (req) => {
    // 1. AUTH & ROLE CHECK (Covers Admin, Manager, Checker, and Driver)

    if (!req.auth) throw new HttpsError("unauthenticated", "Auth required.");

    const uid = req.auth.uid;

    // Check if the user has any of the allowed roles

    await requireRole(db, req, ["admin", "manager", "checker", "driver"]);

    // 2. INPUT VALIDATION

>>>>>>> 1e96fa07aebda305237fba42d8e25897dacf33eb
    const {
      shipmentId,
      tripId,
      newStatus,
      remarks,
      location,
      proofOfDelivery, // Driver specific
      proofOfReceipt, // Driver specific
      paymentStatus, // Driver specific
      sourceUI = "SYSTEM", // Allows you to track if update came from 'DRIVER', 'CHECKER', or 'ADMIN'
    } = req.data;

    if (!shipmentId || !newStatus) {
      throw new HttpsError("invalid-argument", "Missing shipmentId or status.");
    }

    if (!ALLOWED_SHIPMENT_STATUSES.includes(newStatus)) {
      throw new HttpsError("invalid-argument", `Invalid status: ${newStatus}`);
    }

    const shipmentRef = db.collection("shipments").doc(shipmentId);
<<<<<<< HEAD
    const tripRef = tripId ? db.collection("truck_trips").doc(tripId) : null;
=======

    const tripRef = tripId ? db.collection("truck_trips").doc(tripId) : null;

>>>>>>> 1e96fa07aebda305237fba42d8e25897dacf33eb
    const tripShipmentRef = tripRef
      ? tripRef.collection("trip_shipments").doc(shipmentId)
      : null;

    // 3. TRANSACTION
<<<<<<< HEAD
    await db.runTransaction(async (tx) => {
      const shipmentSnap = await tx.get(shipmentRef);
      if (!shipmentSnap.exists)
        throw new HttpsError("not-found", "Shipment not found.");

      // Move manifest read to the top to avoid the "reads after writes" error
      let tripShipSnap = null;
=======

    await db.runTransaction(async (tx) => {
      const shipmentSnap = await tx.get(shipmentRef);

      if (!shipmentSnap.exists)
        throw new HttpsError("not-found", "Shipment not found.");

      let tripShipSnap = null;

>>>>>>> 1e96fa07aebda305237fba42d8e25897dacf33eb
      if (tripShipmentRef) {
        tripShipSnap = await tx.get(tripShipmentRef);
      }

      const currentData = shipmentSnap.data();
      const oldStatus = currentData.status;

      // Skip if no change to avoid counter errors
<<<<<<< HEAD
      if (oldStatus === newStatus)
        return { success: true, message: "No change" };

      // To this (summing actual pieces):
      const pkgCount = Number(
        currentData.totals?.totalContentQty ||
          currentData.totals?.totalItems ||
          0,
      );
=======

      if (oldStatus === newStatus)
        return { success: true, message: "No change" };

      // Calculate package count for counter increments

      const pkgCount =
        currentData.packages?.length || currentData.totals?.totalItems || 0;

>>>>>>> 1e96fa07aebda305237fba42d8e25897dacf33eb
      // 4. PREPARE UPDATES
      const updatedPackages = (currentData.packages || []).map((pkg) => ({
        ...pkg,
        status: newStatus,
        updatedAt: new Date().toISOString(),
        ...(newStatus === "DELIVERED"
          ? { deliveredAt: new Date().toISOString() }
          : {}),
      }));

      const shipmentUpdate = {
        status: newStatus,
        packages: updatedPackages,
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: uid,
        remarks: remarks || null,
        statusHistory: FieldValue.arrayUnion({
          status: newStatus,
          at: new Date(),
          by: uid,
          note: remarks || `Status updated via ${sourceUI}`,
          location: location || null,
        }),
<<<<<<< HEAD
        // Conditional fields
=======

        // Conditional fields

>>>>>>> 1e96fa07aebda305237fba42d8e25897dacf33eb
        ...(location && { lastLocation: location }),
        ...(proofOfDelivery && { proofOfDelivery }),
        ...(proofOfReceipt && { proofOfReceipt }),
        ...(paymentStatus && { paymentStatus }),
<<<<<<< HEAD
        // Sync Totals
=======

        // Sync Totals

>>>>>>> 1e96fa07aebda305237fba42d8e25897dacf33eb
        "totals.loaded":
          newStatus === "LOADED"
            ? pkgCount
            : newStatus === "DELIVERED" || newStatus === "RECEIVED"
              ? 0
              : currentData.totals?.loaded || 0,
        "totals.delivered":
          newStatus === "DELIVERED"
            ? pkgCount
            : currentData.totals?.delivered || 0,
<<<<<<< HEAD
        // Add this inside shipmentUpdate to keep the shipment doc in sync:
        "totals.received":
          newStatus === "RECEIVED"
            ? pkgCount
            : currentData.totals?.received || 0,
=======
>>>>>>> 1e96fa07aebda305237fba42d8e25897dacf33eb
      };

      tx.update(shipmentRef, shipmentUpdate);

      // 5. UPDATE TRIP & MANIFEST (The Handshake)
<<<<<<< HEAD
      // if (tripRef && tripShipmentRef) {
      if (tripRef && tripShipmentRef && tripShipSnap?.exists) {
        // const tripShipSnap = await tx.get(tripShipmentRef);

        // if (tripShipSnap.exists) {
        const tripUpdate = { updatedAt: FieldValue.serverTimestamp() };

        // --- DECREMENT OLD COUNTERS ---
        if (oldStatus === "LOADED")
          tripUpdate.totalLoaded = FieldValue.increment(-pkgCount);
        if (oldStatus === "RECEIVED")
          tripUpdate.totalReceived = FieldValue.increment(-pkgCount);

        // --- INCREMENT NEW COUNTERS ---
        if (newStatus === "LOADED")
          tripUpdate.totalLoaded = FieldValue.increment(pkgCount);
        if (newStatus === "RECEIVED")
          tripUpdate.totalReceived = FieldValue.increment(pkgCount);
        if (newStatus === "DELIVERED")
          tripUpdate.totalDelivered = FieldValue.increment(pkgCount);
        if (newStatus === "MISSING")
          tripUpdate.totalExceptions = FieldValue.increment(pkgCount);

        tx.update(tripRef, tripUpdate);
        tx.update(tripShipmentRef, {
          status: newStatus,
          loadedCount: newStatus === "LOADED" ? pkgCount : 0,
          deliveredCount: newStatus === "DELIVERED" ? pkgCount : 0,
          receivedCount: newStatus === "RECEIVED" ? pkgCount : 0,
          updatedAt: FieldValue.serverTimestamp(),
        });
        // }
      }

      // 6. AUDIT LOG
=======

      if (tripRef && tripShipmentRef && tripShipSnap && tripShipSnap.exists) {
        // const tripShipSnap = await tx.get(tripShipmentRef);
        if (tripShipSnap.exists) {
          const tripUpdate = { updatedAt: FieldValue.serverTimestamp() };

          // --- DECREMENT OLD COUNTERS ---
          if (oldStatus === "LOADED")
            tripUpdate.totalLoaded = FieldValue.increment(-pkgCount);
          if (oldStatus === "RECEIVED")
            tripUpdate.totalArrived = FieldValue.increment(-pkgCount);

          // --- INCREMENT NEW COUNTERS ---
          if (newStatus === "LOADED")
            tripUpdate.totalLoaded = FieldValue.increment(pkgCount);
          if (newStatus === "RECEIVED")
            tripUpdate.totalArrived = FieldValue.increment(pkgCount);

          if (newStatus === "DELIVERED")
            tripUpdate.totalDelivered = FieldValue.increment(pkgCount);
          if (newStatus === "MISSING")
            tripUpdate.totalExceptions = FieldValue.increment(pkgCount);

          tx.update(tripRef, tripUpdate);
          tx.update(tripShipmentRef, {
            status: newStatus,
            loadedCount: newStatus === "LOADED" ? pkgCount : 0,
            deliveredCount: newStatus === "DELIVERED" ? pkgCount : 0,
            arrivedCount: newStatus === "RECEIVED" ? pkgCount : 0,
            updatedAt: FieldValue.serverTimestamp(),
          });
        }
      }

      // 6. AUDIT LOG

>>>>>>> 1e96fa07aebda305237fba42d8e25897dacf33eb
      const auditRef = db.collection("audit_logs").doc();
      tx.set(auditRef, {
        action: `${sourceUI}_UPDATE_${newStatus}`,
        targetId: shipmentId,
        actorId: uid,
        details: {
          oldStatus,
          newStatus,
          packageCount: pkgCount,
          tripId: tripId || "N/A",
        },
        timestamp: FieldValue.serverTimestamp(),
      });
    });

    return { success: true, status: newStatus };
  },
);
