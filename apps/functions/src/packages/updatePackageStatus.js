const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const { FieldValue } = admin.firestore;
const { requireRole } = require("../utilities/helpers");
const { buildDerivedShipmentSnapshot } = require("./shipmentStatus");

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

exports.updatePackageStatus = onCall(
  { region: "asia-southeast1", maxInstances: 10 },
  async (req) => {
    await requireRole(db, req, ["admin", "manager", "checker"]);

    const uid = req.auth.uid;
    const {
      shipmentId,
      packageId, // The specific Tracking ID (e.g. AT-001)
      newStatus, // "LOADED", "RECEIVED", "MISSING"
      // tripId,
      manualQty, // For Sacks: how many pieces inside are being updated
      updateAll, // For Sacks: update the full quantity
      remarks,
    } = req.data;

    if (!shipmentId || !packageId || !newStatus) {
      throw new HttpsError("invalid-argument", "Missing required fields.");
    }

    const shipmentRef = db.collection("shipments").doc(shipmentId);

    await db.runTransaction(async (tx) => {
      const snap = await tx.get(shipmentRef);
      if (!snap.exists) throw new HttpsError("not-found", "Shipment not found");

      const data = snap.data();
      const pkgArray = data.packages || [];
      const currentTripId = data.currentTripId;

      // 1. Find the target package
      const pkgIndex = pkgArray.findIndex(
        (p) => p.packageId === packageId || p.trackingNumber === packageId,
      );
      if (pkgIndex === -1)
        throw new HttpsError("not-found", "Package not found");

      const targetPkg = pkgArray[pkgIndex];
      const maxQty = Number(targetPkg.quantity) || 1;

      // Calculate Delta (Difference in pieces)
      const oldLoadedQty = Number(targetPkg.loadedQty) || 0;
      const effectiveNewQty =
        newStatus === "LOADED"
          ? updateAll
            ? maxQty
            : Number(manualQty) || 0
          : 0;

      const pieceDelta = effectiveNewQty - oldLoadedQty;

      // 2. Update the Package Object
      pkgArray[pkgIndex] = {
        ...targetPkg,
        status:
          effectiveNewQty === maxQty && newStatus === "LOADED"
            ? "LOADED"
            : effectiveNewQty > 0
              ? "PARTIALLY_LOADED"
              : newStatus,
        loadedQty: effectiveNewQty,
        updatedAt: new Date().toISOString(),
        updatedBy: uid,
        remarks: remarks || targetPkg.remarks || null,
      };

      // 3. Recalculate Shipment-level Totals
      const totalPiecesInShipment = pkgArray.reduce(
        (acc, p) => acc + (Number(p.quantity) || 0),
        0,
      );
      const currentlyLoadedPieces = pkgArray.reduce(
        (acc, p) => acc + (Number(p.loadedQty) || 0),
        0,
      );

      const derivedSnapshot = buildDerivedShipmentSnapshot(pkgArray, {
        previousStatus: data.status,
        totals: {
          totalQty: totalPiecesInShipment,
          loadedQty: currentlyLoadedPieces,
          receivedQty: pkgArray.reduce(
            (acc, p) =>
              acc +
              (["DELIVERED", "COMPLETED"].includes(
                String(p.status || "").toUpperCase(),
              )
                ? Number(p.quantity) || 1
                : 0),
            0,
          ),
        },
      });

      // 4. Update the Shipment Document
      tx.update(shipmentRef, {
        packages: derivedSnapshot.packages,
        packageBreakdown: derivedSnapshot.packageBreakdown,
        status: derivedSnapshot.status,
        availableForDelivery: derivedSnapshot.availableForDelivery,
        "totals.loaded": currentlyLoadedPieces,
        updatedAt: FieldValue.serverTimestamp(),
      });

      // 5. THE HANDSHAKE: Update Trip and Truck
      if (currentTripId) {
        const tripRef = db.collection("truck_trips").doc(currentTripId);
        const tripShipmentRef = tripRef
          .collection("trip_shipments")
          .doc(shipmentId);

        // Update the Manifest Entry
        tx.update(tripShipmentRef, {
          status: derivedSnapshot.status,
          loadedCount: currentlyLoadedPieces,
          updatedAt: FieldValue.serverTimestamp(),
        });

        // Update the Truck Dashboard counters
        tx.update(tripRef, {
          totalLoaded: FieldValue.increment(pieceDelta), // Increments by pieces, not just 1 package
          updatedAt: FieldValue.serverTimestamp(),
        });
      }
    });
    return { success: true };
  },
);
