const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
// const { shortCode } = require("../utilities/helpers");
const { Timestamp } = admin.firestore;

if (!admin.apps.length) {
  admin.initializeApp();
}

exports.createShipmentWithPackages = onCall(
  { region: "asia-southeast1", maxInstances: 10 },
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
      routeInfo,
    } = request.data;

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
    const dateStr = timestamp.toISOString().slice(0, 10).replace(/-/g, "");

    // Example: AT-20231027-MNL-CEB-123456
    const shipmentId = `AT-${dateStr}-${originCode}-${destinationCode}-${Date.now().toString().slice(-6)}`;
    const shipmentRef = db.collection("shipments").doc(shipmentId);

    const now = Timestamp.now();
    const nowAt = admin.firestore.FieldValue.serverTimestamp();

    // 3. Construct the Packages Array (In Memory)
    const packagesArray = [];
    const packageBarcodes = []; // Helper for fast scanning

    items.forEach((item, index) => {
      const seqNum = (index + 1).toString().padStart(2, "0");
      const pkgId = `${shipmentId}-${seqNum}`; // e.g., AT-...-01

      // The Package Object
      const pkgObj = {
        trackingNumber: pkgId, // The Barcode
        sequence: index + 1,

        // Physical Props
        description: item.description || "Standard Package",
        weight: Number(item.weight) || 0,
        packagingType: item.packagingType || "Box", // NEW

        // Dimensions (Optional, save if present)
        length: item.length || "",
        width: item.width || "",
        height: item.height || "",

        // Liability & Handling (NEW)
        declaredValue: Number(item.declaredValue) || 0,
        isFragile: Boolean(item.isFragile),
        isPerishable: Boolean(item.isPerishable),

        status: "RECEIVED", // Initial Status

        // Tracking location
        currentLocation: originSummary,
        loadedOnTrip: null, // Will be filled when scanned onto truck
        loadedAt: null,

        // Denormalized info (Optional, can rely on parent, but good for reporting if extracted)
        isDelayed: false,
      };

      packagesArray.push(pkgObj);
      packageBarcodes.push(pkgId);
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
        { status: "RECEIVED", at: now, note: "Shipment Created" },
      ],

      public: false,
      archived: false,

      // AGGREGATES
      totals: {
        totalItems: items.length,
        received: items.length, // Starts fully received
        pending: items.length, // All items pending loading
        loaded: 0, // Starts at 0
        delivered: 0,
      },

      remarks: remarks || null,

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
      totalItems: items.length,
      originCode: finalOriginCode,
      destinationCode: finalDestCode,
      actorId: request.auth.uid,
      createdAt: nowAt,
    });

    // 6. Commit
    try {
      await batch.commit();
      return {
        success: true,
        shipmentId,
        // Return barcodes so UI can print labels immediately
        packageBarcodes,
      };
    } catch (error) {
      console.error("Transaction failure:", error);
      throw new HttpsError("internal", "Failed to create shipment records.");
    }
  },
);
