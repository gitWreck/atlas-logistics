"use strict";

const admin = require("firebase-admin");
const nodemailer = require("nodemailer");
const { defineSecret } = require("firebase-functions/params");
const { FieldValue } = require("firebase-admin/firestore");
const { sendSmsViaProvider } = require("../../shared/sms-service");
const { requireNormalizedPhone } = require("../utilities/phoneHelpers");
const { unique } = require("../utilities/helpers");
const { getShipmentOwnerUserIds } = require("../utilities/customerShipmentAccess");
const {
  CUSTOMER_NOTIFICATION_TYPES,
  resolveTripCustomerNotificationType,
  shouldBlockCustomerNotification,
} = require("./customerNotificationTypes");
const {
  buildCustomerEmailContent,
  buildCustomerPushBody,
  buildCustomerSmsMessage,
} = require("./customerNotificationMessages");

const SMTP_EMAIL = defineSecret("SMTP_EMAIL");
const SMTP_PASSWORD = defineSecret("SMTP_PASSWORD");

const NO_TRIP_SCOPE = "_NO_TRIP_";

function buildDedupKey({ customerId, tripId, notificationType, channel }) {
  const safe = (value, fallback) =>
    String(value || fallback)
      .trim()
      .replace(/[^A-Za-z0-9_-]/g, "_")
      .toUpperCase();

  return [
    safe(customerId, "UNKNOWN"),
    safe(tripId, NO_TRIP_SCOPE),
    safe(notificationType, "UNKNOWN"),
    safe(channel, "SMS"),
  ].join("_");
}

function resolveCustomerIdentity(shipment = {}) {
  const uid =
    shipment.recipient?.uid ||
    shipment.recipientUid ||
    shipment.customerId ||
    shipment.sender?.uid ||
    shipment.senderUid ||
    null;

  const phone = requireNormalizedPhone(
    shipment.recipient?.phone ||
      shipment.recipientPhone ||
      shipment.consigneePhone ||
      shipment.customerPhone ||
      shipment.sender?.phone ||
      shipment.senderPhone,
  );

  const email = String(
    shipment.recipient?.email ||
      shipment.recipientEmail ||
      shipment.sender?.email ||
      shipment.senderEmail ||
      "",
  )
    .trim()
    .toLowerCase();

  const customerId = uid
    ? `UID_${uid}`
    : phone
      ? `PHONE_${phone}`
      : email
        ? `EMAIL_${email.replace(/[^a-z0-9]/g, "_")}`
        : null;

  return {
    customerId,
    uid: uid ? String(uid) : null,
    phone,
    email: email || null,
    name:
      shipment.recipient?.name ||
      shipment.recipientName ||
      shipment.sender?.name ||
      shipment.senderName ||
      "Customer",
  };
}

function groupShipmentsByCustomer(shipments = []) {
  const groups = new Map();

  shipments.forEach((shipment) => {
    const identity = resolveCustomerIdentity(shipment);
    if (!identity.customerId) return;

    const existing = groups.get(identity.customerId) || {
      ...identity,
      shipmentIds: [],
      shipments: [],
    };

    const shipmentId = String(shipment.id || shipment.shipmentId || "").trim();
    if (shipmentId && !existing.shipmentIds.includes(shipmentId)) {
      existing.shipmentIds.push(shipmentId);
    }
    existing.shipments.push(shipment);
    groups.set(identity.customerId, existing);
  });

  return [...groups.values()];
}

async function loadTripShipments(db, tripId) {
  const [currentTripSnap, currentTruckTripSnap] = await Promise.all([
    db.collection("shipments").where("currentTripId", "==", tripId).get(),
    db.collection("shipments").where("currentTruckTripId", "==", tripId).get(),
  ]);

  const shipmentMap = new Map();
  currentTripSnap.docs.forEach((doc) =>
    shipmentMap.set(doc.id, { id: doc.id, ...doc.data() }),
  );
  currentTruckTripSnap.docs.forEach((doc) =>
    shipmentMap.set(doc.id, { id: doc.id, ...doc.data() }),
  );

  return [...shipmentMap.values()];
}

async function claimNotificationLog(db, dedupKey, payload) {
  const ref = db.collection("notificationLogs").doc(dedupKey);

  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (snap.exists) {
      const status = String(snap.data()?.status || "").toLowerCase();
      if (status === "sent" || status === "pending") {
        return { claimed: false, reason: "duplicate", ref };
      }
      if (status === "failed" && payload.allowRetry !== true) {
        return { claimed: false, reason: "failed_exists", ref };
      }
    }

    tx.set(
      ref,
      {
        ...payload,
        status: "pending",
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );

    return { claimed: true, ref };
  });
}

async function markNotificationLog(ref, status, extra = {}) {
  await ref.update({
    status,
    ...extra,
    updatedAt: FieldValue.serverTimestamp(),
    ...(status === "sent" ? { sentAt: FieldValue.serverTimestamp() } : {}),
    ...(status === "failed" ? { failedAt: FieldValue.serverTimestamp() } : {}),
  });
}

async function getExpoPushTokens(db, userIds = []) {
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

async function sendExpoPush({ tokens, title, body, data = {} }) {
  if (!tokens.length) return { sent: 0, skipped: true };

  const messages = tokens.map((to) => ({
    to,
    sound: "default",
    title,
    body,
    data,
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

async function sendEmail({ to, subject, text, html }) {
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: SMTP_EMAIL.value(),
      pass: SMTP_PASSWORD.value(),
    },
  });

  await transporter.sendMail({ to, subject, text, html });
  return { sent: 1 };
}

async function deliverChannel({
  db,
  channel,
  dedupKey,
  group,
  tripId,
  notificationType,
  customSmsMessage = null,
  customEmail = null,
  customPush = null,
  actor = {},
  source = "SYSTEM",
  allowRetry = false,
}) {
  const claim = await claimNotificationLog(db, dedupKey, {
    customerId: group.customerId,
    customerPhone: group.phone || null,
    customerEmail: group.email || null,
    tripId: tripId || NO_TRIP_SCOPE,
    notificationType,
    channel,
    shipmentCount: group.shipmentIds.length,
    shipmentIds: group.shipmentIds,
    createdBy: actor.uid || actor.id || "SYSTEM",
    source,
    allowRetry,
  });

  if (!claim.claimed) {
    return { channel, skipped: true, reason: claim.reason };
  }

  const shipmentCount = group.shipmentIds.length;
  const smsMessage =
    customSmsMessage || buildCustomerSmsMessage(notificationType, shipmentCount);
  const emailContent =
    customEmail ||
    buildCustomerEmailContent({
      notificationType,
      shipmentCount,
      shipmentIds: group.shipmentIds,
      tripId,
    });
  const pushBody =
    customPush ||
    buildCustomerPushBody(notificationType, shipmentCount, group.shipmentIds);

  try {
    if (channel === "SMS") {
      if (!group.phone) {
        await markNotificationLog(claim.ref, "failed", {
          error: "No valid phone",
        });
        return { channel, skipped: true, reason: "no_phone" };
      }
      if (!smsMessage) {
        await markNotificationLog(claim.ref, "failed", {
          error: "No SMS template",
        });
        return { channel, skipped: true, reason: "no_template" };
      }
      await sendSmsViaProvider({ phone: group.phone, message: smsMessage });
    } else if (channel === "EMAIL") {
      if (!group.email) {
        await markNotificationLog(claim.ref, "failed", {
          error: "No valid email",
        });
        return { channel, skipped: true, reason: "no_email" };
      }
      await sendEmail({
        to: group.email,
        subject: emailContent.subject,
        text: emailContent.text,
        html: emailContent.html,
      });
    } else if (channel === "PUSH") {
      const targetUserIds = unique([
        ...(group.uid ? [group.uid] : []),
        ...group.shipments.flatMap(getShipmentOwnerUserIds),
      ]);
      const tokens = await getExpoPushTokens(db, targetUserIds);
      if (!tokens.length) {
        await markNotificationLog(claim.ref, "failed", {
          error: "No push tokens",
        });
        return { channel, skipped: true, reason: "no_push_tokens" };
      }
      await sendExpoPush({
        tokens,
        title: "Atlas Transport",
        body: pushBody,
        data: {
          screen: "tracking",
          tripId: tripId || null,
          notificationType,
          shipmentIds: group.shipmentIds,
        },
      });
    }

    await markNotificationLog(claim.ref, "sent");
    return { channel, sent: true };
  } catch (error) {
    await markNotificationLog(claim.ref, "failed", {
      error: error?.message || String(error),
    });
    return { channel, failed: true, error: error?.message || String(error) };
  }
}

async function sendTripCustomerNotifications({
  db,
  tripId,
  notificationType,
  channels = { sms: true, email: false, push: true },
  actor = {},
  source = "TRIP_STATUS",
  customSmsMessage = null,
  customEmail = null,
  customPush = null,
  allowRetry = false,
}) {
  if (!tripId || !notificationType) {
    return { success: true, sent: 0, skipped: true, reason: "missing_args" };
  }

  const shipments = await loadTripShipments(db, tripId);
  if (!shipments.length) {
    return { success: true, sent: 0, skipped: true, reason: "no_shipments" };
  }

  const groups = groupShipmentsByCustomer(shipments);
  const results = [];

  for (const group of groups) {
    const channelJobs = [];

    if (channels.sms === true) {
      channelJobs.push(
        deliverChannel({
          db,
          channel: "SMS",
          dedupKey: buildDedupKey({
            customerId: group.customerId,
            tripId,
            notificationType,
            channel: "SMS",
          }),
          group,
          tripId,
          notificationType,
          customSmsMessage,
          actor,
          source,
          allowRetry,
        }),
      );
    }

    if (channels.email === true) {
      channelJobs.push(
        deliverChannel({
          db,
          channel: "EMAIL",
          dedupKey: buildDedupKey({
            customerId: group.customerId,
            tripId,
            notificationType,
            channel: "EMAIL",
          }),
          group,
          tripId,
          notificationType,
          customEmail,
          actor,
          source,
          allowRetry,
        }),
      );
    }

    if (channels.push === true) {
      channelJobs.push(
        deliverChannel({
          db,
          channel: "PUSH",
          dedupKey: buildDedupKey({
            customerId: group.customerId,
            tripId,
            notificationType,
            channel: "PUSH",
          }),
          group,
          tripId,
          notificationType,
          customPush,
          actor,
          source,
          allowRetry,
        }),
      );
    }

    const channelResults = await Promise.all(channelJobs);
    results.push({ customerId: group.customerId, channelResults });
  }

  const sentCount = results.reduce(
    (sum, entry) =>
      sum +
      entry.channelResults.filter((result) => result.sent === true).length,
    0,
  );

  return { success: true, customers: groups.length, sent: sentCount, results };
}

async function sendShipmentCustomerNotification({
  db,
  shipment,
  shipmentId,
  notificationType,
  channels = { sms: true, email: false, push: true },
  actor = {},
  source = "SHIPMENT_STATUS",
  tripId = null,
}) {
  const scopedTripId =
    tripId ||
    shipment.currentTripId ||
    shipment.currentTruckTripId ||
    NO_TRIP_SCOPE;

  if (scopedTripId && scopedTripId !== NO_TRIP_SCOPE) {
    return sendTripCustomerNotifications({
      db,
      tripId: scopedTripId,
      notificationType,
      channels,
      actor,
      source,
    });
  }

  const group = groupShipmentsByCustomer([
    { id: shipmentId, ...shipment },
  ])[0];

  if (!group) {
    return { success: true, sent: 0, skipped: true, reason: "no_customer" };
  }

  const channelResults = await Promise.all(
    [
      channels.sms === true ? "SMS" : null,
      channels.email === true ? "EMAIL" : null,
      channels.push === true ? "PUSH" : null,
    ]
      .filter(Boolean)
      .map((channel) =>
        deliverChannel({
          db,
          channel,
          dedupKey: buildDedupKey({
            customerId: group.customerId,
            tripId: scopedTripId,
            notificationType,
            channel,
          }),
          group,
          tripId: scopedTripId,
          notificationType,
          actor,
          source,
        }),
      ),
  );

  return {
    success: true,
    sent: channelResults.filter((result) => result.sent === true).length,
    results: channelResults,
  };
}

async function sendTripStatusCustomerNotifications({
  db,
  tripId,
  oldStatus,
  newStatus,
  notify = false,
  promotionSource = "",
  source = "TRIP_STATUS",
  channels = { sms: true, email: false, push: true },
  actor = {},
}) {
  const previous = String(oldStatus || "").toUpperCase();
  const next = String(newStatus || "").toUpperCase();

  if (previous === next) {
    return { success: true, skipped: true, reason: "status_unchanged" };
  }

  if (
    shouldBlockCustomerNotification({
      notify,
      source,
      promotionSource,
    })
  ) {
    return { success: true, skipped: true, reason: "blocked_source" };
  }

  const notificationType = resolveTripCustomerNotificationType(next);
  if (!notificationType) {
    return { success: true, skipped: true, reason: "non_customer_status" };
  }

  return sendTripCustomerNotifications({
    db,
    tripId,
    notificationType,
    channels,
    actor,
    source,
  });
}

module.exports = {
  NO_TRIP_SCOPE,
  buildDedupKey,
  groupShipmentsByCustomer,
  loadTripShipments,
  resolveCustomerIdentity,
  sendShipmentCustomerNotification,
  sendTripCustomerNotifications,
  sendTripStatusCustomerNotifications,
  CUSTOMER_NOTIFICATION_TYPES,
};
