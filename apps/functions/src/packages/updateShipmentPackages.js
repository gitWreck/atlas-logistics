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
      const tripId = oldData.currentTripId;

      let finalPackages = [];
      let affectedIds = [];
      // Scanner mode: patch selected package IDs.
      if (Array.isArray(packageIds) && packageIds.length > 0) {
        affectedIds = packageIds;
        finalPackages = oldPackages.map((pkg) => {
          const pkgIdentifier = pkg.packageId || pkg.trackingNumber;
          if (!packageIds.includes(pkgIdentifier)) return pkg;

          const pkgQuantity = Number(pkg.quantity) || 1;
          const qtyToApply =
            newStatus === "LOADED" ? Number(manualQty) || pkgQuantity : 0;
          const isPartial = newStatus === "LOADED" && qtyToApply < pkgQuantity;

          return {
            ...pkg,
            status: isPartial ? "PARTIALLY_LOADED" : newStatus,
            loadedQty: newStatus === "LOADED" ? qtyToApply : 0,
            updatedAt: new Date().toISOString(),
            updatedBy: uid,
          };
        });
      } else if (Array.isArray(newPackagesArray)) {
        // Web modal mode: full replacement.
        finalPackages = newPackagesArray;
        affectedIds = newPackagesArray
          .map((p) => p.packageId || p.trackingNumber)
          .filter(Boolean);
      } else {
        throw new HttpsError("invalid-argument", "No package data provided.");
      }

      const sumTotalPieces = (pkgs) =>
        pkgs.reduce((acc, p) => acc + (Number(p.quantity) || 1), 0);
      const sumLoadedPieces = (pkgs) =>
        pkgs.reduce((acc, p) => {
          if (p.status === "LOADED")
            return acc + (Number(p.loadedQty) || Number(p.quantity) || 1);
          if (p.status === "PARTIALLY_LOADED")
            return acc + (Number(p.loadedQty) || 0);
          return acc;
        }, 0);
      const sumReceivedPieces = (pkgs) =>
        pkgs.reduce(
          (acc, p) =>
            acc + (p.status === "RECEIVED" ? Number(p.quantity) || 1 : 0),
          0,
        );
      const sumMissingPieces = (pkgs) =>
        pkgs.reduce(
          (acc, p) =>
            acc + (p.status === "MISSING" ? Number(p.quantity) || 1 : 0),
          0,
        );

      const oldTotalPieces = sumTotalPieces(oldPackages);
      const newTotalPieces = sumTotalPieces(finalPackages);
      const oldLoadedPieces = sumLoadedPieces(oldPackages);
      const newLoadedPieces = sumLoadedPieces(finalPackages);
      const oldReceivedPieces = sumReceivedPieces(oldPackages);
      const newReceivedPieces = sumReceivedPieces(finalPackages);
      const oldMissingPieces = sumMissingPieces(oldPackages);
      const newMissingPieces = sumMissingPieces(finalPackages);

      const deltaTotal = newTotalPieces - oldTotalPieces;
      const deltaLoaded = newLoadedPieces - oldLoadedPieces;
      const deltaReceived = newReceivedPieces - oldReceivedPieces;
      const deltaMissing = newMissingPieces - oldMissingPieces;

      const totalItemsCount = finalPackages.length;
      const loadedItemsCount = finalPackages.filter(
        (p) => p.status === "LOADED",
      ).length;
      const partialItemsCount = finalPackages.filter(
        (p) => p.status === "PARTIALLY_LOADED",
      ).length;
      const missingItemsCount = finalPackages.filter(
        (p) => p.status === "MISSING",
      ).length;

      let shipmentStatus = "RECEIVED";
      if (loadedItemsCount === totalItemsCount && totalItemsCount > 0) {
        shipmentStatus = "LOADED";
      } else if (
        loadedItemsCount + missingItemsCount === totalItemsCount &&
        loadedItemsCount > 0
      ) {
        shipmentStatus = "LOADED_WITH_EXCEPTIONS";
      } else if (
        loadedItemsCount > 0 ||
        partialItemsCount > 0 ||
        missingItemsCount > 0
      ) {
        shipmentStatus = "PARTIALLY_PROCESSED";
      }

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
          location: location || null,
        }),
      });

      if (tripId) {
        const tripRef = db.collection("truck_trips").doc(tripId);
        tx.update(tripRef, {
          totalItems: FieldValue.increment(deltaTotal),
          totalLoaded: FieldValue.increment(deltaLoaded),
          totalReceived: FieldValue.increment(deltaReceived),
          totalArrived: FieldValue.increment(deltaReceived),
          totalMissing: FieldValue.increment(deltaMissing),
          updatedAt: FieldValue.serverTimestamp(),
        });

        tx.update(tripRef.collection("trip_shipments").doc(shipmentId), {
          status: shipmentStatus,
          loadedCount: newLoadedPieces,
          receivedCount: newReceivedPieces,
          totalItems: newTotalPieces,
          updatedAt: FieldValue.serverTimestamp(),
        });
      }

      const logRef = db.collection("admin_logs").doc();
      tx.set(logRef, {
        action: "UPDATE_SHIPMENT_PACKAGES",
        actorId: uid,
        shipmentId,
        tripId: tripId || null,
        timestamp: FieldValue.serverTimestamp(),
        details: {
          status: shipmentStatus,
          source: packageIds ? "SCANNER" : "WEB_MODAL",
          affectedCount: affectedIds.length,
          affectedPackageIds: affectedIds,
          loadedPieces: newLoadedPieces,
          receivedPieces: newReceivedPieces,
          missingPieces: newMissingPieces,
          remarks: remarks || "N/A",
        },
      });
    });

    return { success: true };
  },
);
