const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const { writeShipmentActionLog } = require("../utilities/shipmentLogger");
const { updatedBy } = require("../utilities/helpers");
const {
  buildDerivedShipmentSnapshot,
  MASTER_STATUSES_SKIP_PACKAGE_DERIVE,
} = require("../packages/shipmentStatus");
const {
  assertCustodyStructuralEditAllowed,
  loadTripForShipment,
} = require("../trips/manifestLockGuard");

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
      currentLocation,
      proofOfReceipt,
    } = request.data || {};

    if (!shipmentId) {
      throw new HttpsError("invalid-argument", "Shipment ID is required.");
    }

    const { uid, role, name } = updatedBy(request);

    const shipmentRef = db.collection("shipments").doc(shipmentId);
    const nowAt = admin.firestore.FieldValue.serverTimestamp();

    const shipmentSnap = await shipmentRef.get();
    if (!shipmentSnap.exists) {
      throw new HttpsError("not-found", "Shipment not found.");
    }

    const shipmentData = shipmentSnap.data() || {};
    const { trip } = await loadTripForShipment(null, db, { shipment: shipmentData });
    assertCustodyStructuralEditAllowed(shipmentData, trip);

    const packages = Array.isArray(shipmentData.packages) ? shipmentData.packages : [];
    const derivedSnapshot = buildDerivedShipmentSnapshot(packages, {
      previousStatus: shipmentData.status,
    });

    const preserveCurrentStatus = MASTER_STATUSES_SKIP_PACKAGE_DERIVE.has(
      String(shipmentData.status || "").trim(),
    );
    const resolvedStatus = preserveCurrentStatus
      ? shipmentData.status
      : derivedSnapshot.status;

    // 2. Construct the Update Payload (master status always from packages when allowed)
    const updatePayload = {
      "sender.name": sender.name,
      "sender.phone": sender.phone,
      "sender.address": sender.address,
      "recipient.name": recipient.name,
      "recipient.phone": recipient.phone,
      "recipient.secondaryPhone":
        recipient.secondaryPhone || recipient.altPhone || null,
      "recipient.address": recipient.address,
      origin: origin,
      originCode: originCode,
      destination: destination,
      destinationCode: destinationCode,
      status: resolvedStatus,
      packages: derivedSnapshot.packages,
      packageBreakdown: derivedSnapshot.packageBreakdown,
      availableForDelivery: derivedSnapshot.availableForDelivery,
      currentLocation: currentLocation,
      updatedAt: nowAt,
      updatedBy: name,
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
      writeShipmentActionLog({
        db,
        batch,
        action: "UPDATE_SHIPMENT",
        trackingShipmentId: shipmentId,
        shipmentId,
        actorId: uid,
        actorName: name,
        actorRole: role,
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
