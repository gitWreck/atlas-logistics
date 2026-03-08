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
      const tripId = oldData.currentTruckTripId;

      let finalPackages = [];

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
            };
          }
          return pkg;
        });
      } else if (newPackagesArray) {
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

      const deltaTotal = newTotalPieces - oldTotalPieces;
      const deltaLoaded = newLoadedPieces - oldLoadedPieces;

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
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: uid,
        statusHistory: FieldValue.arrayUnion({
          status: shipmentStatus,
          at: new Date(),
          by: uid,
          note:
            remarks || `Scanner/Modal update: ${newLoadedPieces} pieces loaded`,
          location: location || null,
        }),
      });

      if (tripId) {
        const tripRef = db.collection("truck_trips").doc(tripId);
        tx.update(tripRef, {
          totalItems: FieldValue.increment(deltaTotal),
          totalLoaded: FieldValue.increment(deltaLoaded),
          itemPending: FieldValue.increment(deltaTotal - deltaLoaded),
          updatedAt: FieldValue.serverTimestamp(),
        });

        tx.update(tripRef.collection("trip_shipments").doc(shipmentId), {
          status: shipmentStatus,
          loadedCount: newLoadedPieces,
          totalItems: newTotalPieces,
          updatedAt: FieldValue.serverTimestamp(),
        });
      }
    });

    return { success: true };
  },
);
