"use strict";

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const { FieldValue } = require("firebase-admin/firestore");

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

/* ======================================================
   BULK LOAD ITEMS (Admin/Manager Override)
   Use this when you don't want to scan packages one by one.
====================================================== */
exports.loadItemsToTrip = onCall({ region: "asia-southeast1" }, async (req) => {
  // 1. AUTH & VALIDATION
  if (!req.auth) throw new HttpsError("unauthenticated", "Login required");

  // Allow Admins AND Checkers (if you want checkers to have bulk tools)
  // For now, let's keep it robust.
  const { tripId, trackingNumber, loadCount } = req.data;

  if (!tripId || !trackingNumber) {
    throw new HttpsError(
      "invalid-argument",
      "Missing tripId or trackingNumber",
    );
  }

  const requestedLoad = Number(loadCount);
  if (requestedLoad <= 0)
    throw new HttpsError("invalid-argument", "Invalid count");

  // 2. REFERENCES
  const tripRef = db.collection("truck_trips").doc(tripId);
  const shipmentRef = db.collection("shipments").doc(trackingNumber);
  // Note: We use the new schema 'trip_shipments' inside the trip
  const tripShipmentRef = tripRef
    .collection("trip_shipments")
    .doc(trackingNumber);

  return db.runTransaction(async (tx) => {
    const [tripSnap, shipSnap, tripShipSnap] = await Promise.all([
      tx.get(tripRef),
      tx.get(shipmentRef),
      tx.get(tripShipmentRef),
    ]);

    if (!tripSnap.exists) throw new HttpsError("not-found", "Trip not found");
    if (!shipSnap.exists)
      throw new HttpsError("not-found", "Shipment not found");

    const shipment = shipSnap.data();
    const currentTotals = shipment.totals || { totalItems: 0, loaded: 0 };

    // 3. CALCULATE LIMITS
    // How many are NOT yet loaded?
    const remaining = currentTotals.totalItems - currentTotals.loaded;

    if (remaining <= 0) {
      throw new HttpsError(
        "failed-precondition",
        "Shipment is already fully loaded.",
      );
    }

    // We can only load what is remaining, or what was requested (whichever is smaller)
    const actualLoad = Math.min(requestedLoad, remaining);

    // 4. PREPARE UPDATES
    // A. Update Shipment Totals (The New Schema)
    const newLoadedTotal = currentTotals.loaded + actualLoad;

    let shipmentUpdate = {
      "totals.loaded": newLoadedTotal,
      updatedAt: FieldValue.serverTimestamp(),
      // Link the trip if not linked yet
      currentTruckTripId: tripId,
    };

    // If fully loaded, update status
    if (newLoadedTotal >= currentTotals.totalItems) {
      shipmentUpdate.status = "LOADED";
      // Add History Entry
      shipmentUpdate.statusHistory = FieldValue.arrayUnion({
        status: "LOADED",
        at: new Date(),
        note: `Bulk loaded ${actualLoad} items via Admin Console`,
        by: req.auth.uid,
      });
    }

    tx.update(shipmentRef, shipmentUpdate);

    // B. Update Trip Counts
    tx.update(tripRef, {
      loadedCount: FieldValue.increment(actualLoad),
      updatedAt: FieldValue.serverTimestamp(),
    });

    // C. Update/Create Trip Shipment Record
    // This is the link between the Trip and the Shipment
    const currentTripLoaded =
      (tripShipSnap.exists ? tripShipSnap.data().loadedCount : 0) + actualLoad;
    const currentTripPending = currentTotals.totalItems - currentTripLoaded;

    if (!tripShipSnap.exists) {
      tx.set(tripShipmentRef, {
        trackingNumber: trackingNumber,
        loadedCount: actualLoad,
        pendingCount: currentTotals.totalItems - actualLoad, // ✅ Added
        totalItems: currentTotals.totalItems,
        status:
          currentTripLoaded >= currentTotals.totalItems ? "LOADED" : "LOADING",
        addedAt: FieldValue.serverTimestamp(),
      });
    } else {
      tx.update(tripShipmentRef, {
        loadedCount: FieldValue.increment(actualLoad),
        pendingCount: currentTripPending, // ✅ Added
        status:
          currentTripLoaded >= currentTotals.totalItems ? "LOADED" : "LOADING",
        updatedAt: FieldValue.serverTimestamp(),
      });
    }

    return {
      success: true,
      message: `Bulk loaded ${actualLoad} items.`,
      remaining: remaining - actualLoad,
    };
  });
});
