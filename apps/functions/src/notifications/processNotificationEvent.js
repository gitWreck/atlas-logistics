"use strict";

const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { defineSecret } = require("firebase-functions/params");
const admin = require("firebase-admin");
const nodemailer = require("nodemailer");
const {
  sendShipmentCreatedSmsLogic,
} = require("../messaging/sendShipmentCreatedSmsLogic");
const {
  SEMAPHORE_API_KEY,
  SEMAPHORE_SENDER_NAME,
} = require("../../shared/sms-service");
const { unique } = require("../utilities/helpers");

if (!admin.apps.length) admin.initializeApp();

const db = admin.firestore();
const SMTP_EMAIL = defineSecret("SMTP_EMAIL");
const SMTP_PASSWORD = defineSecret("SMTP_PASSWORD");

function getTargetEmails(targets = {}) {
  return unique([
    ...(Array.isArray(targets.emails) ? targets.emails : []),
    targets.sender?.email,
    targets.recipient?.email,
  ]);
}

function getTargetPhones(targets = {}) {
  return {
    senderPhone: targets.sender?.phone || null,
    recipientPhone: targets.recipient?.phone || null,
  };
}

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
      read: false,
      createdAt: now,
    });
  });

  await batch.commit();
  return { written: userIds.length };
}

async function sendShipmentCreatedEmail({ event }) {
  const emails = getTargetEmails(event.targets);
  if (!emails.length) return { sent: 0, skipped: true };

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: SMTP_EMAIL.value(),
      pass: SMTP_PASSWORD.value(),
    },
  });

  await Promise.all(
    emails.map((to) =>
      transporter.sendMail({
        to,
        subject: event.title || "Atlas Transport update",
        text: [
          event.body || "Your shipment has been updated.",
          event.shipmentId ? `Tracking ID: ${event.shipmentId}` : null,
          event.tripId ? `Trip ID: ${event.tripId}` : null,
        ]
          .filter(Boolean)
          .join("\n\n"),
        html: `
          <p>${event.body || "Your shipment has been updated."}</p>
          ${
            event.shipmentId
              ? `<p><strong>Tracking ID:</strong> ${event.shipmentId}</p>`
              : ""
          }
          ${event.tripId ? `<p><strong>Trip ID:</strong> ${event.tripId}</p>` : ""}
        `,
      }),
    ),
  );

  return { sent: emails.length };
}

async function getExpoPushTokens(userIds = []) {
  const tokenSet = new Set();

  await Promise.all(
    unique(userIds).map(async (uid) => {
      const userRef = db.collection("users").doc(uid);
      const [userSnap, tokensSnap] = await Promise.all([
        userRef.get(),
        userRef.collection("pushTokens").get(),
      ]);

      const user = userSnap.data() || {};

      [
        user.expoPushToken,
        ...(Array.isArray(user.expoPushTokens) ? user.expoPushTokens : []),
        ...(Array.isArray(user.pushTokens) ? user.pushTokens : []),
      ].forEach((token) => {
        if (token) tokenSet.add(String(token));
      });

      tokensSnap.docs.forEach((doc) => {
        const data = doc.data() || {};
        if (data.enabled === false) return;
        if (data.token) tokenSet.add(String(data.token));
      });
    }),
  );

  return [...tokenSet].filter(
    (token) =>
      token.startsWith("ExponentPushToken") ||
      token.startsWith("ExpoPushToken"),
  );
}

async function sendExpoPushNotifications({ event }) {
  const tokens = await getExpoPushTokens(event.targetUserIds || []);
  if (!tokens.length) return { sent: 0, skipped: true };

  const messages = tokens.map((to) => ({
    to,
    sound: "default",
    title: event.title || "Atlas Transport",
    body: event.body || "",
    data: event.data || {},
  }));

  const response = await fetch("https://exp.host/--/api/v2/push/send", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(messages),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Expo push failed ${response.status}: ${text}`);
  }

  return { sent: tokens.length };
}

async function processShipmentCreatedEvent({ eventId, event }) {
  const channels = event.channels || {};
  const result = {};

  if (channels.inApp === true) {
    result.inApp = await writeInAppNotifications({ eventId, event });
  }

  if (channels.sms === true) {
    result.sms = await sendShipmentCreatedSmsLogic({
      shipmentId: event.shipmentId,
      ...getTargetPhones(event.targets),
      status: event.data?.status || "RECEIVED",
      origin: event.data?.origin,
      destination: event.data?.destination,
      actorUid: event.actor?.uid,
      actorName: event.actor?.name,
      actorRole: event.actor?.role,
      actorId: event.actor?.id,
    });
  }

  if (channels.email === true) {
    result.email = await sendShipmentCreatedEmail({ event });
  }

  if (channels.push === true) {
    result.push = await sendExpoPushNotifications({ event });
  }

  return result;
}

async function processShipmentStatusUpdatedEvent({ eventId, event }) {
  const channels = event.channels || {};
  const result = {};

  if (channels.inApp === true) {
    result.inApp = await writeInAppNotifications({ eventId, event });
  }

  if (channels.sms === true) {
    result.sms = await sendShipmentCreatedSmsLogic({
      shipmentId: event.shipmentId,
      ...getTargetPhones(event.targets),
      status: event.data?.status || "UPDATED",
      origin: event.data?.origin,
      destination: event.data?.destination,
      actorUid: event.actor?.uid,
      actorName: event.actor?.name,
      actorRole: event.actor?.role,
      actorId: event.actor?.id,
      customMessage: event.smsBody || event.body,
    });
  }

  if (channels.push === true) {
    result.push = await sendExpoPushNotifications({ event });
  }

  if (channels.email === true) {
    result.email = await sendShipmentCreatedEmail({ event });
  }

  return result;
}

async function processTripDelayEvent({ eventId, event }) {
  const channels = event.channels || {};
  const result = {};

  if (channels.inApp === true) {
    result.inApp = await writeInAppNotifications({ eventId, event });
  }

  if (channels.email === true) {
    result.email = await sendShipmentCreatedEmail({ event });
  }

  if (channels.push === true) {
    result.push = await sendExpoPushNotifications({ event });
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
