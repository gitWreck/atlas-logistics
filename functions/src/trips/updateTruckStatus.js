"use strict";

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const crypto = require("crypto");
const { assertAdminOrManager } = require("./../system/authGuards");

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

/* ======================================================
   CONSTANTS
====================================================== */
const ALLOWED_STATUSES = [
  "Received",
  "Loaded",
  "In Transit",
  "Arrived at Port",
  "Boarded RORO Vessel",
  "Out for Delivery",
  "Delivered",
];

/* ======================================================
   HASH (TAMPER-EVIDENT)
====================================================== */
function sha256(v) {
  return crypto.createHash("sha256").update(String(v)).digest("hex");
}

/* ======================================================
   UPDATE TRUCK STATUS (OPTION B — CANONICAL)
====================================================== */
exports.updateTruckStatus = onCall(
  { region: "asia-southeast1" },
  async (request) => {
    await assertAdminOrManager(request);

    const uid = request.auth.uid;
    const role = request.auth.token?.role || "unknown";

    const { truckTripId, status, statusIndex } = request.data || {};

    /* ===============================
       VALIDATION
    =============================== */
    if (!truckTripId || !status || typeof statusIndex !== "number") {
      throw new HttpsError(
        "invalid-argument",
        "truckTripId, status, and statusIndex are required"
      );
    }

    if (!ALLOWED_STATUSES.includes(status)) {
      throw new HttpsError("invalid-argument", `Invalid status: ${status}`);
    }

    const tripRef = db.collection("truck_trips").doc(truckTripId);
    const eventsRef = tripRef.collection("status_events");

    await db.runTransaction(async (tx) => {
      /* ===============================
         LOAD TRIP
      =============================== */
      const tripSnap = await tx.get(tripRef);
      if (!tripSnap.exists) {
        throw new HttpsError("not-found", "Truck trip not found");
      }

      const trip = tripSnap.data();

      /* ===============================
         IDEMPOTENCY
      =============================== */
      if (trip.status === status && Number(trip.statusIndex) === statusIndex) {
        return;
      }

      /* ===============================
         LOAD LAST EVENT
      =============================== */
      const lastSnap = await tx.get(
        eventsRef.orderBy("statusIndex", "desc").limit(1)
      );

      let prevIndex = -1;
      let prevHash = "";

      if (!lastSnap.empty) {
        const last = lastSnap.docs[0].data();
        prevIndex = Number(last.statusIndex ?? -1);
        prevHash = last.hash || "";
      }

      /* ===============================
         FORWARD-ONLY ENFORCEMENT
      =============================== */
      if (prevIndex !== -1 && statusIndex !== prevIndex + 1) {
        throw new HttpsError(
          "failed-precondition",
          "Truck status must advance sequentially"
        );
      }

      /* ===============================
         CREATE HASH CHAIN
      =============================== */
      const payload = [
        truckTripId,
        status,
        statusIndex,
        uid,
        role,
        prevHash,
      ].join("|");

      const hash = sha256(payload);
      const now = admin.firestore.FieldValue.serverTimestamp();

      /* ===============================
         WRITE STATUS EVENT
      =============================== */
      tx.set(eventsRef.doc(), {
        status,
        statusIndex,
        at: now,
        by: uid,
        role,
        prevHash,
        hash,
      });

      /* ===============================
         UPDATE TRUCK ONLY
      =============================== */
      tx.update(tripRef, {
        status,
        statusIndex,
        lastUpdatedAt: now,
        lastUpdatedBy: uid,
        lastUpdatedRole: role,
      });

      /* ===============================
         ADMIN AUDIT LOG
      =============================== */
      tx.set(db.collection("admin_logs").doc(), {
        action: "TRUCK_STATUS_UPDATE",
        truckTripId,
        status,
        statusIndex,
        actorId: uid,
        actorRole: role,
        createdAt: now,
      });
    });

    return {
      success: true,
      truckTripId,
      status,
      statusIndex,
      mode: "OPTION_B_CANONICAL",
    };
  }
);
