const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const { FieldValue } = require("firebase-admin/firestore");

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

exports.finalizeHubProcessing = onCall(
  { region: "asia-southeast1", maxInstances: 10 },
  async (req) => {
    // 1. AUTH CHECK
    if (!req.auth) {
      throw new HttpsError("unauthenticated", "User must be logged in.");
    }
    const uid = req.auth.uid;

    const { tripId, remarks } = req.data;
    if (!tripId) throw new HttpsError("invalid-argument", "Missing tripId");

    // 2. GET TRIP DATA
    const tripRef = db.collection("truck_trips").doc(tripId);
    const tripSnap = await tripRef.get();

    if (!tripSnap.exists) {
      throw new HttpsError("not-found", "Trip not found");
    }

    const trip = tripSnap.data();
    const currentStatus = trip.status || "CREATED";

    // 3. DYNAMIC WORKFLOW ROUTING (Inbound vs Outbound)
    const isInbound = currentStatus === "IN_TRANSIT";
    const newStatus = isInbound ? "ARRIVED" : "LOADED";
    const timestampField = isInbound ? "arrivedAt" : "loadedAt";
    const actionName = isInbound ? "FINISH_RECEIVING" : "FINISH_LOADING";
    const processedCount = isInbound
      ? trip.totalArrived || 0
      : trip.totalLoaded || 0;
    const actionVerb = isInbound ? "receive" : "load";

    // 4. VALIDATION
    // Prevent processing an empty truck
    if (processedCount <= 0) {
      throw new HttpsError(
        "failed-precondition",
        `Cannot ${actionVerb} an empty truck. Scan items first.`,
      );
    }

    // Prevent updating if already finished
    if (
      currentStatus === "LOADED" ||
      currentStatus === "ARRIVED" ||
      currentStatus === "COMPLETED"
    ) {
      throw new HttpsError(
        "failed-precondition",
        `Trip is already marked as ${currentStatus}.`,
      );
    }

    // 5. PREPARE BATCH
    const batch = db.batch();

    // A. Update Trip Status Dynamically
    batch.update(tripRef, {
      status: newStatus,
      [timestampField]: FieldValue.serverTimestamp(), // Dynamically sets arrivedAt OR sealedAt
      processedBy: uid, // Generic field for who completed this step
      remarks: remarks || null,
      updatedAt: FieldValue.serverTimestamp(),
    });

    // B. AUDIT LOG
    const auditRef = db.collection("audit_logs").doc();
    batch.set(auditRef, {
      action: actionName,
      targetCollection: "truck_trips",
      targetId: tripId,
      actorId: uid,
      details: {
        tripNumber: trip.tripId || tripId,
        plateNumber: trip.truckPlateNumber || trip.plateNumber || "N/A",
        finalProcessedCount: processedCount,
        totalExpected: trip.totalItems || 0,
        previousStatus: currentStatus,
        newStatus: newStatus,
        remarks: remarks || "No remarks provided",
      },
      timestamp: FieldValue.serverTimestamp(),
    });

    // 6. COMMIT
    await batch.commit();

    return {
      success: true,
      message: isInbound
        ? `Truck received with ${processedCount} items.`
        : `Truck loaded with ${processedCount} items. Ready for driver.`,
      newStatus: newStatus,
    };
  },
);
