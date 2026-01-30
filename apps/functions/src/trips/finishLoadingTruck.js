const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const { FieldValue } = require("firebase-admin/firestore");

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

exports.finishLoadingTruck = onCall(
  { region: "asia-southeast1", maxInstances: 10 },
  async (req) => {
    // 1. AUTH CHECK
    if (!req.auth) {
      throw new HttpsError("unauthenticated", "User must be logged in.");
    }
    const uid = req.auth.uid;

    const { tripId } = req.data;
    if (!tripId) throw new HttpsError("invalid-argument", "Missing tripId");

    // 2. GET TRIP DATA
    const tripRef = db.collection("truck_trips").doc(tripId);
    const tripSnap = await tripRef.get();

    if (!tripSnap.exists) {
      throw new HttpsError("not-found", "Trip not found");
    }

    const trip = tripSnap.data();

    // 3. VALIDATION
    // Prevent sealing an empty truck
    if ((trip.totalLoaded || 0) <= 0) {
      throw new HttpsError(
        "failed-precondition",
        "Cannot seal an empty truck. Scan items first.",
      );
    }

    // Prevent sealing if already sealed or gone
    if (
      trip.status === "LOADED" ||
      trip.status === "IN_TRANSIT" ||
      trip.status === "COMPLETED"
    ) {
      throw new HttpsError(
        "failed-precondition",
        "Trip is already sealed or started.",
      );
    }

    // 4. PREPARE BATCH
    const batch = db.batch();

    // A. Update Trip Status
    batch.update(tripRef, {
      status: "LOADED",
      sealedAt: FieldValue.serverTimestamp(),
      sealedBy: uid,
      updatedAt: FieldValue.serverTimestamp(),
      // Note: We don't change 'loadedCount' here, that happens during scanning
    });

    // B. AUDIT LOG
    const auditRef = db.collection("audit_logs").doc();
    batch.set(auditRef, {
      action: "FINISH_LOADING", // or "SEAL_TRUCK"
      targetCollection: "truck_trips",
      targetId: tripId,
      actorId: uid,
      details: {
        tripNumber: trip.tripId || tripId,
        plateNumber: trip.plateNumber || "N/A",
        finalLoadCount: trip.totalLoaded,
        totalExpected: trip.totalItems,
        previousStatus: trip.status,
      },
      timestamp: FieldValue.serverTimestamp(),
    });

    // 5. COMMIT
    await batch.commit();

    return {
      success: true,
      message: `Truck sealed with ${trip.totalLoaded} items. Ready for driver.`,
    };
  },
);
