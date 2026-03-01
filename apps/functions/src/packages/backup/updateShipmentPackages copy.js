const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const { FieldValue } = admin.firestore;

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

exports.updateShipmentPackages = onCall(
  { region: "asia-southeast1", maxInstances: 10 },
  async (request) => {
    // 1. Auth Check (Automatic with onCall)
    if (!request.auth) {
      throw new HttpsError(
        "unauthenticated",
        "The function must be called while authenticated.",
      );
    }

    const { shipmentId, packages } = request.data;
    const userId = request.auth.uid;

    if (!shipmentId || !packages || !Array.isArray(packages)) {
      throw new HttpsError(
        "invalid-argument",
        "shipmentId and packages array are required.",
      );
    }

    try {
      // 2. Calculate New Stats (In-Memory)
      const newStats = packages.reduce(
        (acc, pkg) => {
          acc.totalItems += 1;
          // Collect barcodes if they exist
          if (pkg.trackingNumber) acc.barcodes.push(pkg.trackingNumber);

          const status = pkg.status || "RECEIVED";

          // Count specific statuses
          if (status === "RECEIVED") acc.pending += 1;
          if (status === "LOADED" || status === "IN_TRANSIT") acc.loaded += 1;
          if (status === "DELIVERED") acc.delivered += 1;

          // ✅ ADD THIS LINE:
          if (status === "ARRIVED") acc.arrived += 1;

          return acc;
        },
        {
          totalItems: 0,
          pending: 0,
          loaded: 0,
          delivered: 0,
          received: 0, // Customize if needed
          arrived: 0, // ✅ ADD THIS LINE (Initialize counter)
          barcodes: [],
        },
      );

      // 3. Run Firestore Transaction
      await db.runTransaction(async (t) => {
        // A. References
        const shipmentRef = db.collection("shipments").doc(shipmentId);

        // B. Reads
        const shipmentDoc = await t.get(shipmentRef);
        if (!shipmentDoc.exists) {
          throw new HttpsError("not-found", "Shipment not found");
        }

        const shipmentData = shipmentDoc.data();
        const tripId = shipmentData.currentTruckTripId;

        let tripRef = null;
        let tripShipmentRef = null;
        let oldTripShipmentData = null;

        // Check if assigned to a Trip
        if (tripId) {
          tripRef = db.collection("truck_trips").doc(tripId);
          tripShipmentRef = tripRef
            .collection("trip_shipments")
            .doc(shipmentId);
          const tripShipmentDoc = await t.get(tripShipmentRef);

          if (tripShipmentDoc.exists) {
            oldTripShipmentData = tripShipmentDoc.data();
          }
        }

        // --- WRITES ---

        // C. Update Shipment (Root)
        t.update(shipmentRef, {
          packages: packages,
          packageBarcodes: newStats.barcodes,
          totals: {
            totalItems: newStats.totalItems,
            pending: newStats.pending,
            loaded: newStats.loaded,
            delivered: newStats.delivered,
            received: newStats.received,
            arrived: newStats.arrived, // ✅ ADD THIS LINE
          },
          updatedAt: FieldValue.serverTimestamp(),
          updatedBy: userId,
          audit_log: FieldValue.arrayUnion({
            action: "UPDATE_PACKAGES",
            at: new Date().toISOString(),
            by: userId,
            note: `Packages updated via Cloud Function. Count: ${newStats.totalItems}`,
          }),
        });

        // D. Update Trip & Subcollection (If assigned)
        if (tripId && tripRef && tripShipmentRef && oldTripShipmentData) {
          // 1. Update Sub-document
          t.update(tripShipmentRef, {
            totalItems: newStats.totalItems,
            pendingCount: newStats.pending,
            loadedCount: newStats.loaded,
            deliveredCount: newStats.delivered,
            arrived: newStats.arrived, // ✅ ADD THIS LINE
            packageBarcodes: newStats.barcodes,
            updatedAt: FieldValue.serverTimestamp(),
          });

          // 2. Update Parent Trip (Deltas)
          // Calculate difference: New - Old
          const deltaTotal =
            newStats.totalItems - (oldTripShipmentData.totalItems || 0);
          const deltaPending =
            newStats.pending - (oldTripShipmentData.pendingCount || 0);
          const deltaLoaded =
            newStats.loaded - (oldTripShipmentData.loadedCount || 0);
          const deltaDelivered =
            newStats.delivered - (oldTripShipmentData.deliveredCount || 0);
          // ✅ ADD THIS LINE:
          const deltaArrived =
            newStats.arrived - (oldTripShipmentData.arrivedCount || 0);

          // Atomic Increment
          t.update(tripRef, {
            totalItems: FieldValue.increment(deltaTotal),
            itemPending: FieldValue.increment(deltaPending),
            totalLoaded: FieldValue.increment(deltaLoaded),
            totalDelivered: FieldValue.increment(deltaDelivered),
            totalArrived: FieldValue.increment(deltaArrived),
            updatedAt: FieldValue.serverTimestamp(),
          });
        }
      });

      return { success: true, message: "Packages updated successfully" };
    } catch (error) {
      console.error("Transaction Error:", error);
      // Re-throw known HttpsErrors, wrap others
      if (error instanceof HttpsError) throw error;
      throw new HttpsError("internal", error.message);
    }
  },
);
