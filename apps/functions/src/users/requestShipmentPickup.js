const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const { sendShipmentPickup } = require("../messaging/sendShipmentPickup");
const {
  SEMAPHORE_API_KEY,
  SEMAPHORE_SENDER_NAME,
} = require("../../shared/sms-service");
const { Timestamp } = admin.firestore;

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

exports.requestShipmentPickup = onCall(
  {
    region: "asia-southeast1",
    secrets: [SEMAPHORE_API_KEY, SEMAPHORE_SENDER_NAME],
    maxInstances: 10,
  },
  async (request) => {
    // 1. AUTH & VALIDATION
    if (!request.auth) {
      throw new HttpsError(
        "unauthenticated",
        "Login required to request pickup.",
      );
    }

    const {
      sender,
      recipient,
      items,
      remarks,
      notifySms = true, // Default to true for customer peace of mind
    } = request.data || {};

    if (!sender || !recipient) {
      throw new HttpsError(
        "invalid-argument",
        "Missing sender or recipient details.",
      );
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      throw new HttpsError(
        "invalid-argument",
        "Items array is empty or invalid.",
      );
    }

    if (items.length > 200) {
      throw new HttpsError(
        "invalid-argument",
        "Too many items. Max 200 per request.",
      );
    }

    // 2. STATUS & CODES (Hardcoded for Customer Pickup Requests)
    const initialStatus = "PENDING_PICKUP";
    const initialNote = "Requested for Pickup by Customer";

    const originCity = sender.city || sender.details?.city || "Unknown";
    const destCity = recipient.city || recipient.details?.city || "Unknown";
    const originSummary = `${originCity}, ${sender.province || sender.details?.province || ""}`;

    // Default to GEN since customers don't know routing codes
    const finalOriginCode = "GEN";
    const finalDestCode = "GEN";

    // 3. ID GENERATION
    const timestamp = new Date();
    const dateStr = timestamp.toISOString().slice(0, 10).replace(/-/g, "");
    const shipmentId = `AT-${dateStr}-PKUP-${Date.now().toString().slice(-6)}`;

    const shipmentRef = db.collection("shipments").doc(shipmentId);

    // 4. COMBINED PACKAGING LOGIC (Standard vs Bundle)
    const packagesArray = [];
    const packageBarcodes = [];
    let globalSeq = 1;
    let totalContentQuantity = 0;

    items.forEach((item) => {
      const qty = Number(item.quantity || item.weight) || 1; // Fallback to weight if qty isn't passed
      const pkgType = item.packagingType || item.packaging || "Box";

      totalContentQuantity += qty;

      // Determine if this item should be bundled or split
      const isBundle = pkgType === "Sack" || pkgType === "Bundle";

      if (isBundle) {
        // BUNDLE LOGIC: 1 Physical Barcode, Internal Quantity = QTY
        const seqNum = globalSeq.toString().padStart(2, "0");
        const pkgId = `${shipmentId}-${seqNum}`;

        packagesArray.push({
          trackingNumber: pkgId,
          sequence: globalSeq,
          description: item.description || "Bundled Cargo",
          quantity: qty, // Stores internal piece count
          packagingType: pkgType,
          declaredValue: Number(item.declaredValue) || 0,
          isFragile: Boolean(item.isFragile),
          isPerishable: Boolean(item.isPerishable),
          status: initialStatus,
          currentLocation: originSummary,
          loadedOnTrip: null,
          isDelayed: false,
        });

        packageBarcodes.push(pkgId);
        globalSeq++;
      } else {
        // STANDARD LOGIC: 'QTY' Physical Barcodes, Internal Quantity = 1 per box
        for (let i = 0; i < qty; i++) {
          const seqNum = globalSeq.toString().padStart(2, "0");
          const pkgId = `${shipmentId}-${seqNum}`;

          packagesArray.push({
            trackingNumber: pkgId,
            sequence: globalSeq,
            description: item.description || "Standard Package",
            quantity: 1, // 1 unit per physical box
            packagingType: pkgType,
            declaredValue: (Number(item.declaredValue) || 0) / qty, // Split value evenly
            isFragile: Boolean(item.isFragile),
            isPerishable: Boolean(item.isPerishable),
            status: initialStatus,
            currentLocation: originSummary,
            loadedOnTrip: null,
            isDelayed: false,
          });

          packageBarcodes.push(pkgId);
          globalSeq++;
        }
      }
    });

    const now = Timestamp.now();
    const nowAt = admin.firestore.FieldValue.serverTimestamp();
    const batch = db.batch();

    // 5. CREATE SHIPMENT (Parent Document)
    batch.set(shipmentRef, {
      trackingNumber: shipmentId,
      currentTruckTripId: null,

      sender: {
        name: sender.name,
        phone: sender.phone,
        address: sender,
        formattedAddress:
          `${sender.unit || ""} ${sender.street || ""}, ${sender.barangay || ""}, ${originCity}, ${sender.province || ""}`.trim(),
      },
      recipient: {
        name: recipient.name,
        phone: recipient.phone,
        address: recipient,
        formattedAddress:
          `${recipient.unit || ""} ${recipient.street || ""}, ${recipient.barangay || ""}, ${destCity}, ${recipient.province || ""}`.trim(),
      },

      origin: originCity,
      originCode: finalOriginCode,
      destination: destCity,
      destinationCode: finalDestCode,

      createdAt: nowAt,
      updatedAt: nowAt,
      createdBy: request.auth.uid, // The customer's UID

      status: initialStatus,
      statusHistory: [
        {
          status: initialStatus,
          at: now,
          note: initialNote,
          location: originSummary,
        },
      ],

      public: true,
      archived: false,
      isPickupRequested: true, // Flag specifically for operations dashboard

      // AGGREGATES
      totals: {
        totalItems: packagesArray.length, // Total physical barcodes to scan
        totalContentQty: totalContentQuantity, // Total items inside
        received: 0,
        pending: packagesArray.length,
        loaded: 0,
        delivered: 0,
      },

      remarks: remarks || null,
      packages: packagesArray,
      packageBarcodes: packageBarcodes,
    });

    // 6. AUTO-TRACK FOR CUSTOMER
    // Automatically link this shipment to the customer's tracked list so it shows up on their dashboard immediately
    const userTrackingRef = db
      .collection("users")
      .doc(request.auth.uid)
      .collection("tracked_shipments")
      .doc(shipmentId);
    batch.set(userTrackingRef, {
      trackingNumber: shipmentId,
      addedAt: nowAt,
    });

    // 7. AUDIT LOGGING
    batch.set(db.collection("admin_logs").doc(), {
      action: "CUSTOMER_REQUESTED_PICKUP",
      trackingDocId: shipmentRef.id,
      trackingNumber: shipmentId,
      totalUnits: packagesArray.length,
      actorId: request.auth.uid,
      createdAt: nowAt,
    });

    // 8. COMMIT & NOTIFY
    try {
      await batch.commit();

      if (notifySms) {
        sendShipmentPickup({
          shipmentId,
          senderPhone: sender.phone,
          recipientPhone: recipient.phone,
          actorUid: request.auth.uid,
        }).catch((err) => console.error("[SMS_ERROR]", err));
      }

      return { success: true, shipmentId, packageBarcodes };
    } catch (error) {
      console.error("Transaction failure:", error);
      throw new HttpsError("internal", "Failed to submit pickup request.");
    }
  },
);
