const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { FieldValue } = require("firebase-admin/firestore");
const admin = require("firebase-admin");

// Ensure admin is initialized (usually at the top of index.js)
if (!admin.apps.length) {
  admin.initializeApp();
}

exports.createShipmentWithPackages = onCall(
  { region: "asia-southeast1" }, // v2 allows options here
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
      items, // Array: [{ weight: 5, desc: "Clothes" }]
    } = request.data;

    const db = admin.firestore();
    const batch = db.batch();

    // 2. Generate IDs
    const timestamp = new Date();
    const dateStr = timestamp.toISOString().slice(0, 10).replace(/-/g, ""); // "20260112"

    // tracking format: AT-DATE-ORG-DST-RANDOM
    const shipmentId = `AT-${dateStr}-${origin
      .substring(0, 3)
      .toUpperCase()}-${destination.substring(0, 3).toUpperCase()}-${Math.floor(
      1000 + Math.random() * 9000
    )}`;

    const shipmentRef = db.collection("shipments").doc(shipmentId);

    // 3. Create Shipment (Parent)
    batch.set(shipmentRef, {
      trackingNumber: shipmentId,
      sender,
      recipient,
      origin,
      destination,
      status: "RECEIVED",
      createdAt: FieldValue.serverTimestamp(),
      createdBy: request.auth.uid, // Good practice to track who created it
      totals: {
        totalItems: items.length,
        loaded: 0,
        received: items.length,
        pending: 0,
      },
    });

    // 4. Create Packages (Children)
    const packageIds = [];

    items.forEach((item, index) => {
      // Suffix: -01, -02...
      const seqNum = (index + 1).toString().padStart(2, "0");
      const pkgId = `${shipmentId}-${seqNum}`;
      const pkgRef = db.collection("packages").doc(pkgId);

      batch.set(pkgRef, {
        trackingNumber: pkgId,
        shipmentId: shipmentId,
        sequence: index + 1,
        totalSequence: items.length,
        weight: Number(item.weight) || 0, // Ensure number
        description: item.desc || "Standard Box",
        status: "RECEIVED",
        currentLocation: origin,
        currentTripId: null,
        createdAt: FieldValue.serverTimestamp(),
      });

      packageIds.push(pkgId);
    });

    // 5. Commit to Database
    try {
      await batch.commit();
      return { success: true, shipmentId, packageIds };
    } catch (error) {
      console.error("Transaction failure:", error);
      throw new HttpsError("internal", "Failed to create shipment records.");
    }
  }
);
