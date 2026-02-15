"use strict";

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");

const admin = require("firebase-admin");
const { requireRole } = require("../utilities/helpers");
const { broadcastTripLogic } = require("../messaging/broadcastTripMessage"); // Import if you want to call it directly
const { STATUS_MESSAGES } = require("../utilities/dataDetails");

const SEMAPHORE_API_KEY = defineSecret("SEMAPHORE_API_KEY");
const SEMAPHORE_SENDER_NAME = defineSecret("SEMAPHORE_SENDER_NAME");

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

/* ======================================================
   CLEAR TRUCK DELAY (OPTION B — CANONICAL)
====================================================== */
exports.clearTruckDelay = onCall(
  {
    region: "asia-southeast1",
    maxInstances: 10,
    secrets: [SEMAPHORE_API_KEY, SEMAPHORE_SENDER_NAME],
  },
  async (req) => {
    await requireRole(db, req, ["admin", "manager"]);

    const { truckTripId } = req.data || {};
    if (!truckTripId || typeof truckTripId !== "string") {
      throw new HttpsError("invalid-argument", "truckTripId required");
    }

    const uid = req.auth.uid;
    const role = req.auth.token?.role || "unknown";
    const tripRef = db.collection("truck_trips").doc(truckTripId);
    const notify = !!req.data?.notify; // Optional: whether to send SMS notifications for this status change

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
          "Cannot clear delay on a completed trip",
        );
      }

      // 🔁 Idempotent: already cleared
      if (!trip.delayReason && trip.delayClearedAt) {
        return;
      }

      const now = admin.firestore.FieldValue.serverTimestamp();

      tx.update(tripRef, {
        delayReason: null,
        delayClearedAt: now,
        delayCleared: true,

        updatedAt: now,
        updatedBy: uid,
        updatedRole: role,
      });

      // 🧾 Audit log
      tx.set(db.collection("admin_logs").doc(), {
        action: "CLEAR_TRUCK_DELAY",
        truckTripId,
        actorId: uid,
        actorRole: role,
        createdAt: now,
      });
    });

    if (notify === true) {
      // 1. Define Standard Messages
      const messageText = STATUS_MESSAGES["DELAY_CLEARED"];

      if (messageText) {
        console.log(
          `[Notify] Sending broadcast for trip ${truckTripId} with delay is cleared`,
        );

        try {
          broadcastTripLogic({
            tripId: truckTripId,
            message: messageText,
            actorUid: request.auth.uid || "SYSTEM",
          }).catch((err) => console.error("Broadcast failed:", err));
        } catch (err) {
          console.error("[Notify] Failed to queue SMS:", err);
          // Don't throw error here, or you will roll back the Status Update!
          // We want the status to change even if SMS fails.
        }
      }
    }

    return {
      success: true,
      truckTripId,
      delayed: false,
    };
  },
);
