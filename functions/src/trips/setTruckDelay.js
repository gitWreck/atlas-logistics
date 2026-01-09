"use strict";

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const { requireRole } = require("./../../_shared");

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

/* ======================================================
   SET TRUCK DELAY (OPTION B — CANONICAL)
====================================================== */
exports.setTruckDelay = onCall({ region: "asia-southeast1" }, async (req) => {
  await requireRole(req, ["admin", "manager"]);

  const { truckTripId, reason } = req.data || {};

  if (!truckTripId || typeof truckTripId !== "string") {
    throw new HttpsError("invalid-argument", "truckTripId required");
  }

  if (!reason || typeof reason !== "string") {
    throw new HttpsError("invalid-argument", "delay reason required");
  }

  const uid = req.auth.uid;
  const role = req.auth.token?.role || "unknown";
  const tripRef = db.collection("truck_trips").doc(truckTripId);

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(tripRef);
    if (!snap.exists) {
      throw new HttpsError("not-found", "Truck trip not found");
    }

    const trip = snap.data();

    // 🔒 Hard stop: completed trip
    if (trip.active === false || trip.status === "COMPLETED") {
      throw new HttpsError(
        "failed-precondition",
        "Cannot delay a completed trip"
      );
    }

    // 🔁 Idempotent: already delayed with same reason
    if (trip.delayReason === reason && trip.delayStartedAt) {
      return;
    }

    const now = admin.firestore.FieldValue.serverTimestamp();

    tx.update(tripRef, {
      delayReason: reason,
      delayStartedAt: now,
      delayClearedAt: null,
      lastUpdatedAt: now,
      lastUpdatedBy: uid,
      lastUpdatedRole: role,
    });

    // 🧾 Audit log
    tx.set(db.collection("admin_logs").doc(), {
      action: "SET_TRUCK_DELAY",
      truckTripId,
      delayReason: reason,
      actorId: uid,
      actorRole: role,
      createdAt: now,
    });
  });

  return {
    success: true,
    truckTripId,
    delayReason: reason,
    delayed: true,
  };
});
