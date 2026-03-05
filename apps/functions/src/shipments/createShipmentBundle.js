const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const {
  sendShipmentCreatedSmsLogic,
} = require("../messaging/sendShipmentCreatedSmsLogic");
const {
  SEMAPHORE_API_KEY,
  SEMAPHORE_SENDER_NAME,
} = require("../../shared/sms-service");
const { Timestamp } = admin.firestore;

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

exports.createShipmentBundle = onCall(
  {
    region: "asia-southeast1",
    secrets: [SEMAPHORE_API_KEY, SEMAPHORE_SENDER_NAME],
    maxInstances: 10,
  },
  async (request) => {
    // 1. AUTH & DATA EXTRACTION
    if (!request.auth)
      throw new HttpsError("unauthenticated", "Login required.");

    const {
      sender,
      recipient,
      origin,
      destination,
      originCode,
      destinationCode,
      items,
      remarks,
      location,
      notifySms,
      manualShipmentId,
      proofOfReceipt = [],
      status,
      currentLocation = null,
    } = request.data || {};

    // 2. DEFINE INITIAL STATUS
    const initialStatus = status === "PENDING_PICKUP" ? status : "RECEIVED";
    const initialNote =
      status === "PENDING_PICKUP"
        ? "Scheduled for Pickup"
        : "Dropped off at Hub";

    // 3. VALIDATION
    if (!origin || !destination)
      throw new HttpsError(
        "invalid-argument",
        "Missing origin or destination.",
      );
    if (!items || !Array.isArray(items) || items.length === 0)
      throw new HttpsError("invalid-argument", "Items array is invalid.");

    const originSummary = `${sender.details.city}, ${sender.details.province}`;
    const finalOriginCode = originCode || "GEN";
    const finalDestCode = destinationCode || "GEN";

    // 4. ID GENERATION
    const timestamp = new Date();
    let shipmentId = manualShipmentId;
    if (!shipmentId) {
      const dateStr = timestamp.toISOString().slice(0, 10).replace(/-/g, "");
      shipmentId = `AT-${dateStr}-${finalOriginCode}-${finalDestCode}-${Date.now().toString().slice(-6)}`;
    }

    // Check for ID Collision
    const existingDoc = await db.collection("shipments").doc(shipmentId).get();
    if (existingDoc.exists)
      throw new HttpsError("already-exists", "ID collision. Try again.");

    // 5. CONSTRUCT BUNDLED PACKAGES
    const packagesArray = [];
    const packageBarcodes = [];
    let totalContentQuantity = 0;

    // Use a single loop: 1 line item = 1 package object
    items.forEach((item, index) => {
      const seqNum = (index + 1).toString().padStart(2, "0");
      const pkgId = `${shipmentId}-${seqNum}`;
      const qtyInside = Number(item.quantity) || 1;

      totalContentQuantity += qtyInside;

      packagesArray.push({
        trackingNumber: pkgId,
        sequence: index + 1,
        description: item.description || "Bundled Cargo",
        quantity: qtyInside, // ✅ This stores the internal piece count
        packagingType: item.packagingType || "Sack",
        declaredValue: Number(item.declaredValue) || 0,
        isFragile: Boolean(item.isFragile),
        isPerishable: Boolean(item.isPerishable),
        status: initialStatus,
        currentLocation: currentLocation || originSummary,
        loadedOnTrip: null,
        loadedAt: null,
        isDelayed: false,
        updatedAt: new Date().toISOString(),
        updatedBy: request.auth.uid,
      });

      packageBarcodes.push(pkgId);
    });

    const shipmentRef = db.collection("shipments").doc(shipmentId);
    const now = Timestamp.now();
    const nowAt = admin.firestore.FieldValue.serverTimestamp();
    const batch = db.batch();

    // 6. CREATE SHIPMENT (Parent Document)
    batch.set(shipmentRef, {
      trackingNumber: shipmentId,
      currentTruckTripId: null,
      sender: {
        name: sender.name,
        phone: sender.phone,
        address: sender.details,
        formattedAddress: `${sender.details.unit || ""} ${sender.details.street}, ${sender.details.barangay}, ${sender.details.city}, ${sender.details.province}`,
      },
      recipient: {
        name: recipient.name,
        phone: recipient.phone,
        address: recipient.details,
        formattedAddress: `${recipient.details.unit || ""} ${recipient.details.street}, ${recipient.details.barangay}, ${recipient.details.city}, ${recipient.details.province}`,
      },
      origin: sender.details.city,
      originCode: finalOriginCode,
      destination: recipient.details.city,
      destinationCode: finalDestCode,
      createdAt: nowAt,
      updatedAt: nowAt,
      createdBy: request.auth.uid,
      status: initialStatus,
      statusHistory: [
        {
          status: initialStatus,
          at: now,
          note: initialNote,
          location: location || null,
        },
      ],
      ...(location ? { lastLocation: location } : {}),
      public: true,
      archived: false,

      // AGGREGATES
      totals: {
        totalItems: packagesArray.length, // Total physical Sacks/Units to scan
        totalContentQty: totalContentQuantity, // Total items inside the sacks
        received: packagesArray.length,
        pending: packagesArray.length,
        loaded: 0,
        delivered: 0,
      },

      remarks: remarks || null,
      proofOfReceipt: proofOfReceipt,
      packages: packagesArray,
      packageBarcodes: packageBarcodes,
    });

    // 7. AUDIT LOGGING
    batch.set(db.collection("admin_logs").doc(), {
      action: "CREATE_SHIPMENT_BUNDLE",
      trackingDocId: shipmentRef.id,
      trackingNumber: shipmentId,
      totalUnits: packagesArray.length,
      actorId: request.auth.uid,
      createdAt: nowAt,
    });

    // 8. COMMIT & NOTIFY
    try {
      await batch.commit();

      if (notifySms === true) {
        sendShipmentCreatedSmsLogic({
          shipmentId,
          senderPhone: sender.phone,
          recipientPhone: recipient.phone,
          origin: origin,
          destination: destination,
          actorUid: request.auth.uid,
        }).catch((err) => console.error("[SMS_ERROR]", err));
      }

      return { success: true, shipmentId, packageBarcodes };
    } catch (error) {
      console.error("Transaction failure:", error);
      throw new HttpsError("internal", "Failed to create bundled shipment.");
    }
  },
);
