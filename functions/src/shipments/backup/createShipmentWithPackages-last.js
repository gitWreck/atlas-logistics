const { onCall, HttpsError } = require("firebase-functions/v2/https");
// const { Timestamp, FieldValue } = require("firebase-admin/firestore");
const admin = require("firebase-admin");
const { shortCode } = require("../../utilities/helpers");
const { Timestamp } = admin.firestore;
// const { updateDoc } = require("firebase/firestore");

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

    const db = admin.firestore();
    const batch = db.batch();

    // 2. Generate IDs
    const timestamp = new Date();
    const dateStr = timestamp.toISOString().slice(0, 10).replace(/-/g, "");
    const originCode = shortCode(origin.toUpperCase());
    const destinationCode = shortCode(destination.toUpperCase());
    const shipmentId = `AT-${dateStr}-${originCode}-${destinationCode}-${Date.now()
      .toString()
      .slice(-6)}`;

    const shipmentRef = db.collection("shipments").doc(shipmentId);
    const now = Timestamp.now();
    const nowAt = admin.firestore.FieldValue.serverTimestamp();

    // 3. Create Shipment (Parent)
    batch.set(shipmentRef, {
      trackingNumber: shipmentId,
      currentTruckTripId: null,
      assignedToTruckTripAt: null,

      sender,
      recipient,

      origin,
      originCode: originCode,

      destination,
      destinationCode: destinationCode,

      createdAt: nowAt,
      createdBy: request.auth.uid,

      updatedAt: nowAt,
      updatedBy: request.auth.uid,

      status: "RECEIVED",
      statusHistory: [{ status: "RECEIVED", at: now }],

      public: false,
      archived: false,

      totals: {
        totalItems: items.length,
        delivered: 0,
        loaded: 0,
        received: items.length,
        pending: 0,
      },

      remarks: remarks,
    });

    // 4. Create Packages (Children)
    const packageIds = [];

    if (items.length > 200) {
      throw new HttpsError(
        "invalid-argument",
        "Too many items in a single shipment.",
      );
    }

    items.forEach((item, index) => {
      const seqNum = (index + 1).toString().padStart(2, "0");
      const pkgId = `${shipmentId}-${seqNum}`;

      // References
      // const pkgRef = db.collection("packages").doc(pkgId);
      const pkgRef = shipmentRef.collection("packages").doc(pkgId);
      const historyRef = pkgRef.collection("history").doc(); // [NEW]: Subcollection Ref

      // A. Write Package Document
      batch.set(pkgRef, {
        trackingNumber: pkgId,
        shipmentId: shipmentId,
        sequence: index + 1,
        totalSequence: items.length,
        weight: Number(item.weight) || 0,
        description: item.description || "Standard Box",

        status: "RECEIVED",
        currentLocation: origin,
        currentTripId: null,

        // [NEW]: Denormalized Fields for Package Board Sorting/Filtering
        origin: origin,
        originCode: originCode,
        destination: destination,
        destinationCode: destinationCode,
        senderName: sender.name,
        recipientName: recipient.name,

        // [NEW]: Delay Flags
        isDelayed: false,
        delayReason: null,

        createdAt: nowAt,
        updatedAt: nowAt,
      });

      // B. [NEW]: Write First History Entry (Subcollection)
      batch.set(historyRef, {
        status: "RECEIVED",
        description: "Item received at origin warehouse",
        location: origin,
        timestamp: nowAt,
        actorId: request.auth.uid,
        tripId: null,
      });

      packageIds.push(pkgId);
    });

    batch.set(shipmentRef.collection("status_events").doc(), {
      type: "CREATED",
      message: "Shipment created",
      createdAt: nowAt,
      createdBy: request.auth.uid,
    });

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

    // 5. Commit
    try {
      await batch.commit();
      return { success: true, shipmentId, packageIds };
    } catch (error) {
      console.error("Transaction failure:", error);
      throw new HttpsError("internal", "Failed to create shipment records.");
    }
  },
);
