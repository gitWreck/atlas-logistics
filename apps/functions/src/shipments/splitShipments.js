"use strict";

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const { FieldValue } = admin.firestore;

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

/**
 * Helper: Recalculates totals based on piece quantity.
 * Handles both "Items" (Barcodes) and "ContentQty" (Total Pieces).
 */
const recalculatePieceTotals = (packages) => {
  return packages.reduce(
    (acc, pkg) => {
      const qty = Number(pkg.quantity) || 1;
      const status = (pkg.status || "RECEIVED").toUpperCase();

      acc.totalItems += 1;
      acc.totalContentQty += qty;

      if (status === "RECEIVED") acc.pending += qty;
      else if (["LOADED", "IN_TRANSIT", "OUT_FOR_DELIVERY"].includes(status))
        acc.loaded += qty;
      else if (status === "DELIVERED") acc.delivered += qty;

      return acc;
    },
    { totalItems: 0, totalContentQty: 0, pending: 0, loaded: 0, delivered: 0 },
  );
};

exports.splitShipments = onCall(
  { region: "asia-southeast1", maxInstances: 10 },
  async (request) => {
    // 1. AUTH CHECK
    if (!request.auth)
      throw new HttpsError("unauthenticated", "Auth required.");

    const { originalShipmentId, itemsToSplit, location, remarks } =
      request.data;
    const uid = request.auth.uid;

    if (!originalShipmentId || !itemsToSplit || itemsToSplit.length === 0) {
      throw new HttpsError("invalid-argument", "Missing shipment ID or items.");
    }

    const originRef = db.collection("shipments").doc(originalShipmentId);
    const newShipmentId = `${originalShipmentId}-SP-${Date.now().toString().slice(-4)}`;
    const newShipmentRef = db.collection("shipments").doc(newShipmentId);

    await db.runTransaction(async (tx) => {
      // --- PHASE 1: READS ---
      const originSnap = await tx.get(originRef);
      if (!originSnap.exists)
        throw new HttpsError("not-found", "Origin shipment not found.");

      const originData = originSnap.data();
      const allPackages = originData.packages || [];

      // itemsToSplit expected: [{ trackingNumber: "AT-01", splitQty: 10 }]
      const splitMap = new Map(
        itemsToSplit.map((i) => [i.trackingNumber, i.splitQty]),
      );

      const keepPackages = [];
      const movePackages = [];

      // --- PHASE 2: HYBRID SPLIT LOGIC ---
      allPackages.forEach((pkg) => {
        if (splitMap.has(pkg.trackingNumber)) {
          const splitQty = Number(splitMap.get(pkg.trackingNumber));
          const originalQty = Number(pkg.quantity || 1);

          if (splitQty >= originalQty) {
            // MOVE FULL PACKAGE
            movePackages.push(pkg);
          } else {
            // LOGICAL SPLIT (Create new sub-package)
            const remainingQty = originalQty - splitQty;

            keepPackages.push({ ...pkg, quantity: remainingQty });

            movePackages.push({
              ...pkg,
              quantity: splitQty,
              trackingNumber: `${pkg.trackingNumber}-S`, // Suffix for traceability
              status: "RECEIVED",
              loadedQty: 0,
              loadedOnTrip: null,
            });
          }
        } else {
          keepPackages.push(pkg);
        }
      });

      if (movePackages.length === 0)
        throw new HttpsError("failed-precondition", "Nothing to split.");

      // --- PHASE 3: CALCULATE NEW TOTALS ---
      const newShipmentTotals = recalculatePieceTotals(movePackages);
      const originShipmentTotals = recalculatePieceTotals(keepPackages);

      // --- PHASE 4: WRITES ---

      // 1. Create New Shipment (Clone metadata)
      tx.set(newShipmentRef, {
        ...originData,
        id: newShipmentId,
        trackingNumber: newShipmentId,
        packages: movePackages,
        packageBarcodes: movePackages.map((p) => p.trackingNumber),
        status: "RECEIVED",
        currentTruckTripId: null,
        totals: newShipmentTotals,
        parentShipmentId: originalShipmentId,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: uid,
        statusHistory: [
          {
            status: "RECEIVED",
            at: new Date().toISOString(),
            note: `Created via split from ${originalShipmentId}. Extracted ${newShipmentTotals.totalContentQty} pieces.`,
            by: uid,
          },
        ],
      });

      // 2. Update Original Shipment
      tx.update(originRef, {
        packages: keepPackages,
        packageBarcodes: keepPackages.map((p) => p.trackingNumber),
        totals: originShipmentTotals,
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: uid,
        statusHistory: FieldValue.arrayUnion({
          status: originData.status,
          at: new Date().toISOString(),
          by: uid,
          note: `Split out ${newShipmentTotals.totalContentQty} pieces to ${newShipmentId}.`,
          location: location || null,
        }),
      });

      // 3. HANDSHAKE: Sync with Active Truck Trip
      if (originData.currentTruckTripId) {
        const tripRef = db
          .collection("truck_trips")
          .doc(originData.currentTruckTripId);
        const tripShipmentRef = tripRef
          .collection("trip_shipments")
          .doc(originalShipmentId);

        // Update the Truck Manifest for the origin shipment
        tx.update(tripShipmentRef, {
          totalItems: originShipmentTotals.totalContentQty,
          loadedCount: originShipmentTotals.loaded,
          updatedAt: FieldValue.serverTimestamp(),
        });

        // Decrement the moved pieces from the global truck dashboard
        tx.update(tripRef, {
          totalItems: FieldValue.increment(-newShipmentTotals.totalContentQty),
          itemPending: FieldValue.increment(-newShipmentTotals.pending),
          totalLoaded: FieldValue.increment(-newShipmentTotals.loaded),
          updatedAt: FieldValue.serverTimestamp(),
        });
      }

      // 4. Global Audit Log
      tx.set(db.collection("audit_logs").doc(), {
        action: "SPLIT_SHIPMENT",
        originId: originalShipmentId,
        newId: newShipmentId,
        movedPieces: newShipmentTotals.totalContentQty,
        actor: uid,
        timestamp: FieldValue.serverTimestamp(),
        remarks: remarks || null,
      });
    });

    return { success: true, newShipmentId };
  },
);
