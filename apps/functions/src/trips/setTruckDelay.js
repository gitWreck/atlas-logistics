"use strict";

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const admin = require("firebase-admin");
const { requireRole, updatedBy } = require("../utilities/helpers");
const { broadcastTripLogic } = require("../messaging/broadcastTripMessage"); // Import if you want to call it directly
const { STATUS_MESSAGES } = require("../utilities/dataDetails");
const { writeTripActionLog } = require("../utilities/tripLogger");

const SEMAPHORE_API_KEY = defineSecret("SEMAPHORE_API_KEY");
const SEMAPHORE_SENDER_NAME = defineSecret("SEMAPHORE_SENDER_NAME");

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

/* ======================================================
   SET TRUCK DELAY (OPTION B — CANONICAL)
====================================================== */
exports.setTruckDelay = onCall(
  {
    region: "asia-southeast1",
    maxInstances: 10,
    secrets: [SEMAPHORE_API_KEY, SEMAPHORE_SENDER_NAME],
  },
  async (req) => {
    await requireRole(db, req, ["admin", "manager"]);

    const {
      tripId,
      reason,
      notify,
      // updatedBy
    } = req.data || {};

    if (!tripId || typeof tripId !== "string") {
      throw new HttpsError("invalid-argument", "tripId required");
    }

    if (!reason || typeof reason !== "string") {
      throw new HttpsError("invalid-argument", "delay reason required");
    }

    const { uid, role, name } = updatedBy(req);

    // const uid = req.auth.uid;
    // const role = req.auth.token?.role || "unknown";
    const tripRef = db.collection("truck_trips").doc(tripId);
    // const notify = !!req.data?.notify; // Optional: whether to send SMS notifications for this status change

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
          "Cannot delay a completed trip",
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
        delayCleared: false,

        updatedAt: now,
        updatedBy: name,
        updatedRole: role,
      });

      // 🧾 Audit log
      writeTripActionLog({
        db,
        tx,
        action: "SET_TRUCK_DELAY",
        tripId,
        delayReason: reason,
        actorId: uid,
        actorName: name,
        actorRole: role,
        createdAt: now,
      });
    });

    const delayStatus = reason.toUpperCase();

    if (notify === true) {
      // 1. Define Standard Messages
      const messageText = STATUS_MESSAGES[delayStatus];

      if (!messageText || delayStatus === "CUSTOM") {
        // Use the 'notes' provided, or a generic fallback
        const customReason = `We are experiencing an unexpected delay. ${delayStatus}`;
        messageText = `Atlas Logistics: ${customReason}`;
      }

      if (messageText) {
        console.log(
          `[Notify] Sending broadcast for trip ${tripId} with status ${delayStatus}`,
        );

        try {
          broadcastTripLogic({
            tripId: tripId,
            message: messageText,
            actorUid: uid || "SYSTEM",
            actorName: name || "SYSTEM",
            actorRole: role || "SYSTEM",
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
      tripId,
      delayReason: reason,
      delayed: true,
    };
  },
);
