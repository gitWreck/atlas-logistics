const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const { requireRole } = require("../../utilities/helpers");

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

/* ======================================================
   SPLIT SHIPMENT (Creates a Child Shipment)
====================================================== */
exports.splitShipment = onCall(
  { region: "asia-southeast1", maxInstances: 10 },
  async (req) => {
    await requireRole(db, req, ["admin", "manager"]);

    const { originalShipmentId, itemsToSplit } = req.data;
    // itemsToSplit: number (count) OR array of package IDs to move

    if (!originalShipmentId)
      throw new HttpsError("invalid-argument", "Missing shipment ID");
    if (!itemsToSplit)
      throw new HttpsError("invalid-argument", "Missing items to split");

    const uid = req.auth.uid;
    const originRef = db.collection("shipments").doc(originalShipmentId);

    await db.runTransaction(async (tx) => {
      // 1. Get Original Shipment
      const originSnap = await tx.get(originRef);
      if (!originSnap.exists)
        throw new HttpsError("not-found", "Shipment not found");
      const originData = originSnap.data();

      // Guard: Cannot split if already assigned (Simplify logic: Unassign first)
      if (originData.currentTruckTripId) {
        throw new HttpsError(
          "failed-precondition",
          "Unassign shipment before splitting.",
        );
      }

      // 2. Identify Packages to Move
      let packagesToMove = [];
      const packagesRef = originRef.collection("packages");

      if (typeof itemsToSplit === "number") {
        // Option A: Split by Count (Take the last N items)
        // We need to query to get IDs. This usually requires reading the subcollection.
        // For efficiency in a transaction, we assume we fetch limited docs or user passes IDs.
        // Here, we'll error if IDs aren't passed for safety, OR implementing a query read:
        const pkgQuery = await packagesRef
          .orderBy("sequence", "desc")
          .limit(itemsToSplit)
          .get();
        packagesToMove = pkgQuery.docs;
      } else if (Array.isArray(itemsToSplit)) {
        // Option B: Split by specific IDs
        const pkgSnaps = await Promise.all(
          itemsToSplit.map((id) => tx.get(packagesRef.doc(id))),
        );
        packagesToMove = pkgSnaps;
      }

      if (packagesToMove.length === 0) {
        throw new HttpsError("invalid-argument", "No packages found to split");
      }

      if (packagesToMove.length >= originData.totals.totalItems) {
        throw new HttpsError(
          "invalid-argument",
          "Cannot split all items (just rename the shipment instead)",
        );
      }

      // 3. Create New Shipment (The "Child")
      // Generate ID similar to your create function
      const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
      const newShipmentId = `${originalShipmentId}-SPLIT-${Date.now()
        .toString()
        .slice(-4)}`;
      const newShipmentRef = db.collection("shipments").doc(newShipmentId);

      // Copy generic fields
      const newShipmentData = {
        ...originData,
        trackingNumber: newShipmentId,

        // Reset Status
        status: "RECEIVED", // Starts fresh in warehouse
        statusHistory: [
          {
            status: "RECEIVED",
            at: admin.firestore.FieldValue.serverTimestamp(),
          },
        ],
        currentTruckTripId: null,
        assignedToTruckTripAt: null,

        // Update Totals
        totals: {
          ...originData.totals,
          totalItems: packagesToMove.length,
          received: packagesToMove.length,
          loaded: 0, // Reset loaded count
          pending: 0,
        },

        // Linkage
        parentShipmentId: originalShipmentId,
        splitFromAt: admin.firestore.FieldValue.serverTimestamp(),
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      };

      // Remove undefined/derived fields if necessary
      delete newShipmentData.items;

      tx.set(newShipmentRef, newShipmentData);

      // 4. Move Packages (Delete Old -> Create New)
      // Firestore cannot "move" docs, we must re-create them in the new subcollection.
      for (const pkgDoc of packagesToMove) {
        const pkgData = pkgDoc.data();
        const newPkgRef = newShipmentRef.collection("packages").doc(pkgDoc.id);

        // Update package data for new home
        const newPkgData = {
          ...pkgData,
          shipmentId: newShipmentId,
          trackingNumber: `${newShipmentId}-${pkgData.sequence}`, // Optional: Rename tracking #
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        };

        tx.set(newPkgRef, newPkgData); // Create in new parent
        tx.delete(pkgDoc.ref); // Delete from old parent
      }

      // 5. Update Original Shipment Totals
      const remainingCount =
        originData.totals.totalItems - packagesToMove.length;
      tx.update(originRef, {
        "totals.totalItems": remainingCount,
        "totals.received": remainingCount, // Assuming all were received
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // 6. Log Events
      tx.set(originRef.collection("status_events").doc(), {
        type: "SPLIT_ORDER",
        message: `Split ${packagesToMove.length} items to new shipment ${newShipmentId}`,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        createdBy: uid,
      });

      tx.set(db.collection("admin_logs").doc(), {
        action: "SPLIT_SHIPMENT",
        originalShipmentId,
        newShipmentId,
        itemCount: packagesToMove.length,
        actorId: uid,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    });

    return { success: true, newShipmentId };
  },
);
