"use strict";

const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { defineSecret } = require("firebase-functions/params");
const admin = require("firebase-admin");
const { unique } = require("../utilities/helpers");
const {
  CUSTOMER_NOTIFICATION_TYPES,
  resolveShipmentCustomerNotificationType,
} = require("./customerNotificationTypes");
const {
  sendAutomaticShipmentLifecycleNotification,
} = require("./customerNotificationService");
const {
  SEMAPHORE_API_KEY,
  SEMAPHORE_SENDER_NAME,
} = require("../../shared/sms-service");

if (!admin.apps.length) admin.initializeApp();

const db = admin.firestore();
const SMTP_EMAIL = defineSecret("SMTP_EMAIL");
const SMTP_PASSWORD = defineSecret("SMTP_PASSWORD");

async function writeInAppNotifications({ eventId, event }) {
  const userIds = unique(event.targetUserIds || []);
  if (!userIds.length) return { written: 0 };

  const batch = db.batch();
  const now = admin.firestore.FieldValue.serverTimestamp();

  userIds.forEach((uid) => {
    const ref = db
      .collection("users")
      .doc(uid)
      .collection("notifications")
      .doc(eventId);

    batch.set(ref, {
      type: event.type,
      title: event.title || "Notification",
      body: event.body || "",
      data: event.data || {},
      entityType: event.entityType || null,
      entityId: event.entityId || null,
      ownerId: uid,
      read: false,
      createdAt: now,
    });
  });

  await batch.commit();
  return { written: userIds.length };
}

async function processShipmentCreatedEvent({ eventId, event }) {
  const channels = event.channels || {};
  const result = {};

  if (event.customerNotifyHandled === true) {
    if (channels.inApp === true) {
      result.inApp = await writeInAppNotifications({ eventId, event });
    }
    return result;
  }

  if (channels.inApp === true) {
    result.inApp = await writeInAppNotifications({ eventId, event });
  }

  if (channels.sms === true || channels.email === true || channels.push === true) {
    result.customer = await sendAutomaticShipmentLifecycleNotification({
      db,
      shipment: {
        sender: event.targets?.sender || {},
        recipient: event.targets?.recipient || {},
      },
      shipmentId: event.shipmentId,
      notificationType: CUSTOMER_NOTIFICATION_TYPES.RECEIVED_AT_DIVISORIA,
      channels: {
        sms: channels.sms === true,
        email: channels.email === true,
        push: channels.push === true,
      },
      actor: event.actor || {},
      source: "SHIPMENT_CREATED",
      tripId: event.tripId || event.data?.tripId || null,
    });
  }

  return result;
}

async function processShipmentStatusUpdatedEvent({ eventId, event }) {
  const channels = event.channels || {};
  const result = {};
  const oldStatus = event.data?.oldStatus || null;
  const newStatus = event.data?.status || event.data?.newStatus || null;
  const notificationType = resolveShipmentCustomerNotificationType(
    oldStatus,
    newStatus,
  );

  if (!notificationType) {
    return { skipped: true, reason: "non_customer_status" };
  }

  if (channels.inApp === true) {
    result.inApp = await writeInAppNotifications({ eventId, event });
  }

  if (channels.sms === true || channels.email === true || channels.push === true) {
    result.customer = await sendAutomaticShipmentLifecycleNotification({
      db,
      shipment: {
        sender: event.targets?.sender || {},
        recipient: event.targets?.recipient || {},
      },
      shipmentId: event.shipmentId,
      notificationType,
      channels: {
        sms: channels.sms === true,
        email: channels.email === true,
        push: channels.push === true,
      },
      actor: event.actor || {},
      source: "SHIPMENT_STATUS_UPDATED",
      tripId: event.tripId || event.data?.tripId || null,
    });
  }

  return result;
}

async function processTripDelayEvent({ eventId, event }) {
  const channels = event.channels || {};
  const result = {};

  if (channels.inApp === true) {
    result.inApp = await writeInAppNotifications({ eventId, event });
  }

  if (event.tripId && (channels.sms || channels.email || channels.push)) {
    const { sendTripCustomerNotifications } = require("./customerNotificationService");
    result.customer = await sendTripCustomerNotifications({
      db,
      tripId: event.tripId,
      notificationType: CUSTOMER_NOTIFICATION_TYPES.TRIP_DELAY,
      channels: {
        sms: channels.sms === true,
        email: channels.email === true,
        push: channels.push === true,
      },
      customSmsMessage: event.smsBody || event.body,
      customEmail: {
        subject: event.title || "Atlas Transport update",
        text: event.body || "",
        html: `<p>${event.body || ""}</p>`,
      },
      customPush: event.body || "",
      actor: event.actor || {},
      source: event.type || "TRIP_DELAY",
    });
  }

  return result;
}

exports.processNotificationEvent = onDocumentCreated(
  {
    document: "notification_events/{eventId}",
    region: "asia-southeast1",
    secrets: [
      SEMAPHORE_API_KEY,
      SEMAPHORE_SENDER_NAME,
      SMTP_EMAIL,
      SMTP_PASSWORD,
    ],
    maxInstances: 10,
  },
  async (event) => {
    const snap = event.data;
    if (!snap) return;

    const eventId = event.params.eventId;
    const ref = snap.ref;
    const notificationEvent = snap.data() || {};

    if (notificationEvent.status && notificationEvent.status !== "pending") {
      return;
    }

    try {
      await ref.update({
        status: "processing",
        processingStartedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      let result = {};
      if (notificationEvent.type === "SHIPMENT_CREATED") {
        result = await processShipmentCreatedEvent({
          eventId,
          event: notificationEvent,
        });
      } else if (notificationEvent.type === "SHIPMENT_STATUS_UPDATED") {
        result = await processShipmentStatusUpdatedEvent({
          eventId,
          event: notificationEvent,
        });
      } else if (
        notificationEvent.type === "TRIP_DELAY_APPROVED" ||
        notificationEvent.type === "TRIP_DELAY_CLEARED"
      ) {
        result = await processTripDelayEvent({
          eventId,
          event: notificationEvent,
        });
      } else {
        result = { skipped: true, reason: "Unsupported notification type" };
      }

      await ref.update({
        status: "completed",
        result,
        completedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    } catch (err) {
      console.error("[NOTIFICATION_EVENT_ERROR]", eventId, err);
      await ref.update({
        status: "failed",
        error: err?.message || String(err),
        failedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }
  },
);
