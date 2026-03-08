"use strict";

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const { FieldValue } = admin.firestore;
const { requireRole } = require("../utilities/helpers");

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

exports.bulkShipmentAction = onCall(
  { region: "asia-southeast1", maxInstances: 10 },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Auth required");
    await requireRole(db, request, ["admin", "manager", "checker"]);

    const { tripId, shipmentIds, action, location, remarks } = request.data;
    const userId = request.auth.uid;

    if (!tripId || !shipmentIds || shipmentIds.length === 0) {
      throw new HttpsError("invalid-argument", "Missing tripId or shipmentIds");
    }

    let targetStatus =
      action === "LOAD" ? "LOADED" : action === "UNLOAD" ? "RECEIVED" : action;

    try {
      await db.runTransaction(async (t) => {
        const tripRef = db.collection("truck_trips").doc(tripId);
        const shipmentRefs = shipmentIds.map((id) =>
          db.collection("shipments").doc(id),
        );
        const tripShipmentRefs = shipmentIds.map((id) =>
          tripRef.collection("trip_shipments").doc(id),
        );

        const [shipmentDocs, tripShipmentDocs] = await Promise.all([
          Promise.all(shipmentRefs.map((ref) => t.get(ref))),
          Promise.all(tripShipmentRefs.map((ref) => t.get(ref))),
        ]);

        let tripDeltaLoaded = 0;
        let tripDeltaPending = 0;
        let tripDeltaDelivered = 0;

        for (let i = 0; i < shipmentIds.length; i++) {
          const shipDoc = shipmentDocs[i];
          const tripShipDoc = tripShipmentDocs[i];
          if (!shipDoc.exists) continue;

          const shipData = shipDoc.data();
          const packages = shipData.packages || [];

          let shipPieceLoadedChange = 0;
          let shipPiecePendingChange = 0;
          let shipPieceDeliveredChange = 0;

          // ✅ 1. CALCULATE DELTAS BASED ON PIECE QUANTITY
          const updatedPackages = packages.map((pkg) => {
            if (pkg.status === targetStatus) return pkg;

            const qty = Number(pkg.quantity) || 1;
            const currentLoadedQty = Number(pkg.loadedQty) || 0;

            if (targetStatus === "LOADED") {
              // Moving to Loaded: Add the remaining pieces not yet loaded
              const toLoad = qty - currentLoadedQty;
              shipPieceLoadedChange += toLoad;
              shipPiecePendingChange -= toLoad;
              return {
                ...pkg,
                status: "LOADED",
                loadedQty: qty,
                loadedAt: new Date().toISOString(),
              };
            } else if (targetStatus === "RECEIVED") {
              // Moving back to Hub: Remove whatever was loaded
              shipPieceLoadedChange -= currentLoadedQty;
              shipPiecePendingChange += currentLoadedQty;
              return {
                ...pkg,
                status: "RECEIVED",
                loadedQty: 0,
                loadedAt: null,
              };
            } else if (targetStatus === "DELIVERED") {
              // Deliver everything
              shipPieceDeliveredChange += qty;
              shipPieceLoadedChange -= currentLoadedQty;
              // If it wasn't loaded but is being forced to delivered:
              if (pkg.status !== "LOADED")
                shipPiecePendingChange -= qty - currentLoadedQty;

              return {
                ...pkg,
                status: "DELIVERED",
                loadedQty: qty,
                deliveredAt: new Date().toISOString(),
              };
            }

            return { ...pkg, status: targetStatus };
          });

          // Accumulate for Trip Document
          tripDeltaLoaded += shipPieceLoadedChange;
          tripDeltaPending += shipPiecePendingChange;
          tripDeltaDelivered += shipPieceDeliveredChange;

          // Write 1: Shipment Doc
          t.update(shipmentRefs[i], {
            status: targetStatus,
            packages: updatedPackages,
            "totals.loaded": FieldValue.increment(shipPieceLoadedChange),
            "totals.pending": FieldValue.increment(shipPiecePendingChange),
            "totals.delivered": FieldValue.increment(shipPieceDeliveredChange),
            updatedAt: FieldValue.serverTimestamp(),
            statusHistory: FieldValue.arrayUnion({
              status: `BULK_${targetStatus}`,
              at: new Date(),
              by: userId,
              note: remarks || `Bulk ${action} applied to pieces.`,
            }),
          });

          // Write 2: Trip-Shipment Manifest
          if (tripShipDoc.exists) {
            t.update(tripShipmentRefs[i], {
              status: targetStatus,
              loadedCount: FieldValue.increment(shipPieceLoadedChange),
              pendingCount: FieldValue.increment(shipPiecePendingChange),
              deliveredCount: FieldValue.increment(shipPieceDeliveredChange),
              updatedAt: FieldValue.serverTimestamp(),
            });
          }
        }

        // Write 3: Trip Dashboard Counters
        t.update(tripRef, {
          totalLoaded: FieldValue.increment(tripDeltaLoaded),
          itemPending: FieldValue.increment(tripDeltaPending),
          totalDelivered: FieldValue.increment(tripDeltaDelivered),
          updatedAt: FieldValue.serverTimestamp(),
        });
      });

      return { success: true };
    } catch (error) {
      console.error("Bulk Action Error:", error);
      throw new HttpsError("internal", error.message);
    }
  },
);
