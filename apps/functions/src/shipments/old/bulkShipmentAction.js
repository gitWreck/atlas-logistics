"use strict";

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const { FieldValue } = admin.firestore;
const { requireRole } = require("../../utilities/helpers");

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

exports.bulkShipmentAction = onCall(
  { region: "asia-southeast1", maxInstances: 10 },
  async (request) => {
    // 1. AUTH & ROLE CHECK
    if (!request.auth) throw new HttpsError("unauthenticated", "Auth required");
    await requireRole(db, request, ["admin", "manager", "checker"]);

    const { tripId, shipmentIds, action, location, remarks } = request.data;
    const userId = request.auth.uid;

    if (!tripId || !shipmentIds || shipmentIds.length === 0) {
      throw new HttpsError("invalid-argument", "Missing tripId or shipmentIds");
    }

    // 2. NORMALIZE TARGET STATUS
    // We map frontend actions to strict database statuses
    let targetStatus = action;
    if (action === "LOAD") targetStatus = "LOADED";
    if (action === "UNLOAD") targetStatus = "RECEIVED";

    try {
      await db.runTransaction(async (t) => {
        // --- PHASE 1: READS ---
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

        // --- PHASE 2: LOGIC & WRITES ---
        let tripDeltaLoaded = 0;
        let tripDeltaPending = 0;
        let tripDeltaDelivered = 0;

        for (let i = 0; i < shipmentIds.length; i++) {
          const shipDoc = shipmentDocs[i];
          const tripShipDoc = tripShipmentDocs[i];
          const shipRef = shipmentRefs[i];
          const tripShipRef = tripShipmentRefs[i];

          if (!shipDoc.exists) continue;

          const shipData = shipDoc.data();
          const currentStatus = shipData.status;
          const packages = shipData.packages || [];

          // Counters for this specific shipment
          let localLoadedChange = 0;
          let localPendingChange = 0;
          let localDeliveredChange = 0;

          // Process individual packages inside the shipment
          const updatedPackages = packages.map((pkg) => {
            if (pkg.status === targetStatus) return pkg;

            // Business Logic Matrix: Update counters based on state transition
            if (targetStatus === "LOADED" && pkg.status !== "LOADED") {
              localPendingChange--;
              localLoadedChange++;
            } else if (
              (targetStatus === "RECEIVED" || targetStatus === "MISSING") &&
              pkg.status === "LOADED"
            ) {
              localLoadedChange--;
              localPendingChange++;
            } else if (
              targetStatus === "DELIVERED" &&
              pkg.status === "LOADED"
            ) {
              localLoadedChange--;
              localDeliveredChange++;
            }

            return { ...pkg, status: targetStatus };
          });

          // Update Transaction-wide Deltas for the Trip doc
          tripDeltaLoaded += localLoadedChange;
          tripDeltaPending += localPendingChange;
          tripDeltaDelivered += localDeliveredChange;

          // Write 1: Update Main Shipment Document
          t.update(shipRef, {
            status: targetStatus,
            packages: updatedPackages,
            "totals.loaded": FieldValue.increment(localLoadedChange),
            "totals.pending": FieldValue.increment(localPendingChange),
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

          // Write 2: Update Trip-Shipment Sub-collection
          if (tripShipDoc.exists) {
            t.update(tripShipRef, {
              status: targetStatus,
              loadedCount: FieldValue.increment(localLoadedChange),
              pendingCount: FieldValue.increment(localPendingChange),
              deliveredCount: FieldValue.increment(localDeliveredChange),
              updatedAt: FieldValue.serverTimestamp(),
            });
          }
        }

        // Write 3: Update Parent Trip Document Counters
        t.update(tripRef, {
          totalLoaded: FieldValue.increment(tripDeltaLoaded),
          itemPending: FieldValue.increment(tripDeltaPending),
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
      console.error("Bulk Action Error:", error);
      throw new HttpsError("internal", error.message);
    }
  },
);
