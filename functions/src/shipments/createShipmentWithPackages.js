const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const { shortCode } = require("../utilities/helpers");
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

    const { sender, recipient, origin, destination, items, remarks } =
      request.data;

    // --- VALIDATION ---
    if (!origin || typeof origin !== "string") {
      throw new HttpsError("invalid-argument", "Missing or invalid 'origin'.");
    }
    if (!destination || typeof destination !== "string") {
      throw new HttpsError(
        "invalid-argument",
        "Missing or invalid 'destination'.",
      );
    }
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
    const originCode = shortCode(origin.toUpperCase());
    const destinationCode = shortCode(destination.toUpperCase());

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
        weight: Number(item.weight) || 0,
        description: item.description || "Standard Box",

        status: "RECEIVED", // Initial Status

        // Tracking location
        currentLocation: origin,
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

      sender,
      recipient,
      origin,
      originCode,
      destination,
      destinationCode,

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
        delivered: 0,
        loaded: 0, // Starts at 0
        received: items.length, // Starts fully received
        pending: items.length, // All items pending loading
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
      origin,
      destination,
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
