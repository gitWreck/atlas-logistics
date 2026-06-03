"use strict";

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const { requireRole, updatedBy } = require("../utilities/helpers"); // Your auth helper
const {
  broadcastTripLogic,
} = require("../messaging/broadcastTripMessage");
const {
  SEMAPHORE_API_KEY,
  SEMAPHORE_SENDER_NAME,
} = require("../../shared/sms-service");
const { STATUS_MESSAGES } = require("../utilities/dataDetails");
const { writeTripActionLog } = require("../utilities/tripLogger");
const {
  getTripNotificationTargets,
  normalizeNotificationChannels,
} = require("../utilities/notificationHelpers");

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

function normalizeDelayReason(reason) {
  return String(reason || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "_");
}

exports.resolveDelayReport = onCall(
  {
    region: "asia-southeast1",
    maxInstances: 10,
    secrets: [SEMAPHORE_API_KEY, SEMAPHORE_SENDER_NAME],
  },
  async (req) => {
    // 1. SECURITY: Only Admins/Managers can approve/reject
    const actor = await requireRole(db, req, ["admin", "manager"]);

    const {
      alertId,
      decision,
      managerNotes,
      notify,
      notificationChannels,
      notifySms,
      notifyEmail,
      notifyPush,
    } = req.data || {};
    // const uid = req.auth.uid;

    const { name, uid, role } = updatedBy(req);
    const actorName = name || actor.user?.name || actor.user?.fullName || uid;
    const actorRole = role || actor.role || null;
    const channels = normalizeNotificationChannels({
      notificationChannels,
      notify,
      notifySms,
      notifyEmail,
      notifyPush,
    });
    const shouldNotifyCustomers = Object.values(channels).some(Boolean);

    if (!alertId)
      throw new HttpsError("invalid-argument", "Alert ID is required");
    if (!["APPROVED", "REJECTED"].includes(decision)) {
      throw new HttpsError("invalid-argument", "Invalid decision");
    }

    const alertRef = db.collection("admin_alerts").doc(alertId);

    const resolution = await db.runTransaction(async (tx) => {
      // 2. FETCH ALERT
      const alertSnap = await tx.get(alertRef);
      if (!alertSnap.exists) {
        throw new HttpsError("not-found", "Alert not found");
      }

      const alertData = alertSnap.data();
      const { tripId, details } = alertData;
      const delayReason = normalizeDelayReason(details?.reason);

      // Check if already resolved to prevent double-clicks
      if (alertData.status !== "UNREAD" && alertData.status !== "PENDING") {
        throw new HttpsError("failed-precondition", "Alert already resolved.");
      }

      if (!tripId) {
        throw new HttpsError("failed-precondition", "Alert is missing trip ID.");
      }

      const tripRef = db.collection("truck_trips").doc(tripId);
      const tripSnap = await tx.get(tripRef);

      if (!tripSnap.exists) {
        throw new HttpsError("not-found", "Trip not found.");
      }

      const tripData = tripSnap.data() || {};
      const now = admin.firestore.FieldValue.serverTimestamp();

      // 3. LOGIC BRANCH
      if (decision === "APPROVED") {
        // --- APPROVE LOGIC ---
        // 1. Update Trip: Set status to DELAYED
        tx.update(tripRef, {
          // status: "DELAYED",
          delayReason: delayReason || "DELAY_APPROVED",
          delayCleared: false, // <-- CHANGED: False means the delay is currently active!
          delayStartedAt: now, // <-- ADDED: Track when the delay officially began
          delayClearedAt: null,
          updatedAt: now,
          updatedBy: uid,
        });
      } else {
        // --- REJECT LOGIC ---
        // 1. Update Trip: Clear the "Active Delay" flag so it stops flashing red
        tx.update(tripRef, {
          delayCleared: true,
          delayReason: null,
          // We don't change the status back to IN_TRANSIT here
          // just in case it was something else, but we remove the flag.
          updatedAt: now,
          updatedBy: uid,
        });
      }

      // 4. RESOLVE THE ALERT
      tx.update(alertRef, {
        status: decision, // "APPROVED" or "REJECTED"
        managerNotes: managerNotes || "",
        resolvedAt: now,
        resolvedBy: actorName,
        resolvedByUid: uid,
        resolvedByRole: actorRole,
        notifyCustomers: shouldNotifyCustomers,
        notificationChannels: channels,
      });

      writeTripActionLog({
        db,
        tx,
        action:
          decision === "APPROVED"
            ? "APPROVE_DELAY_REPORT"
            : "REJECT_DELAY_REPORT",
        tripId,
        actorId: uid,
        actorName,
        actorRole,
        details: {
          alertId,
          decision,
          delayReason: delayReason || null,
          previousDelayReason: tripData.delayReason || null,
          managerNotes: managerNotes || "",
          notifyCustomers: shouldNotifyCustomers,
          notificationChannels: channels,
        },
        createdAt: now,
      });

      return {
        tripId,
        delayReason,
      };
    });

    let notificationResult = null;
    let notificationEventQueued = false;
    const messageText =
      STATUS_MESSAGES[resolution.delayReason] ||
      "Atlas Logistics: Your shipment is currently delayed. We apologize for the inconvenience and will keep it moving as soon as possible.";

    if (channels.sms === true && decision === "APPROVED") {
      try {
        notificationResult = await broadcastTripLogic({
          tripId: resolution.tripId,
          message: messageText,
          actorUid: uid || "SYSTEM",
          type: "DELAY_APPROVED",
        });
      } catch (err) {
        console.error("[DelayReport] Customer notification failed:", err);
        notificationResult = {
          success: false,
          error: err.message || "Notification failed",
        };
      }
    }

    if (
      decision === "APPROVED" &&
      (channels.email === true || channels.push === true)
    ) {
      try {
        const targets = await getTripNotificationTargets(
          db,
          resolution.tripId,
        );
        const shouldQueueEvent =
          (channels.email === true && targets.emails.length > 0) ||
          (channels.push === true && targets.targetUserIds.length > 0);

        if (shouldQueueEvent) {
          await db.collection("notification_events").doc().set({
            type: "TRIP_DELAY_APPROVED",
            status: "pending",
            channels: {
              email: channels.email === true && targets.emails.length > 0,
              push: channels.push === true && targets.targetUserIds.length > 0,
              inApp: channels.push === true && targets.targetUserIds.length > 0,
            },
            entityType: "trip",
            entityId: resolution.tripId,
            tripId: resolution.tripId,
            targetUserIds: targets.targetUserIds,
            targets: {
              emails: targets.emails,
            },
            title: "Trip delay approved",
            body: messageText,
            data: {
              screen: "tracking",
              tripId: resolution.tripId,
              status: "DELAY_APPROVED",
              delayReason: resolution.delayReason || null,
            },
            actor: {
              uid,
              name: actorName,
              role: actorRole,
            },
            shipmentCount: targets.shipmentCount,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          });
          notificationEventQueued = true;
        }
      } catch (err) {
        console.error("[DelayReport] Failed to queue notification event:", err);
      }
    }

    return {
      success: true,
      notification: notificationResult,
      notificationEventQueued,
    };
  },
);
