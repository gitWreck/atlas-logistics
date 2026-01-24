const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");

// admin.initializeApp();

exports.getListShipments = onCall(
  { region: "asia-southeast1" },
  async ({ auth }) => {
    // if (!auth) {
    //   throw new HttpsError("unauthenticated", "Authentication required.");
    // }

    try {
      const db = admin.firestore();

      // 1️⃣ Fetch both collections in parallel
      const [recordsSnap, publicSnap] = await Promise.all([
        db.collection("tracking_records").get(),
        db.collection("tracking_public").get(),
      ]);

      // 2️⃣ Build lookup map for tracking_public
      const publicMap = {};
      publicSnap.docs.forEach((doc) => {
        const data = doc.data();
        if (data.trackingNumber) {
          publicMap[data.trackingNumber] = data;
        }
      });

      // 3️⃣ Merge (tracking_records = base, tracking_public overrides)
      const shipments = recordsSnap.docs.map((doc) => {
        const record = doc.data();
        const detail = publicMap[record.trackingNumber] || {};

        const merged = { ...record, ...detail };

        return {
          id: doc.id,

          // Core
          trackingNumber: merged.trackingNumber || doc.id,
          tripId: merged.tripId || null,
          status: merged.status || "UNKNOWN",
          public: merged.public ?? false,

          // Route
          origin: merged.origin || "",
          destination: merged.destination || "",
          route:
            merged.route ||
            `${merged.origin || "?"} → ${merged.destination || "?"}`,

          // People
          driverName: merged.driverName || "",
          customerName: merged.customerName || "",
          customerPhoneNumber: merged.customerPhoneNumber || "",
          sender: merged.sender || "",
          recipient: merged.recipient || "",

          // Delay
          delayReason: merged.delayReason || null,
          delayCleared: merged.delayCleared ?? false,
          delayStartedAt: merged.delayStartedAt || null,

          // Progress / timeline (from tracking_public)
          startedAt: merged.startedAt || null,
          updatedAt: merged.lastUpdatedAt || null,
          stepsDone: merged.stepsDone || [],
          timeline: merged.timeline || [],
          totals: merged.totals || { loaded: 0, pending: 0, received: 0 },
        };
      });

      return { records: shipments };
    } catch (err) {
      console.error("getListShipments error:", err);
      throw new HttpsError("internal", "Failed to fetch shipments.");
    }
  }
);
