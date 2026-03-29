"use strict";

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const { FieldValue } = admin.firestore;
const { requireRole } = require("../utilities/helpers");

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

exports.updateShipmentPackages = onCall(
  { region: "asia-southeast1", maxInstances: 10 },
  async (req) => {
<<<<<<< HEAD
    // 1. AUTH & ROLE CHECK
    if (!req.auth) throw new HttpsError("unauthenticated", "Auth required.");
=======
>>>>>>> 1e96fa07aebda305237fba42d8e25897dacf33eb
    await requireRole(db, req, ["admin", "manager", "checker"]);

    const uid = req.auth.uid;
    const {
      shipmentId,
      packages: newPackagesArray, // Used by Web Modal (Full Replace)
      packageIds, // Used by Scanner (Partial Update)
      newStatus, // Used by Scanner
      manualQty, // Used by Scanner
      remarks,
      location,
    } = req.data;

    if (!shipmentId)
      throw new HttpsError("invalid-argument", "Missing shipmentId.");

    const shipmentRef = db.collection("shipments").doc(shipmentId);

    await db.runTransaction(async (tx) => {
      const shipmentSnap = await tx.get(shipmentRef);
      if (!shipmentSnap.exists)
        throw new HttpsError("not-found", "Shipment not found.");

      const oldData = shipmentSnap.data();
      const oldPackages = oldData.packages || [];
      const tripId = oldData.currentTruckTripId;

      let finalPackages = [];
<<<<<<< HEAD
      let affectedIds = [];

      // --- 2. LOGIC BRANCH: SCANNER VS MODAL ---
      if (packageIds && Array.isArray(packageIds)) {
        // SCANNER MODE: Update only the scanned IDs
        affectedIds = packageIds;
        finalPackages = oldPackages.map((pkg) => {
          if (packageIds.includes(pkg.trackingNumber)) {
            const pkgQty = Number(manualQty) || Number(pkg.quantity) || 1;
            return {
              ...pkg,
              status: newStatus,
              loadedQty: newStatus === "LOADED" ? pkgQty : pkg.loadedQty || 0,
              updatedAt: new Date().toISOString(),
              updatedBy: uid,
=======

      // --- LOGIC BRANCH: SCANNER VS MODAL ---
      if (packageIds && Array.isArray(packageIds)) {
        // SCANNER LOGIC: Update specific items in the existing array
        finalPackages = oldPackages.map((pkg) => {
          if (packageIds.includes(pkg.trackingNumber)) {
            const qtyToApply = Number(manualQty) || Number(pkg.quantity) || 1;
            const isPartial = qtyToApply < (Number(pkg.quantity) || 1);

            return {
              ...pkg,
              status: isPartial ? "PARTIALLY_LOADED" : newStatus,
              loadedQty: newStatus === "LOADED" ? qtyToApply : 0,
              updatedAt: new Date().toISOString(),
>>>>>>> 1e96fa07aebda305237fba42d8e25897dacf33eb
            };
          }
          return pkg;
        });
      } else if (newPackagesArray) {
<<<<<<< HEAD
        // WEB MODAL MODE: Full array replacement
        finalPackages = newPackagesArray;
        affectedIds = newPackagesArray.map((p) => p.trackingNumber);
      } else {
        throw new HttpsError("invalid-argument", "No package data provided.");
      }

      // --- 3. PIECE-LEVEL MATH HELPERS ---
      const sumPiecesByStatus = (pkgs, status) =>
        pkgs.reduce((acc, p) => {
          if (p.status !== status) return acc;
          // For LOADED, we check if there's a specific loadedQty (partial sacks)
          if (status === "LOADED")
            return acc + (Number(p.loadedQty) || Number(p.quantity) || 1);
          return acc + (Number(p.quantity) || 1);
        }, 0);

      const sumTotalPieces = (pkgs) =>
        pkgs.reduce((acc, p) => acc + (Number(p.quantity) || 1), 0);

      // Calculate New Totals
      const newTotalPieces = sumTotalPieces(finalPackages);
      const newLoadedPieces = sumPiecesByStatus(finalPackages, "LOADED");
      const newReceivedPieces = sumPiecesByStatus(finalPackages, "RECEIVED");
      const newMissingPieces = sumPiecesByStatus(finalPackages, "MISSING");

      // Calculate Deltas for Trip (New - Old)
      const deltaTotal = newTotalPieces - sumTotalPieces(oldPackages);
      const deltaLoaded =
        newLoadedPieces - sumPiecesByStatus(oldPackages, "LOADED");
      const deltaReceived =
        newReceivedPieces - sumPiecesByStatus(oldPackages, "RECEIVED");
      const deltaMissing =
        newMissingPieces - sumPiecesByStatus(oldPackages, "MISSING");

      // --- 4. DETERMINE SHIPMENT STATUS ---
      const totalItemsCount = finalPackages.length;
      const loadedItemsCount = finalPackages.filter(
        (p) => p.status === "LOADED",
      ).length;
      const missingItemsCount = finalPackages.filter(
        (p) => p.status === "MISSING",
      ).length;

      let shipmentStatus = oldData.status;
      if (loadedItemsCount === totalItemsCount && totalItemsCount > 0) {
        shipmentStatus = "LOADED";
      } else if (
        loadedItemsCount + missingItemsCount === totalItemsCount &&
        loadedItemsCount > 0
      ) {
        shipmentStatus = "LOADED_WITH_EXCEPTIONS";
      } else if (loadedItemsCount > 0 || missingItemsCount > 0) {
        shipmentStatus = "PARTIALLY_PROCESSED";
      } else {
        shipmentStatus = "RECEIVED";
      }

      // --- 5. EXECUTE WRITES ---
      // Write A: Shipment Document
      tx.update(shipmentRef, {
        packages: finalPackages,
        status: shipmentStatus,
        "totals.totalItems": totalItemsCount,
        "totals.totalContentQty": newTotalPieces,
        "totals.loaded": newLoadedPieces,
        "totals.received": newReceivedPieces,
        "totals.missing": newMissingPieces,
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: uid,
        statusHistory: FieldValue.arrayUnion({
          status: `PKG_UPDATE_${newStatus || "BULK"}`,
          at: new Date(),
          by: uid,
          note: remarks || `${affectedIds.length} items updated.`,
=======
        // WEB MODAL LOGIC: Use the provided array
        finalPackages = newPackagesArray;
      }

      // --- PIECE-LEVEL MATH ---
      const sumTotalPieces = (pkgs) =>
        pkgs.reduce((acc, p) => acc + (Number(p.quantity) || 1), 0);
      const sumLoadedPieces = (pkgs) =>
        pkgs.reduce((acc, p) => {
          if (p.status === "LOADED") return acc + (Number(p.quantity) || 1);
          if (p.status === "PARTIALLY_LOADED")
            return acc + (Number(p.loadedQty) || 0);
          return acc;
        }, 0);

      const oldTotalPieces = sumTotalPieces(oldPackages);
      const newTotalPieces = sumTotalPieces(finalPackages);

      const oldLoadedPieces = sumLoadedPieces(oldPackages);
      const newLoadedPieces = sumLoadedPieces(finalPackages);

      const oldReceivedPieces = sumReceivedPieces(oldPackages);
      const newReceivedPieces = sumReceivedPieces(finalPackages);

      const deltaTotal = newTotalPieces - oldTotalPieces;
      const deltaLoaded = newLoadedPieces - oldLoadedPieces;
      const deltaReceived = newReceivedPieces - oldReceivedPieces;

      // Calculate Status
      const totalItems = finalPackages.length;
      const loadedCount = finalPackages.filter(
        (p) => p.status === "LOADED",
      ).length;
      const partialCount = finalPackages.filter(
        (p) => p.status === "PARTIALLY_LOADED",
      ).length;

      let shipmentStatus = oldData.status;
      if (loadedCount === totalItems && totalItems > 0)
        shipmentStatus = "LOADED";
      else if (loadedCount > 0 || partialCount > 0)
        shipmentStatus = "PARTIALLY_LOADED";
      else shipmentStatus = "RECEIVED";

      // --- WRITES ---
      tx.update(shipmentRef, {
        packages: finalPackages,
        status: shipmentStatus,
        "totals.totalItems": totalItems,
        "totals.totalContentQty": newTotalPieces,
        "totals.loaded": newLoadedPieces,
        "totals.received": newReceivedPieces, // ✅ Syncing received pieces
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: uid,
        statusHistory: FieldValue.arrayUnion({
          status: shipmentStatus,
          at: new Date(),
          by: uid,
          note:
            remarks || `Scanner/Modal update: ${newLoadedPieces} pieces loaded`,
>>>>>>> 1e96fa07aebda305237fba42d8e25897dacf33eb
          location: location || null,
        }),
      });

<<<<<<< HEAD
      // Write B: Trip Aggregates & Manifest
=======
>>>>>>> 1e96fa07aebda305237fba42d8e25897dacf33eb
      if (tripId) {
        const tripRef = db.collection("truck_trips").doc(tripId);
        tx.update(tripRef, {
          totalItems: FieldValue.increment(deltaTotal),
          totalLoaded: FieldValue.increment(deltaLoaded),
<<<<<<< HEAD
          totalReceived: FieldValue.increment(deltaReceived),
          totalMissing: FieldValue.increment(deltaMissing),
=======
          // itemPending: FieldValue.increment(deltaTotal - deltaLoaded),
          totalArrived: FieldValue.increment(deltaReceived), // ✅ Replaced itemPending with totalReceived (mapped to totalArrived)
>>>>>>> 1e96fa07aebda305237fba42d8e25897dacf33eb
          updatedAt: FieldValue.serverTimestamp(),
        });

        tx.update(tripRef.collection("trip_shipments").doc(shipmentId), {
          status: shipmentStatus,
          loadedCount: newLoadedPieces,
<<<<<<< HEAD
          receivedCount: newReceivedPieces,
=======
          receivedCount: newReceivedPieces, // ✅ Consistent manifest naming
>>>>>>> 1e96fa07aebda305237fba42d8e25897dacf33eb
          totalItems: newTotalPieces,
          updatedAt: FieldValue.serverTimestamp(),
        });
      }

<<<<<<< HEAD
      // Write C: Audit Log
=======
      // ✅ NEW: AUDIT LOG ENTRY
>>>>>>> 1e96fa07aebda305237fba42d8e25897dacf33eb
      const logRef = db.collection("admin_logs").doc();
      tx.set(logRef, {
        action: "UPDATE_SHIPMENT_PACKAGES",
        actorId: uid,
<<<<<<< HEAD
        shipmentId,
        tripId: tripId || null,
        timestamp: FieldValue.serverTimestamp(),
        details: {
          updateType: packageIds ? "SCANNER" : "WEB_MODAL",
          affectedCount: affectedIds.length,
          deltaLoaded,
          deltaReceived,
          remarks: remarks || "N/A",
=======
        shipmentId: shipmentId,
        tripId: tripId || null,
        timestamp: FieldValue.serverTimestamp(),
        details: {
          status: shipmentStatus,
          affectedPackages: targetedTrackingNumbers,
          loadedPieces: newLoadedPieces,
          receivedPieces: newReceivedPieces,
          source: packageIds ? "SCANNER" : "WEB_MODAL",
          remarks: remarks || "No remarks provided",
>>>>>>> 1e96fa07aebda305237fba42d8e25897dacf33eb
        },
      });
    });

    return { success: true };
  },
);
