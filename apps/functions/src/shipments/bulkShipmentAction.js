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
    await requireRole(db, req, ["admin", "manager", "checker"]);

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
        let tripDeltaReceived = 0; // ✅ REPLACED tripDeltaPending
        let tripDeltaDelivered = 0;

        for (let i = 0; i < shipmentIds.length; i++) {
          const shipDoc = shipmentDocs[i];
          const tripShipDoc = tripShipmentDocs[i];
          if (!shipDoc.exists) continue;

          const shipData = shipDoc.data();
          const packages = shipData.packages || [];

          let localLoadedChange = 0;
          let localReceivedChange = 0; // ✅ REPLACED localPendingChange
          let localDeliveredChange = 0;

          const updatedPackages = packages.map((pkg) => {
            if (pkg.status === targetStatus) return pkg;
            const qty = Number(pkg.quantity) || 1;
            const oldStatus = pkg.status;

            // --- 1. DECREMENT OLD STATUS PIECES ---
            if (oldStatus === "LOADED") localLoadedChange -= qty;
            if (oldStatus === "RECEIVED") localReceivedChange -= qty;
            if (oldStatus === "DELIVERED") localDeliveredChange -= qty;

            // --- 2. INCREMENT NEW STATUS PIECES ---
            if (targetStatus === "LOADED") localLoadedChange += qty;
            if (targetStatus === "RECEIVED") localReceivedChange += qty;
            if (targetStatus === "DELIVERED") localDeliveredChange += qty;

            return {
              ...pkg,
              status: targetStatus,
              updatedAt: new Date().toISOString(),
            };
          });

          tripDeltaLoaded += localLoadedChange;
          tripDeltaReceived += localReceivedChange;
          tripDeltaDelivered += localDeliveredChange;

          // Write 1: Update Main Shipment
          t.update(shipmentRefs[i], {
            status: targetStatus,
            packages: updatedPackages,
            "totals.loaded": FieldValue.increment(localLoadedChange),
            "totals.received": FieldValue.increment(localReceivedChange), // ✅ New field
            "totals.delivered": FieldValue.increment(localDeliveredChange),
            updatedAt: FieldValue.serverTimestamp(),
            updatedBy: userId,
            // Track the reason/remarks
            remarks: remarks || null,
            statusHistory: FieldValue.arrayUnion({
              status: targetStatus,
              at: new Date(),
              by: userId,
              note: remarks ? `Remarks: ${remarks}` : `Bulk ${action} applied.`,
              location: location || null,
            }),
            ...(location ? { lastLocation: location } : {}),
          });

          // Write 2: Update Manifest Entry
          if (tripShipDoc.exists) {
            t.update(tripShipmentRefs[i], {
              status: targetStatus,
              loadedCount: FieldValue.increment(localLoadedChange),
              receivedCount: FieldValue.increment(localReceivedChange), // ✅ Corrected name
              deliveredCount: FieldValue.increment(localDeliveredChange),
              updatedAt: FieldValue.serverTimestamp(),
            });
          }
        }

        // Write 3: Update Parent Trip Document
        t.update(tripRef, {
          totalLoaded: FieldValue.increment(tripDeltaLoaded),
          totalReceived: FieldValue.increment(tripDeltaReceived), // ✅ Replaced itemPending
          totalDelivered: FieldValue.increment(tripDeltaDelivered),
          updatedAt: FieldValue.serverTimestamp(),
        });

        // Write 4: Audit Logging
        const logRef = db.collection("audit_logs").doc();
        t.set(logRef, {
          action: `BULK_${targetStatus}`,
          targetId: tripId,
          targetCollection: "truck_trips",
          by: userId,
          at: FieldValue.serverTimestamp(),
          details: {
            shipmentCount: shipmentIds.length,
            remarks: remarks || "N/A",
            deltas: { loaded: tripDeltaLoaded, pending: tripDeltaPending },
          },
        });
      });

      return { success: true };
    } catch (error) {
      throw new HttpsError("internal", error.message);
    }
  },
);
