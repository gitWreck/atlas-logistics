const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const { FieldValue } = admin.firestore;

// Initialize Admin if not already done
if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

// --- HELPER: Recalculate Totals based on Package Status ---
const recalculateTotals = (packages) => {
  return packages.reduce(
    (acc, pkg) => {
      acc.totalItems += 1;

      const status = (pkg.status || "RECEIVED").toUpperCase();

      if (status === "RECEIVED") acc.pending += 1;
      else if (["LOADED", "IN_TRANSIT", "OUT_FOR_DELIVERY"].includes(status))
        acc.loaded += 1;
      else if (status === "DELIVERED") acc.delivered += 1;

      // "received" usually tracks total intake at warehouse
      acc.received += 1;

      return acc;
    },
    { totalItems: 0, pending: 0, loaded: 0, delivered: 0, received: 0 },
  );
};

/* ======================================================
   SPLIT SHIPMENT (Full Implementation)
====================================================== */
exports.splitShipments = onCall(
  { region: "asia-southeast1", maxInstances: 10 },
  async (request) => {
    // 1. Auth Check
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Authentication required.");
    }

    const { originalShipmentId, itemsToSplit } = request.data;
    // itemsToSplit: Array of barcode strings ["TRK-123-01", "TRK-123-02"]

    // 2. Input Validation
    if (!originalShipmentId) {
      throw new HttpsError("invalid-argument", "Missing original shipment ID.");
    }
    if (
      !itemsToSplit ||
      !Array.isArray(itemsToSplit) ||
      itemsToSplit.length === 0
    ) {
      throw new HttpsError("invalid-argument", "Missing items to split.");
    }

    const uid = request.auth.uid;
    const originRef = db.collection("shipments").doc(originalShipmentId);

    // We will return the new ID to the client
    let newShipmentId = null;

    // 3. Start Transaction
    await db.runTransaction(async (tx) => {
      // A. Read Original Shipment
      const originDoc = await tx.get(originRef);
      if (!originDoc.exists) {
        throw new HttpsError("not-found", "Original shipment not found.");
      }

      const originData = originDoc.data();
      const allPackages = originData.packages || [];

      // B. Separate Packages (Keep vs Move)
      const splitSet = new Set(itemsToSplit);
      const keepPackages = [];
      const movePackages = [];

      allPackages.forEach((pkg) => {
        // We check trackingNumber first, fallback to checking if the whole object matches (rare)
        if (pkg.trackingNumber && splitSet.has(pkg.trackingNumber)) {
          movePackages.push(pkg);
        } else {
          keepPackages.push(pkg);
        }
      });

      // C. Logic Validation
      if (movePackages.length === 0) {
        throw new HttpsError(
          "failed-precondition",
          "No matching packages found to split.",
        );
      }
      if (keepPackages.length === 0) {
        throw new HttpsError(
          "failed-precondition",
          "Cannot split ALL items. Use rename or edit instead.",
        );
      }

      // D. Prepare New Shipment Data
      // Generate ID: {Original}-SP-{Timestamp}
      const timeSuffix = Date.now().toString().slice(-5);
      newShipmentId = `${originalShipmentId}-SP-${timeSuffix}`;
      const newShipmentRef = db.collection("shipments").doc(newShipmentId);

      // Recalculate totals for the NEW shipment
      const newTotals = recalculateTotals(movePackages);

      // Construct New Object
      const newShipmentData = {
        ...originData, // Copy sender, recipient, route, etc.

        // Overwrites
        id: newShipmentId, // Ensure internal ID matches doc ID
        trackingNumber: newShipmentId,
        packages: movePackages,
        packageBarcodes: movePackages.map((p) => p.trackingNumber),
        totals: newTotals,

        // Reset Status / Trip Info (New shipment is fresh)
        status: "RECEIVED",
        currentTruckTripId: null,
        assignedToTruckTripAt: null,

        // Linkage Metadata
        parentShipmentId: originalShipmentId,
        splitFromAt: FieldValue.serverTimestamp(),
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: uid,

        // Clean History (Start fresh log)
        statusHistory: [
          {
            status: "RECEIVED",
            at: new Date().toISOString(), // Use ISO string for array storage
            note: `Created via split from ${originalShipmentId}`,
            by: uid,
          },
        ],
      };

      // E. Prepare Original Shipment Updates
      const originTotals = recalculateTotals(keepPackages);

      // --- NEW: TRUCK TRIP SYNC LOGIC ---
      let tripRef = null;
      let tripDoc = null;
      let tripShipmentRef = null;

      if (originData.currentTruckTripId) {
        tripRef = db
          .collection("truck_trips")
          .doc(originData.currentTruckTripId);
        tripDoc = await tx.get(tripRef);

        if (tripDoc.exists) {
          // Reference to the subcollection document linking this shipment to the trip
          tripShipmentRef = tripRef
            .collection("trip_shipments")
            .doc(originalShipmentId);
        }
      }

      // F. WRITE OPERATIONS

      // 1. Create New Shipment
      tx.set(newShipmentRef, newShipmentData);

      // 2. Update Original Shipment
      tx.update(originRef, {
        packages: keepPackages,
        packageBarcodes: keepPackages.map((p) => p.trackingNumber),
        totals: originTotals, // Update totals with accurate recount
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: uid,
        audit_log: FieldValue.arrayUnion({
          action: "SPLIT_OUT",
          at: new Date().toISOString(),
          by: uid,
          note: `Moved ${movePackages.length} items to ${newShipmentId}`,
          details: { newShipmentId, count: movePackages.length },
        }),
      });

      // --- 2.5: Update Truck Trip (If Applicable) ---
      if (tripDoc && tripDoc.exists) {
        const tripData = tripDoc.data();

        // 1. Update the Master Truck Trip Document
        // Subtract the moved packages from the master trip counters
        tx.update(tripRef, {
          totalItems: Math.max(
            0,
            (tripData.totalItems || 0) - movePackages.length,
          ),
          itemPending: Math.max(
            0,
            (tripData.itemPending || 0) - movePackages.length,
          ),
          updatedAt: FieldValue.serverTimestamp(),
        });

        // 2. Update the Trip Shipment Subcollection Document
        // Use the newly calculated 'originTotals' to set exact values
        if (tripShipmentRef) {
          tx.update(tripShipmentRef, {
            totalItems: originTotals.totalItems,
            pendingCount: originTotals.pending,
            updatedAt: FieldValue.serverTimestamp(),
          });
        }
      }

      // 3. Global Audit Log
      const globalLogRef = db.collection("audit_log").doc();
      tx.set(globalLogRef, {
        action: "SPLIT_SHIPMENT",
        targetId: originalShipmentId, // Main target is the origin
        targetCollection: "shipments",
        secondaryId: newShipmentId,
        at: FieldValue.serverTimestamp(),
        by: uid,
        note: `Split shipment. Moved ${movePackages.length} items. Kept ${keepPackages.length}.`,
        details: {
          movedCount: movePackages.length,
          movedBarcodes: movePackages.map((p) => p.trackingNumber),
        },
      });
    });

    // 4. Return result to client
    return { success: true, newShipmentId };
  },
);
