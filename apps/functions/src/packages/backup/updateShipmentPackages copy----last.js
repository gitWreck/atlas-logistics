"use strict";

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const { FieldValue } = admin.firestore;
const { requireRole } = require("../../utilities/helpers");

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

exports.updateShipmentPackages = onCall(
  { region: "asia-southeast1", maxInstances: 10 },
  async (req) => {
    await requireRole(db, req, ["admin", "manager", "checker"]);

    const uid = req.auth.uid;
    const { shipmentId, packages: newPackages, remarks, location } = req.data;

    if (!shipmentId || !newPackages) {
      throw new HttpsError(
        "invalid-argument",
        "Missing shipmentId or packages.",
      );
    }

    const shipmentRef = db.collection("shipments").doc(shipmentId);

    await db.runTransaction(async (tx) => {
      const shipmentSnap = await tx.get(shipmentRef);
      if (!shipmentSnap.exists)
        throw new HttpsError("not-found", "Shipment not found.");

      const oldData = shipmentSnap.data();
      const oldPackages = oldData.packages || [];
      const tripId = oldData.currentTruckTripId;

      // 1. CALCULATE QUANTITY DELTAS (Piece-level math)
      const oldTotalPieces = oldPackages.reduce(
        (acc, p) => acc + (Number(p.quantity) || 1),
        0,
      );
      const newTotalPieces = newPackages.reduce(
        (acc, p) => acc + (Number(p.quantity) || 1),
        0,
      );

      const oldLoadedPieces = oldPackages.reduce(
        (acc, p) => acc + (p.status === "LOADED" ? Number(p.quantity) || 1 : 0),
        0,
      );
      const newLoadedPieces = newPackages.reduce(
        (acc, p) => acc + (p.status === "LOADED" ? Number(p.quantity) || 1 : 0),
        0,
      );

      const deltaTotal = newTotalPieces - oldTotalPieces;
      const deltaLoaded = newLoadedPieces - oldLoadedPieces;

      // 2. CALCULATE NEW SHIPMENT STATUS
      const totalItems = newPackages.length;
      const loadedItems = newPackages.filter(
        (p) => p.status === "LOADED",
      ).length;

      let finalStatus = oldData.status;
      if (loadedItems === totalItems && totalItems > 0) {
        finalStatus = "LOADED";
      } else if (loadedItems > 0) {
        finalStatus = "PARTIALLY_LOADED";
      } else if (
        totalItems > 0 &&
        (finalStatus === "LOADED" || finalStatus === "PARTIALLY_LOADED") &&
        loadedItems === 0
      ) {
        finalStatus = "RECEIVED";
      }

      // 3. RESTORED: STATUS HISTORY & REMARKS
      const historyEntry = {
        status: finalStatus,
        at: new Date(),
        by: uid,
        note: remarks || `Package list modified (Total items: ${totalItems})`,
        location: location || null,
      };

      // 4. UPDATE SHIPMENT DOCUMENT
      tx.update(shipmentRef, {
        packages: newPackages,
        status: finalStatus,
        "totals.totalItems": totalItems,
        "totals.totalContentQty": newTotalPieces,
        "totals.loaded": newLoadedPieces,
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: uid,
        statusHistory: FieldValue.arrayUnion(historyEntry), // RESTORED
        remarks: remarks || oldData.remarks || null, // RESTORED
      });

      // 5. UPDATE TRIP MANIFEST & COUNTERS (The Handshake)
      if (tripId) {
        const tripRef = db.collection("truck_trips").doc(tripId);
        const tripShipmentRef = tripRef
          .collection("trip_shipments")
          .doc(shipmentId);

        tx.update(tripShipmentRef, {
          status: finalStatus,
          totalItems: newTotalPieces,
          loadedCount: newLoadedPieces,
          updatedAt: FieldValue.serverTimestamp(),
          updatedBy: uid,
        });

        tx.update(tripRef, {
          totalItems: FieldValue.increment(deltaTotal),
          totalLoaded: FieldValue.increment(deltaLoaded),
          itemPending: FieldValue.increment(deltaTotal - deltaLoaded),
          updatedAt: FieldValue.serverTimestamp(),
        });
      }
    });

    return { success: true };
  },
);
