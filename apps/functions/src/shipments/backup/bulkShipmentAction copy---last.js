const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const { FieldValue } = admin.firestore;
const { requireRole } = require("../../utilities/helpers"); // Assuming this exists as per your code

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

exports.bulkShipmentAction = onCall(
  { region: "asia-southeast1", maxInstances: 10 },
  async (request) => {
    await requireRole(db, request, ["admin", "manager", "checker"]);

    if (!request.auth) throw new HttpsError("unauthenticated", "Auth required");

    const { tripId, shipmentIds, action, location } = request.data;
    const userId = request.auth.uid;

    // 1. Determine Target Status
    let targetStatus = "RECEIVED";
    if (action === "LOAD") targetStatus = "LOADED";
    if (action === "OFFLOAD") targetStatus = "ARRIVED"; // [New] For destination scan
    if (action === "OUT_FOR_DELIVERY") targetStatus = "OUT_FOR_DELIVERY";
    if (action === "DELIVERED") targetStatus = "DELIVERED";
    else if (action === "UNLOAD") targetStatus = "RECEIVED";

    if (!tripId || !shipmentIds || shipmentIds.length === 0) {
      throw new HttpsError("invalid-argument", "Missing parameters");
    }

    try {
      await db.runTransaction(async (t) => {
        // --- PHASE 1: READS (Must come first) ---

        const tripRef = db.collection("truck_trips").doc(tripId);

        // Prepare arrays to hold refs so we can fetch them all
        const shipmentRefs = [];
        const tripShipmentRefs = [];

        shipmentIds.forEach((id) => {
          const sRef = db.collection("shipments").doc(id);
          const tsRef = tripRef.collection("trip_shipments").doc(id);
          shipmentRefs.push(sRef);
          tripShipmentRefs.push(tsRef);
        });

        // Execute all Reads
        // We use t.getAll (if available in your SDK version) or parallel t.get promises
        // Standard Admin SDK supports t.getAll(...refs) which is cleaner,
        // but simple Promise.all with t.get works reliably everywhere.

        const shipmentDocsPromise = Promise.all(
          shipmentRefs.map((ref) => t.get(ref)),
        );
        const tripShipmentDocsPromise = Promise.all(
          tripShipmentRefs.map((ref) => t.get(ref)),
        );

        const [shipmentDocs, tripShipmentDocs] = await Promise.all([
          shipmentDocsPromise,
          tripShipmentDocsPromise,
        ]);

        // --- PHASE 2: WRITES (Logic & Updates) ---

        // Variables to track TOTAL changes for the Trip Document
        let tripDeltaLoaded = 0;
        let tripDeltaPending = 0;
        let tripDeltaDelivered = 0;
        let tripDeltaArrived = 0;

        // Iterate using index to match docs with refs
        for (let i = 0; i < shipmentIds.length; i++) {
          const shipDoc = shipmentDocs[i];
          const tripShipDoc = tripShipmentDocs[i];
          const shipRef = shipmentRefs[i];
          const tripShipRef = tripShipmentRefs[i];

          if (!shipDoc.exists) continue;

          const shipData = shipDoc.data();
          const packages = shipData.packages || [];

          // Calculate Local Deltas
          let localLoadedChange = 0;
          let localPendingChange = 0;
          let localDeliveredChange = 0;
          let localArrivedChange = 0;

          const updatedPackages = packages.map((pkg) => {
            if (pkg.status === targetStatus) return pkg;
            const currentStatus = pkg.status;

            // Logic Matrix
            if (action === "LOAD" && currentStatus === "RECEIVED") {
              localPendingChange--;
              localLoadedChange++;
            } else if (action === "UNLOAD" && currentStatus === "LOADED") {
              localLoadedChange--;
              localPendingChange++;
            } // [NEW BLOCK] Handle Offload at Destination
            else if (
              (action === "OFFLOAD" || action === "ARRIVED") &&
              currentStatus === "LOADED"
            ) {
              localLoadedChange--;
              localArrivedChange++;
              // We don't increment pending or delivered here typically,
              // unless you track "Arrived at Hub" as a separate counter.
              // If you don't have a specific counter for 'arrived',
              // you might just decrement loaded.
            } else if (
              action === "DELIVERED" &&
              ["LOADED", "OUT_FOR_DELIVERY", "ARRIVED"].includes(currentStatus) // Add ARRIVED
            ) {
              // If it was loaded, decrement loaded. If it was already offloaded/arrived, don't.
              if (currentStatus === "LOADED") localLoadedChange--;
              if (currentStatus === "ARRIVED") localArrivedChange--; // Handle from Arrived too
              localDeliveredChange++;
            }

            return { ...pkg, status: targetStatus };
          });

          // Update Global Deltas
          tripDeltaLoaded += localLoadedChange;
          tripDeltaPending += localPendingChange;
          tripDeltaDelivered += localDeliveredChange;
          tripDeltaArrived += localArrivedChange;

          // Update Shipment Doc
          t.update(shipRef, {
            packages: updatedPackages,
            "totals.loaded": FieldValue.increment(localLoadedChange),
            "totals.pending": FieldValue.increment(localPendingChange),
            "totals.delivered": FieldValue.increment(localDeliveredChange),
            "totals.arrived": FieldValue.increment(localArrivedChange),
            status:
              action === "LOAD"
                ? "LOADED"
                : action === "UNLOAD"
                  ? "RECEIVED" // Back to start
                  : action === "OFFLOAD" || action === "ARRIVED"
                    ? "ARRIVED" // Destination scan
                    : targetStatus,
            updatedAt: FieldValue.serverTimestamp(),
            updatedBy: userId,

            // ✅ ADD THIS BLOCK:
            statusHistory: FieldValue.arrayUnion({
              status: targetStatus,
              at: new Date(), // Use JS Date for array elements to avoid serialization issues
              by: userId,
              note: `Bulk Action: ${action}`,
              location: location || null, // Saves geo-coords if provided
            }),

            // ✅ AND THIS: Update the latest known location on the doc root
            ...(location ? { lastLocation: location } : {}),
          });

          // Update Sub-Doc
          if (tripShipDoc.exists) {
            t.update(tripShipRef, {
              status:
                action === "LOAD"
                  ? "LOADED"
                  : action === "UNLOAD"
                    ? "RECEIVED" // Back to start
                    : action === "OFFLOAD" || action === "ARRIVED"
                      ? "ARRIVED" // Destination scan
                      : targetStatus,
              loadedCount: FieldValue.increment(localLoadedChange),
              pendingCount: FieldValue.increment(localPendingChange),
              deliveredCount: FieldValue.increment(localDeliveredChange),
              arrivedCount: FieldValue.increment(localArrivedChange),
              updatedAt: FieldValue.serverTimestamp(),
            });
          }
        }

        // Final Trip Update
        t.update(tripRef, {
          totalLoaded: FieldValue.increment(tripDeltaLoaded),
          itemPending: FieldValue.increment(tripDeltaPending),
          totalDelivered: FieldValue.increment(tripDeltaDelivered),
          totalArrived: FieldValue.increment(tripDeltaArrived),
          updatedAt: FieldValue.serverTimestamp(),
        });

        // Audit Log
        const logRef = db.collection("audit_logs").doc();
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
            deltaArrived: tripDeltaArrived,
          },
        });

        const alertRef = db.collection("admin_alerts").doc();
        t.set(alertRef, {
          type: "BULK_SHIPMENT_ACTION",
          subType: action, // e.g., "LOAD", "DELIVERED", etc.
          tripId: tripId,
          details: {
            reason: `Bulk status update (${action}) executed on ${shipmentIds.length} shipments.`,
            userId: userId,
            shipmentCount: shipmentIds.length,
          },
          status: "UNREAD",
          // Optional: You can make destructive actions like UNLOAD higher priority
          priority: action === "UNLOAD" ? "HIGH" : "LOW",
          createdAt: FieldValue.serverTimestamp(),
        });
      });

      return { success: true };
    } catch (error) {
      console.error(error);
      throw new HttpsError("internal", error.message);
    }
  },
);
