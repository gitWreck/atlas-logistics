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
      originCode, // NEW
      destinationCode, // NEW
      items,
      remarks,
      location, // Optional { lat, lng } for initial status location
      notifySms,
      manualShipmentId,
      proofOfReceipt = [],
    } = request.data || {};

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
      // ... your old ID generation logic as backup ...
      //  const dateStr = ...
      //  shipmentId = `AT-...`;
      const dateStr = timestamp.toISOString().slice(0, 10).replace(/-/g, "");
      shipmentId = `AT-${dateStr}-${originCode}-${destinationCode}-${Date.now().toString().slice(-6)}`;
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

    // 3. Construct the Packages Array (In Memory)
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
          status: "RECEIVED",
          currentLocation: originSummary,
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

      status: "RECEIVED",
      statusHistory: [
        {
          status: "RECEIVED",
          at: now,
          note: "Shipment Created",
          location: location || null,
        },
      ],

      // Latest known geo location for this shipment (if provided)
      ...(location ? { lastLocation: location } : {}),

      public: true,
      archived: false,

      // AGGREGATES
      totals: {
        // totalItems: items.length,
        // received: items.length, // Starts fully received
        // pending: items.length, // All items pending loading
        totalItems: packagesArray.length, // Total physical boxes
        received: packagesArray.length,
        pending: packagesArray.length,

        loaded: 0, // Starts at 0
        delivered: 0,
      },

      remarks: remarks || null,
      proofOfReceipt: proofOfReceipt,

      // *** THE CRITICAL CHANGE ***
      // We store the data here instead of subcollections
      packages: packagesArray,
      packageBarcodes: packageBarcodes,
    });

    // 5. Logs (Audit Trail)
    batch.set(db.collection("admin_logs").doc(), {
      action: "CREATE_SHIPMENT",
      trackingDocId: shipmentRef.id,
      trackingNumber: shipmentId,
      // totalItems: items.length,
      totalItems: packagesArray.length, // Log the actual box count
      originCode: finalOriginCode,
      destinationCode: finalDestCode,
      actorId: request.auth.uid,
      createdAt: nowAt,
    });

    // 6. Commit
    try {
      // await batch.commit();

      // --- 6. Commit ---
      try {
        await batch.commit();

        // NEW: TRIGGER SMS NOTIFICATION
        if (notifySms === true) {
          // We don't 'await' this if we want to return to the UI faster,
          // but we catch errors to prevent crashing the response.
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
        // ... existing error handling
      }

      // return {
      //   success: true,
      //   shipmentId,
      //   // Return barcodes so UI can print labels immediately
      //   packageBarcodes,
      // };
    } catch (error) {
      console.error("Transaction failure:", error);
      throw new HttpsError("internal", "Failed to create shipment records.");
    }
  },
);
