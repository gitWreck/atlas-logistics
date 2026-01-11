"use strict";

const { onDocumentWritten } = require("firebase-functions/v2/firestore");
const { FieldValue } = require("firebase-admin/firestore");
const admin = require("firebase-admin");

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

/**
 * Auto-repair tracking_public whenever tracking_records changes
 */
exports.autoRepairTrackingPublic = onDocumentWritten(
  {
    document: "tracking_records/{trackingNumber}",
    region: "asia-southeast1",
  },
  async (event) => {
    const trackingNumber = event.params.trackingNumber;

    // Load source record
    const srcSnap = await db
      .collection("tracking_records")
      .doc(trackingNumber)
      .get();

    if (!srcSnap.exists) {
      console.log("❌ Source deleted — skipping");
      return;
    }

    const src = srcSnap.data();

    // Only sync public shipments
    if (!src.public) {
      console.log("🔒 Not public — skipping");
      return;
    }

    // Load public copy
    const pubRef = db.collection("tracking_public").doc(trackingNumber);
    const pubSnap = await pubRef.get();

    // If public missing → rebuild
    if (!pubSnap.exists) {
      console.log("🛠 Public missing — rebuilding");
      await rebuildPublic(trackingNumber, src);
      return;
    }

    const pub = pubSnap.data();

    // Detect stale
    const mismatch =
      pub.status !== src.status ||
      pub.delayCleared !== src.delayCleared ||
      pub.delayReason !== src.delayReason ||
      pub.driverName !== src.driverName ||
      pub.tripId !== src.tripId ||
      pub.updatedAt?.toMillis?.() < src.updatedAt?.toMillis?.();

    if (!mismatch) {
      console.log("✅ Public is healthy");
      return;
    }

    console.log("⚠️ Public stale — repairing");
    await rebuildPublic(trackingNumber, src);
  }
);

async function rebuildPublic(trackingNumber, tr) {
  const eventsSnap = await db
    .collection("tracking_records")
    .doc(trackingNumber)
    .collection("events")
    .orderBy("at", "asc")
    .get();

  const timeline = eventsSnap.docs.map((d) => d.data());

  const pub = {
    trackingNumber,
    status: tr.status || "CREATED",
    origin: tr.origin || "",
    destination: tr.destination || "",
    customerName: tr.customerName || "",
    driverName: tr.driverName || null,
    tripId: tr.tripId || null,
    delayReason: tr.delayReason || null,
    delayCleared: tr.delayCleared || false,
    delayStartedAt: tr.delayStartedAt || null,
    totals: tr.totals || { received: 0, loaded: 0, pending: 0 },
    stepsDone: tr.stepsDone || [],
    timeline,
    updatedAt: FieldValue.serverTimestamp(),
  };

  await db
    .collection("tracking_public")
    .doc(trackingNumber)
    .set(pub, { merge: true });

  console.log("🧬 Repaired", trackingNumber);
}
