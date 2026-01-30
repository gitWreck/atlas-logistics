"use strict";

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const { requireAuth } = require("../utilities/helpers");

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

exports.reportTripDelay = onCall(
  { region: "asia-southeast1", maxInstances: 10 },
  async (req) => {
    // 1. AUTHENTICATION
    const uid = await requireAuth(req);
    const { tripId, type, notes } = req.data;

    // 2. VALIDATION
    if (!tripId)
      throw new HttpsError("invalid-argument", "Trip ID is required.");
    if (!type)
      throw new HttpsError("invalid-argument", "Delay type is required.");

    // 3. FETCH CONTEXT (Driver Name & Trip Data)
    const [userSnap, tripSnap] = await Promise.all([
      db.collection("users").doc(uid).get(),
      db.collection("truck_trips").doc(tripId).get(),
    ]);

    if (!tripSnap.exists) {
      throw new HttpsError("not-found", "Trip not found.");
    }

    // Optional: Ensure the caller is actually the assigned driver
    const tripData = tripSnap.data();
    // if (tripData.driverUid !== uid) throw new HttpsError("permission-denied", "Not your trip.");

    const userData = userSnap.data() || {};
    const driverName = userData.name || userData.fullName || "Driver";
    const timestamp = admin.firestore.FieldValue.serverTimestamp();

    const batch = db.batch();

    // =========================================================
    // A. WRITE TO TRIP HISTORY (The Permanent Record)
    // =========================================================
    const delayRef = db
      .collection("truck_trips")
      .doc(tripId)
      .collection("delays")
      .doc();
    batch.set(delayRef, {
      type: type, // e.g. "TRAFFIC"
      notes: notes || "",
      reportedAt: timestamp,
      status: "PENDING_APPROVAL",
      driverId: uid,
      driverName: driverName,
      tripId: tripId,
    });

    // =========================================================
    // B. WRITE TO ADMIN ALERTS (The Real-time Notification)
    // =========================================================
    const alertRef = db.collection("admin_alerts").doc();
    batch.set(alertRef, {
      type: "DELAY_REPORT",
      subType: type,
      tripId: tripId,
      tripCode: tripData.tripId || "Unknown Trip", // Helps Admin identify trip instantly
      details: {
        reason: type,
        notes: notes || "",
        driverId: uid,
        driverName: driverName,
      },
      status: "UNREAD",
      priority: "HIGH",
      createdAt: timestamp,
    });

    // =========================================================
    // C. UPDATE TRIP STATUS (The Dashboard Flag)
    // =========================================================
    // Sets a flag so the trip turns "Red" or shows an icon in the trip list
    const tripRef = db.collection("truck_trips").doc(tripId);
    batch.update(tripRef, {
      delayCleared: false,
      lastDelayReason: type,
      updatedAt: timestamp,
    });

    await batch.commit();

    return { success: true, message: "Delay reported successfully" };
  },
);
