"use strict";

/**
 * ATLAS — Public Tracking Mirror Engine
 *
 * tracking_records/{doc}
 *   → builds
 * tracking_public/{trackingNumber}
 */

const { onRequest } = require("firebase-functions/v2/https");
const { onDocumentWritten } = require("firebase-functions/v2/firestore");
const admin = require("firebase-admin");

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

/* ===============================
   CORE SYNC ENGINE
=============================== */
async function syncOneTracking(tr) {
  const trackingNumber = tr.trackingNumber;
  if (!trackingNumber) return { skipped: true };

  // Load timeline
  const eventsSnap = await db
    .collection("tracking_records")
    .doc(trackingNumber)
    .collection("events")
    .orderBy("at", "asc")
    .get()
    .catch(() => null);

  const timeline = [];
  if (eventsSnap) {
    eventsSnap.docs.forEach(d => {
      const e = d.data();
      timeline.push({
        status: e.status,
        at: e.at || null,
        note: e.note || ""
      });
    });
  }

  // Load packages
  const pkgSnap = await db
    .collection("trip_packages")
    .where("trackingNumber", "==", trackingNumber)
    .get()
    .catch(() => null);

  let received = 0;
  let loaded = 0;
  let pending = 0;

  if (pkgSnap) {
    pkgSnap.docs.forEach(d => {
      const p = d.data();
      if (p.status === "RECEIVED") received++;
      else if (p.status === "LOADED") loaded++;
      else pending++;
    });
  }

  const pub = {
    trackingNumber,

    // core
    status: tr.status || "CREATED",
    origin: tr.origin || "",
    destination: tr.destination || "",
    customerName: tr.customerName || "",
    driverName: tr.driverName || null,
    tripId: tr.tripId || null,

    // delay
    delayReason: tr.delayReason || null,
    delayCleared: tr.delayCleared || false,
    delayStartedAt: tr.delayStartedAt || null,

    // progress
    stepsDone: tr.stepsDone || [],
    timeline,

    totals: {
      received,
      loaded,
      pending
    },

    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  };

  await db
    .collection("tracking_public")
    .doc(trackingNumber)
    .set(pub, { merge: true });

  return { written: true };
}

/* ===============================
   AUTO SYNC (FIRESTORE)
=============================== */
exports.autoSyncPublicOnTrackingChange = onDocumentWritten(
  {
    document: "tracking_records/{docId}",
    region: "asia-southeast1"
  },
  async (event) => {
    const after = event.data.after?.data();
    if (!after) return;

    try {
      await syncOneTracking(after);
    } catch (err) {
      console.error("AutoSync failed:", err);
    }
  }
);

/* ===============================
   MANUAL ADMIN SYNC (HTTP)
=============================== */
exports.syncTrackingPublicHttp = onRequest(
  { region: "asia-southeast1" },
  async (req, res) => {
    const snap = await db.collection("tracking_records").get();

    let scanned = 0;
    let written = 0;
    let skipped = 0;
    const errors = [];

    for (const doc of snap.docs) {
      scanned++;
      try {
        const tr = doc.data();
        const r = await syncOneTracking(tr);
        if (r?.written) written++;
        else skipped++;
      } catch (e) {
        errors.push(e.message);
      }
    }

    res.json({ scanned, written, skipped, errors });
  }
);
