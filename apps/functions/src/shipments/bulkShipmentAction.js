const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const { FieldValue } = admin.firestore;
const { requireRole } = require("../utilities/helpers"); // Assuming this exists as per your code

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

exports.bulkShipmentAction = onCall(
  { region: "asia-southeast1", maxInstances: 10 },
  async (request) => {
    await requireRole(db, request, ["admin", "manager"]); // Uncomment if using role helper

    if (!request.auth) throw new HttpsError("unauthenticated", "Auth required");

    const { tripId, shipmentIds, action } = request.data;
    // action = "LOAD", "UNLOAD", "OUT_FOR_DELIVERY", "DELIVERED"

    // 1. Determine Target Status
    let targetStatus = "RECEIVED";
    if (action === "LOAD") targetStatus = "LOADED";
    if (action === "OUT_FOR_DELIVERY") targetStatus = "OUT_FOR_DELIVERY";
    if (action === "DELIVERED") targetStatus = "DELIVERED";

    const userId = request.auth.uid;

    if (!tripId || !shipmentIds || shipmentIds.length === 0) {
      throw new HttpsError("invalid-argument", "Missing parameters");
    }

    try {
      await db.runTransaction(async (t) => {
        // 2. Get the Trip Ref
        const tripRef = db.collection("truck_trips").doc(tripId);

        // Variables to track TOTAL changes for the Trip Document
        let tripDeltaLoaded = 0;
        let tripDeltaPending = 0;
        let tripDeltaDelivered = 0; // <--- NEW

        // 3. Iterate through every selected shipment
        for (const shipId of shipmentIds) {
          const shipRef = db.collection("shipments").doc(shipId);
          const tripShipRef = tripRef.collection("trip_shipments").doc(shipId);

          const shipDoc = await t.get(shipRef);
          const tripShipDoc = await t.get(tripShipRef);

          if (!shipDoc.exists) continue;

          const shipData = shipDoc.data();
          const packages = shipData.packages || [];

          // 4. Update Packages & Calculate Local Deltas
          let localLoadedChange = 0;
          let localPendingChange = 0;
          let localDeliveredChange = 0; // <--- NEW

          const updatedPackages = packages.map((pkg) => {
            // If status is already correct, do nothing
            if (pkg.status === targetStatus) return pkg;

            const currentStatus = pkg.status;

            // --- LOGIC MATRIX ---

            // A. LOADING (Received -> Loaded)
            if (action === "LOAD" && currentStatus === "RECEIVED") {
              localPendingChange--;
              localLoadedChange++;
            }
            // B. UNLOADING (Loaded -> Received)
            else if (action === "UNLOAD" && currentStatus === "LOADED") {
              localLoadedChange--;
              localPendingChange++;
            }
            // C. OUT FOR DELIVERY (Loaded -> Out)
            else if (
              action === "OUT_FOR_DELIVERY" &&
              currentStatus === "LOADED"
            ) {
              // No count change: It is still technically "on the truck" (loaded) until delivered
              // Unless you have a specific 'Out' counter, we usually keep it as Loaded count.
            }
            // D. DELIVERED (Loaded/Out -> Delivered)
            else if (
              action === "DELIVERED" &&
              ["LOADED", "OUT_FOR_DELIVERY"].includes(currentStatus)
            ) {
              localLoadedChange--; // Removes from the truck
              localDeliveredChange++; // Adds to delivered
            }

            return { ...pkg, status: targetStatus };
          });

          // Add local changes to the Global Trip Delta
          tripDeltaLoaded += localLoadedChange;
          tripDeltaPending += localPendingChange;
          tripDeltaDelivered += localDeliveredChange;

          // 5. Update Shipment Doc
          t.update(shipRef, {
            packages: updatedPackages,
            "totals.loaded": FieldValue.increment(localLoadedChange),
            "totals.pending": FieldValue.increment(localPendingChange),
            "totals.delivered": FieldValue.increment(localDeliveredChange), // <--- NEW
            status:
              action === "LOAD"
                ? "LOADED"
                : action === "UNLOAD"
                  ? "ASSIGNED"
                  : targetStatus,
            updatedAt: FieldValue.serverTimestamp(),
            updatedBy: userId,
          });

          // 6. Update Trip Shipment Sub-Doc
          if (tripShipDoc.exists) {
            t.update(tripShipRef, {
              loadedCount: FieldValue.increment(localLoadedChange),
              pendingCount: FieldValue.increment(localPendingChange),
              deliveredCount: FieldValue.increment(localDeliveredChange), // <--- NEW
              updatedAt: FieldValue.serverTimestamp(),
            });
          }
        }

        // 7. Update Main Trip Doc (Atomic Increment)
        t.update(tripRef, {
          totalLoaded: FieldValue.increment(tripDeltaLoaded),
          itemPending: FieldValue.increment(tripDeltaPending),
          totalDelivered: FieldValue.increment(tripDeltaDelivered), // <--- NEW
          updatedAt: FieldValue.serverTimestamp(),
        });

        // 8. Audit Log
        const logRef = db.collection("audit_log").doc();

        // Helper to format action string
        let logAction = "BULK_UPDATE";
        if (action === "LOAD") logAction = "BULK_LOAD";
        else if (action === "UNLOAD") logAction = "BULK_UNLOAD";
        else if (action === "DELIVERED") logAction = "BULK_DELIVER";
        else if (action === "OUT_FOR_DELIVERY")
          logAction = "BULK_OUT_FOR_DELIVERY";

        t.set(logRef, {
          action: logAction,
          targetId: tripId,
          targetCollection: "truck_trips",
          at: FieldValue.serverTimestamp(),
          by: userId,
          note: `${action} executed on ${shipmentIds.length} shipments.`,
          details: {
            shipmentIds: shipmentIds,
            deltaLoaded: tripDeltaLoaded,
            deltaPending: tripDeltaPending,
            deltaDelivered: tripDeltaDelivered,
          },
        });
      });

      return { success: true };
    } catch (error) {
      console.error(error);
      throw new HttpsError("internal", error.message);
    }
  },
);
