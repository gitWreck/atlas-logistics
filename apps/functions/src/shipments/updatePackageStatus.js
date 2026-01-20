const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const { requireRole } = require("../utilities/helpers");

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

exports.updatePackageStatus = onCall(async (req) => {
  // 1. Auth Guard
  await requireRole(db, req, ["admin", "manager", "checker"]);

  const { shipmentId, truckTripId, packageBarcodes, action } = req.data;
  // packageBarcodes: ["TRK-001", "TRK-003"] (List of IDs to modify)
  // action: "LOAD" or "UNLOAD"

  if (!shipmentId || !packageBarcodes || !action) {
    throw new HttpsError("invalid-argument", "Missing data");
  }

  const shipmentRef = db.collection("shipments").doc(shipmentId);

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(shipmentRef);
    if (!snap.exists) throw new HttpsError("not-found", "Shipment not found");

    const data = snap.data();
    const pkgArray = data.packages || [];
    const targetSet = new Set(packageBarcodes);

    let updatedCount = 0;

    // 2. Modify the Array
    const newPkgArray = pkgArray.map((pkg) => {
      // Only modify items in the list
      if (targetSet.has(pkg.trackingNumber)) {
        updatedCount++;
        if (action === "LOAD") {
          return {
            ...pkg,
            status: "LOADED",
            loadedAt: new Date().toISOString(),
            loadedOnTrip: truckTripId,
          };
        } else {
          // UNLOAD
          return {
            ...pkg,
            status: "RECEIVED", // Revert to received
            loadedAt: null,
            loadedOnTrip: null,
          };
        }
      }
      return pkg;
    });

    // 3. Recalculate Totals
    const loadedCount = newPkgArray.filter((p) => p.status === "LOADED").length;
    const totalCount = newPkgArray.length;

    let newStatus = "RECEIVED";
    if (loadedCount === totalCount) newStatus = "LOADED";
    else if (loadedCount > 0) newStatus = "PARTIALLY_LOADED";

    // 4. Save
    tx.update(shipmentRef, {
      packages: newPkgArray,
      status: newStatus,
      loadedCount: loadedCount,
      "totals.loaded": loadedCount,
      "totals.pending": totalCount - loadedCount,
      lastUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  });

  return { success: true };
});
