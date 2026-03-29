const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

exports.updateShipmentDetails = onCall(
  { region: "asia-southeast1", maxInstances: 10 },
  async (request) => {
    // 1. Auth Check
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Login required.");
    }

    const {
      shipmentId,
      sender,
      recipient,
      origin,
      originCode,
      destination,
      destinationCode,
      status,
      currentLocation,
      proofOfReceipt,
    } = request.data || {};

    if (!shipmentId) {
      throw new HttpsError("invalid-argument", "Shipment ID is required.");
    }

    const shipmentRef = db.collection("shipments").doc(shipmentId);
    const nowAt = admin.firestore.FieldValue.serverTimestamp();

    // 2. Construct the Update Payload
    const updatePayload = {
      "sender.name": sender.name,
      "sender.phone": sender.phone,
      "sender.address": sender.details,
      "recipient.name": recipient.name,
      "recipient.phone": recipient.phone,
      "recipient.address": recipient.details,
      origin: origin,
      originCode: originCode,
      destination: destination,
      destinationCode: destinationCode,
      status: status,
      currentLocation: currentLocation,
      updatedAt: nowAt,
      updatedBy: request.auth.uid,
    };

    // Only update images if new ones were provided
    if (proofOfReceipt && proofOfReceipt.length > 0) {
      updatePayload.proofOfReceipt = proofOfReceipt;
    }

    try {
      const batch = db.batch();

      // Update the main document
      batch.update(shipmentRef, updatePayload);

      // Write an Audit Log
      batch.set(db.collection("admin_logs").doc(), {
        action: "UPDATE_SHIPMENT",
        trackingDocId: shipmentId,
        actorId: request.auth.uid,
        createdAt: nowAt,
      });

      await batch.commit();

      return { success: true, shipmentId };
    } catch (error) {
      console.error("Update failed:", error);
      throw new HttpsError("internal", "Failed to update shipment.");
    }
  },
);
