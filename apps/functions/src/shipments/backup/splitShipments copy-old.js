const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const { requireRole } = require("../../utilities/helpers");

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

/* ======================================================
   SPLIT SHIPMENT (Array Version)
====================================================== */
exports.splitShipment = onCall(
  { region: "asia-southeast1", maxInstances: 10 },
  async (req) => {
    // 1. Auth & Role Check
    await requireRole(db, req, ["admin", "manager"]);

    const { originalShipmentId, itemsToSplit } = req.data;
    // itemsToSplit:
    //   - number (e.g., 5 => move the last 5 items)
    //   - array of strings (e.g., ["TRK-001-05", "TRK-001-06"] => move specific barcodes)

    if (!originalShipmentId)
      throw new HttpsError("invalid-argument", "Missing shipment ID");
    if (!itemsToSplit)
      throw new HttpsError("invalid-argument", "Missing items to split");

    const uid = req.auth.uid;
    const originRef = db.collection("shipments").doc(originalShipmentId);

    let newShipmentId = null;

    await db.runTransaction(async (tx) => {
      // 2. Get Original Shipment
      const originSnap = await tx.get(originRef);
      if (!originSnap.exists)
        throw new HttpsError("not-found", "Shipment not found");

      const originData = originSnap.data();
      const allPackages = originData.packages || [];

      // Guard: Cannot split if currently assigned to a trip
      if (originData.currentTruckTripId) {
        throw new HttpsError(
          "failed-precondition",
          "Shipment is currently assigned to a trip. Unassign it before splitting.",
        );
      }

      // 3. Identify Packages to Move (Filter the Array)
      let movePackages = [];
      let keepPackages = [];

      if (typeof itemsToSplit === "number") {
        // Option A: Split by Count (Take the last N items)
        if (itemsToSplit >= allPackages.length) {
          throw new HttpsError(
            "invalid-argument",
            "Cannot split all items (rename instead).",
          );
        }
        const splitIndex = allPackages.length - itemsToSplit;
        keepPackages = allPackages.slice(0, splitIndex);
        movePackages = allPackages.slice(splitIndex);
      } else if (Array.isArray(itemsToSplit)) {
        // Option B: Split by Specific Barcodes
        const targets = new Set(itemsToSplit);

        keepPackages = allPackages.filter(
          (p) => !targets.has(p.trackingNumber),
        );
        movePackages = allPackages.filter((p) => targets.has(p.trackingNumber));
      }

      if (movePackages.length === 0) {
        throw new HttpsError(
          "invalid-argument",
          "No matching packages found to split.",
        );
      }
      if (keepPackages.length === 0) {
        throw new HttpsError(
          "invalid-argument",
          "Result would leave original shipment empty.",
        );
      }

      // 4. Prepare Data for New Shipment
      // Note: We do NOT change the package barcode.
      // This ensures physical labels on boxes still work.
      const moveBarcodes = movePackages.map((p) => p.trackingNumber);
      const keepBarcodes = keepPackages.map((p) => p.trackingNumber);

      // Generate New Shipment ID
      const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
      newShipmentId = `${originalShipmentId}-SP-${Date.now().toString().slice(-4)}`;
      const newShipmentRef = db.collection("shipments").doc(newShipmentId);

      // 5. Create New Shipment Doc
      const newShipmentData = {
        ...originData, // Copy sender, receiver, route, etc.
        trackingNumber: newShipmentId,

        // Reset Status
        status: "RECEIVED",
        statusHistory: [
          {
            status: "RECEIVED",
            at: admin.firestore.Timestamp.now(),
            note: `Split from ${originalShipmentId}`,
          },
        ],

        // Clear Trip Info
        currentTruckTripId: null,
        assignedToTruckTripAt: null,

        // Update Totals
        totals: {
          ...originData.totals,
          totalItems: movePackages.length,
          received: movePackages.length,
          loaded: 0,
          pending: movePackages.length, // Assume they need to be re-processed
        },

        // Linkage
        parentShipmentId: originalShipmentId,
        splitFromAt: admin.firestore.FieldValue.serverTimestamp(),
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),

        // THE NEW ARRAYS
        packages: movePackages,
        packageBarcodes: moveBarcodes,
      };

      // Remove ID field if copied from originData (firestore doesn't store doc ID in data usually, but just in case)
      delete newShipmentData.id;

      tx.set(newShipmentRef, newShipmentData);

      // 6. Update Original Shipment Doc
      tx.update(originRef, {
        packages: keepPackages,
        packageBarcodes: keepBarcodes,

        "totals.totalItems": keepPackages.length,
        "totals.received": keepPackages.length, // Logic assumption: origin is purely warehouse side if unassigned
        "totals.pending": keepPackages.length, // Reset pending calculation if needed, or recalculate based on status

        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // 7. Audit Logs
      const now = admin.firestore.FieldValue.serverTimestamp();

      // Log on Origin
      tx.set(originRef.collection("status_events").doc(), {
        type: "SPLIT_ORDER_OUT",
        message: `Split ${movePackages.length} items to ${newShipmentId}`,
        createdAt: now,
        createdBy: uid,
      });

      // Log on New
      // Note: We use the batch/transaction to create the subcollection doc
      // technically we can't 'set' a subcollection doc on a ref that doesn't exist yet in the DB context
      // but 'set' works fine for new document paths.
      // Alternatively, stick to the statusHistory array we created above.

      // Admin Log
      tx.set(db.collection("admin_logs").doc(), {
        action: "SPLIT_SHIPMENT",
        originalShipmentId,
        newShipmentId,
        itemCount: movePackages.length,
        actorId: uid,
        createdAt: now,
      });
    });

    return { success: true, newShipmentId };
  },
);
