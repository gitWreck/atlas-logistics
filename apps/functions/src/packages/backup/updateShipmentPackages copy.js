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
    // 1. AUTH & ROLE CHECK
    if (!req.auth) throw new HttpsError("unauthenticated", "Auth required.");
    await requireRole(db, req, ["admin", "manager", "checker"]);

    const uid = req.auth.uid;
    const {
      shipmentId,
      packageIds,
      newStatus,
      tripId,
      manualQty,
      remarks,
      location,
    } = req.data;

    if (!shipmentId || !packageIds || !newStatus) {
      throw new HttpsError("invalid-argument", "Missing required fields.");
    }

    const shipmentRef = db.collection("shipments").doc(shipmentId);
    const tripRef = tripId ? db.collection("truck_trips").doc(tripId) : null;
    const tripShipmentRef = tripRef
      ? tripRef.collection("trip_shipments").doc(shipmentId)
      : null;

    // 2. TRANSACTION
    await db.runTransaction(async (tx) => {
      const shipmentSnap = await tx.get(shipmentRef);
      if (!shipmentSnap.exists)
        throw new HttpsError("not-found", "Shipment not found.");

      const data = shipmentSnap.data();
      const packages = data.packages || [];

      // Piece-level deltas for Trip-level counters
      let deltaLoaded = 0;
      let deltaReceived = 0; // ✅ Replacing itemPending logic
      let deltaMissing = 0;

      // 3. UPDATE SPECIFIC PACKAGES
      const updatedPackages = packages.map((pkg) => {
        if (packageIds.includes(pkg.trackingNumber)) {
          const oldStatus = pkg.status;
          // Use manualQty if provided (for sacks/bundles), otherwise use full quantity
          const pkgQty = Number(manualQty) || Number(pkg.quantity) || 1;

          if (oldStatus !== newStatus) {
            // --- DECREMENT PIECES FROM OLD STATUS ---
            if (oldStatus === "LOADED") deltaLoaded -= pkgQty;
            if (oldStatus === "RECEIVED") deltaReceived -= pkgQty;
            if (oldStatus === "MISSING") deltaMissing -= pkgQty;

            // --- INCREMENT PIECES TO NEW STATUS ---
            if (newStatus === "LOADED") deltaLoaded += pkgQty;
            if (newStatus === "RECEIVED") deltaReceived += pkgQty;
            if (newStatus === "MISSING") deltaMissing += pkgQty;
          }

          return {
            ...pkg,
            status: newStatus,
            loadedQty: newStatus === "LOADED" ? pkgQty : pkg.loadedQty || 0,
            updatedAt: new Date().toISOString(),
            updatedBy: uid,
          };
        }
        return pkg;
      });

      // 4. CALCULATE NEW SHIPMENT STATUS & TOTALS (Piece-based)
      const piecesLoaded = updatedPackages.reduce(
        (acc, p) =>
          acc +
          (p.status === "LOADED"
            ? Number(p.loadedQty) || Number(p.quantity) || 1
            : 0),
        0,
      );

      const piecesReceived = updatedPackages.reduce(
        (acc, p) =>
          acc + (p.status === "RECEIVED" ? Number(p.quantity) || 1 : 0),
        0,
      );

      const piecesMissing = updatedPackages.reduce(
        (acc, p) =>
          acc + (p.status === "MISSING" ? Number(p.quantity) || 1 : 0),
        0,
      );

      const totalPieces = updatedPackages.reduce(
        (acc, p) => acc + (Number(p.quantity) || 1),
        0,
      );

      let shipmentStatus = data.status;
      if (piecesLoaded === totalPieces) {
        shipmentStatus = "LOADED";
      } else if (
        piecesLoaded + piecesMissing === totalPieces &&
        piecesLoaded > 0
      ) {
        shipmentStatus = "LOADED_WITH_EXCEPTIONS";
      } else if (piecesLoaded > 0 || piecesMissing > 0) {
        shipmentStatus = "PARTIALLY_PROCESSED";
      } else {
        shipmentStatus = "RECEIVED";
      }

      // 5. WRITE UPDATES TO SHIPMENT
      tx.update(shipmentRef, {
        packages: updatedPackages,
        status: shipmentStatus,
        "totals.loaded": piecesLoaded,
        "totals.received": piecesReceived, // ✅ Consistent with your new schema
        "totals.missing": piecesMissing,
        updatedAt: FieldValue.serverTimestamp(),
        statusHistory: FieldValue.arrayUnion({
          status: `PKG_UPDATE_${newStatus}`,
          at: new Date(),
          by: uid,
          note:
            remarks || `${packageIds.length} items updated to ${newStatus}.`,
          location: location || null,
        }),
      });

      // 6. UPDATE TRIP MANIFEST & COUNTERS (The Handshake)
      if (tripRef) {
        // Update Trip-level Aggregates
        tx.update(tripRef, {
          totalLoaded: FieldValue.increment(deltaLoaded),
          totalReceived: FieldValue.increment(deltaReceived), // ✅ Replacing itemPending
          totalMissing: FieldValue.increment(deltaMissing),
          updatedAt: FieldValue.serverTimestamp(),
        });

        // Update the Manifest Entry for this specific shipment
        if (tripShipmentRef) {
          tx.update(tripShipmentRef, {
            status: shipmentStatus,
            loadedCount: piecesLoaded,
            receivedCount: piecesReceived,
            missingCount: piecesMissing,
            updatedAt: FieldValue.serverTimestamp(),
          });
        }
      }
    });

    return { success: true };
  },
);
