"use strict";
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

exports.getTripPackages = onCall({ region: "asia-southeast1" }, async (req) => {
  if (!req.auth?.uid) throw new HttpsError("unauthenticated", "Login required");

  const tripDocId = req.data?.tripDocId;
  if (!tripDocId) throw new HttpsError("invalid-argument", "tripDocId required");

  const snap = await db
    .collection("truck_trips")
    .doc(tripDocId)
    .collection("trip_packages")
    .get();

  const rows = [];
  snap.forEach(doc => {
    const p = doc.data();
    rows.push({
      id: doc.id,
      trackingNumber: p.trackingNumber,
      packageCount: p.packageCount,
      loadedCount: p.loadedCount,
      pendingCount: p.pendingCount,
      status: p.status,
      route: p.route,
      updatedAt: p.lastUpdatedAt?.toDate?.() || null
    });
  });

  return { packages: rows };
});
