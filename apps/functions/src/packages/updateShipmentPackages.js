const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const { FieldValue } = admin.firestore;
const { requireRole } = require("../utilities/helpers");

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

exports.updateShipmentPackages = onCall(
  { region: "asia-southeast1", maxInstances: 10 },
  async (req) => {
    // 1. AUTH & ROLE CHECK
    if (!req.auth) throw new HttpsError("unauthenticated", "Auth required.");
    // Note: requireRole needs to be imported or defined in your helpers
    await requireRole(db, req, ["admin", "manager", "checker"]);

    const uid = req.auth.uid;
    const { shipmentId, packageIds, newStatus, tripId, remarks, location } =
      req.data;

    if (!shipmentId || !packageIds || !newStatus) {
      throw new HttpsError("invalid-argument", "Missing required fields.");
    }

    const shipmentRef = db.collection("shipments").doc(shipmentId);
    const tripRef = tripId ? db.collection("truck_trips").doc(tripId) : null;

    // ✅ NEW: Reference to the specific shipment inside this trip
    const tripShipmentRef = tripRef
      ? tripRef.collection("trip_shipments").doc(shipmentId)
      : null;

    // 2. TRANSACTION
    await db.runTransaction(async (tx) => {
      const shipmentSnap = await tx.get(shipmentRef);
      if (!shipmentSnap.exists)
        throw new HttpsError("not-found", "Shipment not found.");

      const data = shipmentSnap.data();
      const packages = data.packages || [];

      // Initialize deltas for Trip-level counters
      let localDeltaLoaded = 0;
      let localDeltaArrived = 0;
      let localDeltaMissing = 0;

      // 3. UPDATE SPECIFIC PACKAGES
      const updatedPackages = packages.map((pkg) => {
        if (packageIds.includes(pkg.trackingNumber)) {
          const oldStatus = pkg.status;

          if (oldStatus !== newStatus) {
            // --- DECREMENT OLD COUNTERS ---
            if (oldStatus === "LOADED") localDeltaLoaded--;
            if (oldStatus === "RECEIVED") localDeltaArrived--;
            if (oldStatus === "MISSING") localDeltaMissing--;

            // --- INCREMENT NEW COUNTERS ---
            if (newStatus === "LOADED") localDeltaLoaded++;
            if (newStatus === "RECEIVED") localDeltaArrived++;
            if (newStatus === "MISSING") localDeltaMissing++;
          }

          return {
            ...pkg,
            status: newStatus,
            remarks: remarks || pkg.remarks || null, // Keep existing remarks if new ones aren't provided
            updatedAt: new Date().toISOString(),
            updatedBy: uid,
          };
        }
        return pkg;
      });

      // 4. CALCULATE NEW SHIPMENT STATUS & TOTALS
      const totalLoaded = updatedPackages.filter(
        (p) => p.status === "LOADED",
      ).length;
      const totalMissing = updatedPackages.filter(
        (p) => p.status === "MISSING",
      ).length;
      const totalItems = updatedPackages.length;

      let finalStatus = data.status;
      // Logical priority: If all items are loaded, status is LOADED.
      // If some items are loaded but others are missing/pending, it's PARTIALLY_LOADED.
      if (totalLoaded === totalItems) {
        finalStatus = "LOADED";
      } else if (totalLoaded + totalMissing === totalItems && totalLoaded > 0) {
        // All items accounted for, but some are missing
        finalStatus = "LOADED_WITH_EXCEPTIONS";
      } else if (totalLoaded > 0 || totalMissing > 0) {
        finalStatus = "PARTIALLY_PROCESSED";
      }

      // 5. WRITE UPDATES TO SHIPMENT
      tx.update(shipmentRef, {
        packages: updatedPackages,
        status: finalStatus,
        "totals.loaded": totalLoaded,
        "totals.missing": totalMissing, // ✅ Syncs with your Progress Bar
        updatedAt: FieldValue.serverTimestamp(),
        statusHistory: FieldValue.arrayUnion({
          status: `PKG_BULK_${newStatus}`,
          at: new Date(),
          by: uid,
          note:
            remarks || `${packageIds.length} packages marked as ${newStatus}.`,
          location: location || null,
        }),
      });

      // 6. ✅ NEW: UPDATE TRIP_SHIPMENT (The Manifest Entry)
      if (tripShipmentRef) {
        tx.update(tripShipmentRef, {
          status: finalStatus,
          loadedCount: totalLoaded,
          missingCount: totalMissing, // Ensure your schema supports this
          updatedAt: FieldValue.serverTimestamp(),
          updatedBy: uid,
        });
      }

      // 6. UPDATE TRIP COUNTERS (The Handshake)
      if (tripRef) {
        tx.update(tripRef, {
          totalLoaded: FieldValue.increment(localDeltaLoaded),
          totalArrived: FieldValue.increment(localDeltaArrived),
          totalMissing: FieldValue.increment(localDeltaMissing), // ✅ Keeps Truck Dashboard in sync
          updatedAt: FieldValue.serverTimestamp(),
        });
      }
    });

    return { success: true };
  },
);
