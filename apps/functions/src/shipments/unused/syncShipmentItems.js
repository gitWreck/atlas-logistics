const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const { assertAdminOrManager } = require("../../system/authGuards");

exports.syncShipmentItems = onCall(
  { region: "asia-southeast1" },
  async (request) => {
    await assertAdminOrManager(request);

    const { trackingId, truckTripId } = request.data || {};
    if (!trackingId || !truckTripId) {
      throw new HttpsError(
        "invalid-argument",
        "Missing trackingId or truckTripId",
      );
    }

    const db = admin.firestore();

    const shipmentRef = db.collection("tracking_records").doc(trackingId);
    const tripRef = db.collection("truck_trips").doc(truckTripId);

    await db.runTransaction(async (tx) => {
      const shipmentSnap = await tx.get(shipmentRef);
      const tripSnap = await tx.get(tripRef);

      if (!shipmentSnap.exists) {
        throw new HttpsError("not-found", "Shipment not found");
      }
      if (!tripSnap.exists) {
        throw new HttpsError("not-found", "Truck trip not found");
      }

      const shipment = shipmentSnap.data();
      const trip = tripSnap.data();

      const totalItems = shipment.totalItems ?? 0;
      const loadedItems = trip.loadedItems ?? 0;

      if (loadedItems > totalItems) {
        throw new HttpsError(
          "failed-precondition",
          "Loaded items cannot exceed total items",
        );
      }

      tx.update(shipmentRef, {
        loadedItems,
        pendingItems: totalItems - loadedItems,

        // 🔍 Optional but VERY useful
        receivedItems: totalItems,

        lastUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
        lastUpdatedBy: request.auth.uid,
        lastUpdatedRole: request.auth.token.role,
      });
    });

    return { success: true };
  },
);
