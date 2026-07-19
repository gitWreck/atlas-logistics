"use strict";

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");

const admin = require("firebase-admin");
const { requireRole, updatedBy } = require("../utilities/helpers");
const { broadcastTripLogic } = require("../messaging/broadcastTripMessage"); // Import if you want to call it directly
const { STATUS_MESSAGES } = require("../utilities/dataDetails");
const { writeTripActionLog } = require("../utilities/tripLogger");
const {
  getTripNotificationTargets,
  normalizeNotificationChannels,
} = require("../utilities/notificationHelpers");

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
    const actor = await requireRole(db, req, ["admin", "manager", "driver"]);

    const {
      tripId,
      notify,
      notificationChannels,
      notifySms,
      notifyEmail,
      notifyPush,
      // updatedBy
    } = req.data || {};
    if (!tripId || typeof tripId !== "string") {
      throw new HttpsError("invalid-argument", "tripId required");
    }

    const actorMeta = updatedBy(req);
    const uid = actor.uid;
    const role = actor.role;
    const name = actor.user?.name || actor.user?.fullName || actorMeta.name || uid;
    const channels = normalizeNotificationChannels({
      notificationChannels,
      notify,
      notifySms,
      notifyEmail,
      notifyPush,
    });
    const shouldNotifyCustomers = Object.values(channels).some(Boolean);

    // const role = req.auth.token?.role || "unknown";
    const tripRef = db.collection("truck_trips").doc(tripId);
    // ✅ NEW: Reference for the Admin Alert
    const alertRef = db.collection("admin_alerts").doc();
    // const notify = !!req.data?.notify; // Optional: whether to send SMS notifications for this status change

    const clearResult = await db.runTransaction(async (tx) => {
      const snap = await tx.get(tripRef);
      if (!snap.exists) {
        throw new HttpsError("not-found", "Truck trip not found");
      }

      const trip = snap.data();

      if (
        actor.role === "driver" &&
        String(trip.driverId || trip.driverUid || "") !== String(actor.uid)
      ) {
        throw new HttpsError("permission-denied", "This trip is not assigned to your Driver account.");
      }

      // 🔒 Hard stop: completed trip
      if (trip.active === false || trip.status === "COMPLETED") {
        throw new HttpsError(
          "failed-precondition",
          "Cannot clear delay on a completed trip",
        );
      }

      // 🔁 Idempotent: already cleared
      if (!trip.delayReason && trip.delayClearedAt) {
        return { cleared: false };
      }

      const now = admin.firestore.FieldValue.serverTimestamp();

      tx.update(tripRef, {
        delayReason: null,
        delayClearedAt: now,
        delayCleared: true,

        updatedAt: now,
        updatedBy: name,
        updatedRole: role,
      });

      // 🧾 Audit log
      writeTripActionLog({
        db,
        tx,
        action: "CLEAR_TRUCK_DELAY",
        tripId,
        actorId: uid,
        actorName: name || null,
        actorRole: role,
        details: {
          previousDelay: trip.delayReason || null,
          notifyCustomers: shouldNotifyCustomers,
          notificationChannels: channels,
        },
        createdAt: now,
      });

      // =========================================================
      // ✅ NEW: ADMIN ALERT LOGGING
      // =========================================================
      tx.set(alertRef, {
        type: "DELAY_CLEARED",
        subType: trip.delayReason || "UNKNOWN_DELAY",
        tripId: tripId,
        details: {
          reason: `Driver has cleared the delay and resumed the trip.`,
          previousDelay: trip.delayReason || "Unknown",
          userId: uid,
          userRole: role,
          notifyCustomers: shouldNotifyCustomers,
          notificationChannels: channels,
        },
        status: "UNREAD",
        priority: "MEDIUM",
        createdAt: now,
      });

      return {
        cleared: true,
        previousDelay: trip.delayReason || null,
      };
    });

    let notificationEventQueued = false;

    if (!clearResult?.cleared) {
      return {
        success: true,
        tripId,
        delayed: false,
        alreadyCleared: true,
        notificationChannels: channels,
        notificationEventQueued,
      };
    }

    if (channels.sms === true) {
      // 1. Define Standard Messages
      const messageText = STATUS_MESSAGES["DELAY_CLEARED"];

      if (messageText) {
        console.log(
          `[Notify] Sending broadcast for trip ${tripId} with delay is cleared`,
        );

        try {
          broadcastTripLogic({
            tripId: tripId,
            message: messageText,
            actorUid: uid || "SYSTEM",
            actorName: name || "SYSTEM",
            actorRole: role || "SYSTEM",
            type: "DELAY_CLEARED_BROADCAST",
          }).catch((err) => console.error("Broadcast failed:", err));
        } catch (err) {
          console.error("[Notify] Failed to queue SMS:", err);
          // Don't throw error here, or you will roll back the Status Update!
          // We want the status to change even if SMS fails.
        }
      }
    }

    if (channels.email === true || channels.push === true) {
      try {
        const targets = await getTripNotificationTargets(db, tripId);
        const shouldQueueEvent =
          (channels.email === true && targets.emails.length > 0) ||
          (channels.push === true && targets.targetUserIds.length > 0);

        if (shouldQueueEvent) {
          const messageText =
            STATUS_MESSAGES["DELAY_CLEARED"] ||
            "Atlas Logistics: The delay has been resolved and your shipment is back on the move.";

          await db.collection("notification_events").doc().set({
            type: "TRIP_DELAY_CLEARED",
            status: "pending",
            channels: {
              email: channels.email === true && targets.emails.length > 0,
              push: channels.push === true && targets.targetUserIds.length > 0,
              inApp: channels.push === true && targets.targetUserIds.length > 0,
            },
            entityType: "trip",
            entityId: tripId,
            tripId,
            targetUserIds: targets.targetUserIds,
            targets: {
              emails: targets.emails,
            },
            title: "Trip delay cleared",
            body: messageText,
            data: {
              screen: "tracking",
              tripId,
              status: "DELAY_CLEARED",
            },
            actor: {
              uid,
              name,
              role,
            },
            shipmentCount: targets.shipmentCount,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          });
          notificationEventQueued = true;
        }
      } catch (err) {
        console.error("[Notify] Failed to queue delay clear event:", err);
      }
    }

    return {
      success: true,
      tripId,
      delayed: false,
      notificationChannels: channels,
      notificationEventQueued,
    };
  },
);
