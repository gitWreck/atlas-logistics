const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const {
  sendShipmentCreatedSmsLogic,
} = require("../messaging/sendShipmentCreatedSmsLogic");
const {
  SEMAPHORE_API_KEY,
  SEMAPHORE_SENDER_NAME,
} = require("../../shared/sms-service");
// const { shortCode } = require("../utilities/helpers");
const { Timestamp } = admin.firestore;

if (!admin.apps.length) {
  admin.initializeApp();
}

exports.createShipmentWithPackages = onCall(
  {
    region: "asia-southeast1",
    secrets: [SEMAPHORE_API_KEY, SEMAPHORE_SENDER_NAME],
    maxInstances: 10,
  },
  async (request) => {
    // 1. Auth Check
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Login required.");
    }

    const {
      sender,
      recipient,
      origin,
      destination,
      originCode,
      destinationCode,
      items,
      remarks,
      location, // Optional { lat, lng } for initial status location
      notifySms,
      manualShipmentId,
      proofOfReceipt = [],

      status,
      currentLocation = null,
    } = request.data || {};

    // 2. DEFINE THE STARTING STATUS BASED ON WORKFLOW
    const initialStatus = status === "PENDING_PICKUP" ? status : "RECEIVED";
    const initialNote =
      status === "PENDING_PICKUP"
        ? "Scheduled for Pickup"
        : "Dropped off at Hub";

    // --- VALIDATION ---
    if (!origin || !destination) {
      throw new HttpsError(
        "invalid-argument",
        "Missing origin or destination.",
      );
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      throw new HttpsError(
        "invalid-argument",
        "Items array is empty or invalid.",
      );
    }

    const originSummary = `${sender.details.city}, ${sender.details.province}`;
    const destinationSummary = `${recipient.details.city}, ${recipient.details.province}`;

    // Fallback: If frontend didn't send codes (legacy calls), default to 'GEN' (General)
    // Provide a fallback for destination if it's a pickup
    const finalDest = destination || "TBD";
    const finalOriginCode = originCode || "GEN";
    const finalDestCode = destinationCode || "GEN";

    if (!items || !Array.isArray(items) || items.length === 0) {
      throw new HttpsError(
        "invalid-argument",
        "Items array is empty or invalid.",
      );
    }

    // Safety Limit: Arrays work great up to ~500-1000 items.
    // 200 is extremely safe (document size will be small).
    if (items.length > 200) {
      throw new HttpsError(
        "invalid-argument",
        "Too many items. Max 200 per shipment.",
      );
    }

    const db = admin.firestore();
    const batch = db.batch();

    // 2. Generate IDs
    const timestamp = new Date();
    let shipmentId = manualShipmentId;

    // Example: AT-20231027-MNL-CEB-123456
    if (!shipmentId) {
      const dateStr = timestamp.toISOString().slice(0, 10).replace(/-/g, "");
      // shipmentId = `AT-${dateStr}-${originCode}-${destinationCode}-${Date.now().toString().slice(-6)}`;
      shipmentId = `AT-${dateStr}-SHP-${Date.now().toString().slice(-6)}`;
    }

    const doc = await db.collection("shipments").doc(shipmentId).get();
    if (doc.exists) {
      throw new HttpsError(
        "already-exists",
        "Shipment ID collision. Try again.",
      );
    }

    const shipmentRef = db.collection("shipments").doc(shipmentId);

    const now = Timestamp.now();
    const nowAt = admin.firestore.FieldValue.serverTimestamp();

    const packagesArray = [];
    const packageBarcodes = []; // Helper for fast scanning

    // 3. Construct the Packages Array (In Memory)
    let globalSeq = 1; // Track total package count

    items.forEach((item) => {
      const qty = Number(item.quantity) || 1; // Use quantity instead of weight

      for (let i = 0; i < qty; i++) {
        const seqNum = globalSeq.toString().padStart(2, "0");
        const pkgId = `${shipmentId}-${seqNum}`; // unique barcode per unit

        const pkgObj = {
          trackingNumber: pkgId,
          sequence: globalSeq,
          description: item.description || "Standard Package",
          quantity: 1, // Each individual package represents 1 unit
          packagingType: item.packagingType || "Box",
          declaredValue: (Number(item.declaredValue) || 0) / qty, // Optional: split value per box
          isFragile: Boolean(item.isFragile),
          isPerishable: Boolean(item.isPerishable),

          // --- CHANGED FIELDS ---
          status: initialStatus,
          currentLocation: currentLocation || originSummary,

          loadedOnTrip: null,
          loadedAt: null,
          isDelayed: false,
        };

        packagesArray.push(pkgObj);
        packageBarcodes.push(pkgId);
        globalSeq++; // Increment for the next package
      }
    });

    // 4. Create Shipment (Parent Document)
    batch.set(shipmentRef, {
      trackingNumber: shipmentId,
      currentTruckTripId: null,

      sender: {
        name: sender.name,
        phone: sender.phone,
        // Explicit Address Details (Map)
        address: {
          unit: sender.details.unit || "",
          street: sender.details.street || "",
          barangay: sender.details.barangay || "",
          city: sender.details.city,
          province: sender.details.province,
        },
        // Helper string for printing labels easily
        formattedAddress: `${sender.details.unit} ${sender.details.street}, ${sender.details.barangay}, ${sender.details.city}, ${sender.details.province}`,
      },

      recipient: {
        name: recipient.name,
        phone: recipient.phone,
        // Explicit Address Details (Map)
        address: {
          unit: recipient.details.unit || "",
          street: recipient.details.street || "",
          barangay: recipient.details.barangay || "",
          city: recipient.details.city,
          province: recipient.details.province,
        },
        formattedAddress: `${recipient.details.unit} ${recipient.details.street}, ${recipient.details.barangay}, ${recipient.details.city}, ${recipient.details.province}`,
      },

      origin: sender.details.city,
      originCode: finalOriginCode, // Save the code explicitly

      destination: recipient.details.city,
      destinationCode: finalDestCode,

      createdAt: nowAt,
      createdBy: request.auth.uid,
      updatedAt: nowAt,
      updatedBy: request.auth.uid,

      status: initialStatus,
      statusHistory: [
        {
          status: initialStatus,
          at: now,
          note: initialNote,
          location: location || null,
        },
      ],

      // Latest known geo location for this shipment (if provided)
      ...(location ? { lastLocation: location } : {}),

      public: true,
      archived: false,

      // AGGREGATES
      totals: {
        totalItems: packagesArray.length, // Total physical boxes
        received: packagesArray.length,
        pending: packagesArray.length,

        loaded: 0, // Starts at 0
        delivered: 0,
      },

      remarks: remarks || null,
      proofOfReceipt: proofOfReceipt,

      // We store the data here instead of subcollections
      packages: packagesArray,
      packageBarcodes: packageBarcodes,
    });

    // 5. Logs (Audit Trail)
    batch.set(db.collection("admin_logs").doc(), {
      action: "CREATE_SHIPMENT",
      trackingDocId: shipmentRef.id,
      trackingNumber: shipmentId,
      totalItems: packagesArray.length, // Log the actual box count
      originCode: finalOriginCode,
      destinationCode: finalDestCode,
      actorId: request.auth.uid,
      createdAt: nowAt,
    });

    // 6. Commit
    try {
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
          }).catch((err) =>
            console.error("[SMS_ERROR] Initial notification failed:", err),
          );
        }

        return {
          success: true,
          shipmentId,
          packageBarcodes,
        };
      } catch (error) {
        console.error("[Notify] Failed to queue SMS:", err);
      }
    } catch (error) {
      console.error("Transaction failure:", error);
      throw new HttpsError("internal", "Failed to create shipment records.");
    }
  },
);
