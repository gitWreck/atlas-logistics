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
  resolveLifecycleCustomerChannels,
} = require("../utilities/notificationHelpers");
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

async function enrichGroupContact(db, group = {}) {
  let phone = group.phone || null;
  let email = group.email || null;

  if (group.uid) {
    const userSnap = await db.collection("users").doc(String(group.uid)).get();
    if (userSnap.exists) {
      const user = userSnap.data() || {};
      phone =
        phone ||
        requireNormalizedPhone(user.phoneNumber || user.phone || user.mobile || "");
      email =
        email || String(user.email || "").trim().toLowerCase() || null;
    }
  }

  return {
    ...group,
    phone: phone || null,
    email: email || null,
  };
}

function isRetriableNotificationFailure(error = "") {
  const text = String(error || "").toLowerCase();
  return (
    text.includes("no valid email") ||
    text.includes("no valid phone") ||
    text.includes("no push tokens") ||
    text.includes("no sms template")
  );
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
  const shipmentMap = new Map();
  const addDoc = (doc) => {
    if (!doc?.exists) return;
    shipmentMap.set(doc.id, { id: doc.id, ...doc.data() });
  };

  const [currentTripSnap, currentTruckTripSnap, tripShipSnap, tripIdsArraySnap] =
    await Promise.all([
      db.collection("shipments").where("currentTripId", "==", tripId).get(),
      db
        .collection("shipments")
        .where("currentTruckTripId", "==", tripId)
        .get(),
      db
        .collection("truck_trips")
        .doc(tripId)
        .collection("trip_shipments")
        .get()
        .catch(() => ({ docs: [] })),
      db
        .collection("shipments")
        .where("currentTripIds", "array-contains", tripId)
        .get()
        .catch(() => ({ docs: [] })),
    ]);

  currentTripSnap.docs.forEach(addDoc);
  currentTruckTripSnap.docs.forEach(addDoc);
  tripIdsArraySnap.docs.forEach(addDoc);

  const manifestShipmentIds = tripShipSnap.docs
    .map((doc) => doc.id)
    .filter((id) => !shipmentMap.has(id));

  if (manifestShipmentIds.length) {
    const shipmentSnaps = await Promise.all(
      manifestShipmentIds.map((id) => db.collection("shipments").doc(id).get()),
    );
    shipmentSnaps.forEach(addDoc);
  }

  return [...shipmentMap.values()];
}

async function claimNotificationLog(db, dedupKey, payload) {
  const ref = db.collection("notificationLogs").doc(dedupKey);

  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (snap.exists) {
      const existing = snap.data() || {};
      const status = String(existing.status || "").toLowerCase();
      if (status === "sent") {
        return { claimed: false, reason: "duplicate", ref };
      }
      if (status === "pending" || status === "queued") {
        const updatedAt =
          existing.updatedAt?.toDate?.() || existing.createdAt?.toDate?.();
        const staleMs = 5 * 60 * 1000;
        const isStale =
          updatedAt instanceof Date &&
          Date.now() - updatedAt.getTime() > staleMs;
        if (!isStale) {
          return { claimed: false, reason: "duplicate", ref };
        }
      }
      if (status === "failed") {
        const canRetry =
          payload.allowRetry === true ||
          isRetriableNotificationFailure(existing.error);
        if (!canRetry) {
          return { claimed: false, reason: "failed_exists", ref };
        }
      }
    }

    tx.set(
      ref,
      {
        ...payload,
        messageBody: payload.messageBody || null,
        status: "pending",
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );

    return { claimed: true, ref };
  });
}

function resolveSmsLogStatus(providerStatus = "") {
  const status = String(providerStatus || "").toLowerCase();
  if (status === "sent") return "sent";
  if (status === "queued" || status === "pending") return "queued";
  return "queued";
}

async function markNotificationLog(ref, status, extra = {}) {
  await ref.update({
    status,
    ...extra,
    updatedAt: FieldValue.serverTimestamp(),
    ...(status === "sent" ? { sentAt: FieldValue.serverTimestamp() } : {}),
    ...(status === "queued" ? { queuedAt: FieldValue.serverTimestamp() } : {}),
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
  const contact =
    channel === "SMS" || channel === "EMAIL"
      ? await enrichGroupContact(db, group)
      : group;

  const claim = await claimNotificationLog(db, dedupKey, {
    customerId: contact.customerId,
    customerPhone: contact.phone || null,
    customerEmail: contact.email || group.email || null,
    tripId: tripId || NO_TRIP_SCOPE,
    notificationType,
    channel,
    shipmentCount: group.shipmentIds.length,
    shipmentIds: group.shipmentIds,
    createdBy: actor.uid || actor.id || "SYSTEM",
    source,
    allowRetry,
    messageBody: customSmsMessage || customPush || null,
  });

  if (!claim.claimed) {
    return { channel, skipped: true, reason: claim.reason };
  }

  const shipmentCount = group.shipmentIds.length;
  const smsMessage =
    customSmsMessage || buildCustomerSmsMessage(notificationType, shipmentCount);
  const emailContent =
    customEmail ||
    (await buildCustomerEmailContent({
      db,
      notificationType,
      shipmentCount,
      shipmentIds: group.shipmentIds,
      tripId,
      customerName: contact.name || group.name || "Customer",
      shipments: group.shipments,
    }));
  const pushBody =
    customPush ||
    buildCustomerPushBody(notificationType, shipmentCount, group.shipmentIds);

  try {
    if (channel === "SMS") {
      if (!contact.phone) {
        await markNotificationLog(claim.ref, "failed", {
          error: "No valid phone on shipment or user profile",
        });
        return { channel, skipped: true, reason: "no_phone" };
      }
      if (!smsMessage) {
        await markNotificationLog(claim.ref, "failed", {
          error: "No SMS template",
        });
        return { channel, skipped: true, reason: "no_template" };
      }
      const providerResult = await sendSmsViaProvider({
        phone: contact.phone,
        message: smsMessage,
      });
      const logStatus = resolveSmsLogStatus(providerResult.status);
      await markNotificationLog(claim.ref, logStatus, {
        provider: "semaphore",
        providerMessageId: providerResult.messageId || null,
        providerStatus: providerResult.status || null,
        providerNetwork: providerResult.network || null,
        providerRecipient: providerResult.recipient || null,
        providerSenderName: providerResult.senderName || null,
      });

      if (logStatus === "queued") {
        return {
          channel,
          queued: true,
          providerStatus: providerResult.status,
          providerMessageId: providerResult.messageId,
        };
      }

      return { channel, sent: true, providerMessageId: providerResult.messageId };
    } else if (channel === "EMAIL") {
      if (!contact.email) {
        await markNotificationLog(claim.ref, "failed", {
          error: "No valid email",
        });
        return { channel, skipped: true, reason: "no_email" };
      }
      await sendEmail({
        to: contact.email,
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
  shipments: providedShipments = null,
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

  const shipments =
    Array.isArray(providedShipments) && providedShipments.length
      ? providedShipments
      : await loadTripShipments(db, tripId);
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

async function sendAutomaticTripLifecycleNotification({
  db,
  tripId,
  notificationType,
  shipments = null,
  source = "TRIP_LIFECYCLE",
  channels = null,
  actor = {},
}) {
  if (!tripId || !notificationType) {
    return { success: true, skipped: true, reason: "missing_args" };
  }

  if (
    shouldBlockCustomerNotification({
      notify: true,
      source,
    })
  ) {
    return { success: true, skipped: true, reason: "blocked_source" };
  }

  const manifestShipments =
    Array.isArray(shipments) && shipments.length
      ? shipments
      : await loadTripShipments(db, tripId);

  if (!manifestShipments.length) {
    return { success: true, sent: 0, skipped: true, reason: "no_shipments" };
  }

  const results = await Promise.all(
    manifestShipments.map((shipment) => {
      const shipmentId = String(shipment.id || shipment.shipmentId || "").trim();
      if (!shipmentId) {
        return Promise.resolve({
          success: true,
          sent: 0,
          skipped: true,
          reason: "no_id",
        });
      }

      return sendAutomaticShipmentLifecycleNotification({
        db,
        shipment,
        shipmentId,
        tripId,
        notificationType,
        source,
        channels,
        actor,
      });
    }),
  );

  const sent = results.reduce((sum, result) => sum + (Number(result.sent) || 0), 0);
  const queued = results.reduce(
    (sum, result) => sum + (Number(result.queued) || 0),
    0,
  );

  return {
    success: true,
    customers: results.length,
    sent,
    queued,
    results,
  };
}

async function sendAutomaticShipmentLifecycleNotification({
  db,
  shipment,
  shipmentId,
  notificationType,
  tripId = null,
  source = "SHIPMENT_LIFECYCLE",
  channels = null,
  actor = {},
}) {
  if (!shipmentId || !notificationType) {
    return { success: true, skipped: true, reason: "missing_args" };
  }

  if (
    shouldBlockCustomerNotification({
      notify: true,
      source,
    })
  ) {
    return { success: true, skipped: true, reason: "blocked_source" };
  }

  let shipmentRecord = { id: shipmentId, ...(shipment || {}) };
  try {
    const shipmentSnap = await db.collection("shipments").doc(shipmentId).get();
    if (shipmentSnap.exists) {
      shipmentRecord = { id: shipmentId, ...shipmentSnap.data() };
    }
  } catch (reloadError) {
    console.warn(
      "[sendAutomaticShipmentLifecycleNotification] Shipment reload failed:",
      reloadError,
    );
  }

  const resolvedChannels = resolveLifecycleCustomerChannels(
    shipmentRecord,
    channels,
  );

  const scopedTripId =
    tripId ||
    shipmentRecord.currentTripId ||
    shipmentRecord.currentTruckTripId ||
    NO_TRIP_SCOPE;
  const dedupNotificationType = `${notificationType}__${shipmentId}`;
  const groups = collectShipmentCustomerGroups(shipmentRecord, shipmentId);

  if (!groups.length) {
    return { success: true, sent: 0, skipped: true, reason: "no_customer" };
  }

  const results = [];

  for (const group of groups) {
    const contact = await enrichGroupContact(db, group);
    const groupChannels = {
      sms: resolvedChannels.sms === true && !!contact.phone,
      email: resolvedChannels.email === true && !!contact.email,
      push: resolvedChannels.push === true,
    };

    if (!groupChannels.sms && !groupChannels.email && !groupChannels.push) {
      results.push({
        customerId: group.customerId,
        skipped: true,
        reason: "no_contact_for_enabled_channels",
        channelResults: [],
      });
      continue;
    }

    const shipmentCount = Math.max(group.shipmentIds.length, 1);
    const customSmsMessage = buildCustomerSmsMessage(
      notificationType,
      shipmentCount,
    );
    const customEmail = await buildCustomerEmailContent({
      db,
      notificationType,
      shipmentCount,
      shipmentIds: group.shipmentIds,
      tripId: scopedTripId === NO_TRIP_SCOPE ? null : scopedTripId,
      customerName: contact.name || group.name || "Customer",
      shipments: group.shipments,
    });
    const customPush = buildCustomerPushBody(
      notificationType,
      shipmentCount,
      group.shipmentIds,
    );

    const channelResults = await Promise.all(
      [
        groupChannels.sms ? "SMS" : null,
        groupChannels.email ? "EMAIL" : null,
        groupChannels.push ? "PUSH" : null,
      ]
        .filter(Boolean)
        .map((channel) =>
          deliverChannel({
            db,
            channel,
            dedupKey: buildDedupKey({
              customerId: group.customerId,
              tripId: scopedTripId,
              notificationType: dedupNotificationType,
              channel,
            }),
            group: contact,
            tripId: scopedTripId,
            notificationType,
            customSmsMessage,
            customEmail,
            customPush,
            actor,
            source,
          }),
        ),
    );

    results.push({ customerId: group.customerId, channelResults });
  }

  return {
    success: true,
    customers: groups.length,
    sent: results.reduce(
      (sum, entry) =>
        sum +
        (entry.channelResults || []).filter((result) => result.sent === true)
          .length,
      0,
    ),
    queued: results.reduce(
      (sum, entry) =>
        sum +
        (entry.channelResults || []).filter((result) => result.queued === true)
          .length,
      0,
    ),
    results,
  };
}

function buildCustomerGroup({
  phone = null,
  email = null,
  uid = null,
  name = "Customer",
  shipmentId = null,
  shipmentIds = [],
}) {
  const shipment = {
    recipient: { phone, email, uid, name },
  };
  const identity = resolveCustomerIdentity(shipment);
  if (!identity.customerId) return null;

  const ids = [
    ...(Array.isArray(shipmentIds) ? shipmentIds : []),
    ...(shipmentId ? [shipmentId] : []),
  ].filter(Boolean);

  return {
    ...identity,
    shipmentIds: [...new Set(ids.map(String))],
    shipments: shipmentId ? [{ id: shipmentId, ...shipment }] : [],
  };
}

async function sendDirectCustomerNotification({
  db,
  phone = null,
  email = null,
  uid = null,
  name = "Customer",
  tripId = null,
  shipmentId = null,
  shipmentIds = [],
  notificationType,
  channels = { sms: true, email: false, push: false },
  customSmsMessage = null,
  customEmail = null,
  customPush = null,
  actor = {},
  source = "DIRECT",
  allowRetry = false,
  skipDedup = false,
}) {
  const group = buildCustomerGroup({
    phone,
    email,
    uid,
    name,
    shipmentId,
    shipmentIds,
  });

  if (!group) {
    return { success: true, sent: 0, skipped: true, reason: "no_customer" };
  }

  const scopedTripId = tripId || NO_TRIP_SCOPE;

  if (skipDedup && channels.sms === true && group.phone && customSmsMessage) {
    try {
      await sendSmsViaProvider({ phone: group.phone, message: customSmsMessage });
      return { success: true, sent: 1, skippedDedup: true };
    } catch (error) {
      return {
        success: false,
        sent: 0,
        error: error?.message || String(error),
      };
    }
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
          customSmsMessage,
          customEmail,
          customPush,
          actor,
          source,
          allowRetry,
        }),
      ),
  );

  return {
    success: true,
    sent: channelResults.filter((result) => result.sent === true).length,
    results: channelResults,
  };
}

async function retryNotificationLog({ db, dedupKey, actor = {} }) {
  const ref = db.collection("notificationLogs").doc(String(dedupKey || "").trim());
  const snap = await ref.get();

  if (!snap.exists) {
    return { success: false, reason: "not_found" };
  }

  const log = snap.data() || {};
  const status = String(log.status || "").toLowerCase();

  if (status !== "failed") {
    return { success: true, skipped: true, reason: "not_failed" };
  }

  const uid =
    log.customerId && String(log.customerId).startsWith("UID_")
      ? String(log.customerId).slice(4)
      : null;

  const group = buildCustomerGroup({
    phone: log.customerPhone,
    email: log.customerEmail,
    uid,
    shipmentIds: log.shipmentIds || [],
  });

  if (!group) {
    return { success: false, reason: "no_customer" };
  }

  const channel = String(log.channel || "SMS").toUpperCase();
  const customSmsMessage =
    channel === "SMS" ? log.messageBody || null : null;
  const customPush = channel === "PUSH" ? log.messageBody || null : null;
  const customEmail =
    channel === "EMAIL" && log.messageBody
      ? {
          subject: "Atlas Transport update",
          text: log.messageBody,
          html: `<p>${log.messageBody}</p>`,
        }
      : null;

  return deliverChannel({
    db,
    channel,
    dedupKey,
    group,
    tripId: log.tripId || NO_TRIP_SCOPE,
    notificationType: log.notificationType,
    customSmsMessage,
    customEmail,
    customPush,
    actor,
    source: "RETRY",
    allowRetry: true,
  });
}

function uniqueCustomerGroups(parties = [], shipmentId = null) {
  const groups = [];
  const seen = new Set();

  parties.forEach((party) => {
    const group = buildCustomerGroup({
      phone: party.phone,
      email: party.email,
      uid: party.uid,
      name: party.name,
      shipmentId,
    });
    if (!group || seen.has(group.customerId)) return;
    seen.add(group.customerId);
    groups.push(group);
  });

  return groups;
}

function collectShipmentCustomerGroups(shipment = {}, shipmentId = null) {
  const sender = shipment.sender || {};
  const recipient = shipment.recipient || {};
  const resolvedShipmentId = String(
    shipmentId || shipment.id || shipment.shipmentId || "",
  ).trim();
  const shipmentRecord = {
    ...(resolvedShipmentId ? { id: resolvedShipmentId } : {}),
    ...shipment,
  };

  return uniqueCustomerGroups(
    [
      {
        phone: sender.phone,
        email: sender.email,
        uid: sender.uid,
        name: sender.name || "Customer",
      },
      {
        phone: recipient.phone,
        email: recipient.email,
        uid: recipient.uid,
        name: recipient.name || "Customer",
      },
    ],
    resolvedShipmentId || null,
  ).map((group) => ({
    ...group,
    shipments: [shipmentRecord],
  }));
}

async function sendShipmentCreatedCustomerNotifications({
  db,
  shipmentId,
  sender = {},
  recipient = {},
  channels = { sms: true, email: false, push: true },
  actor = {},
  tripId = null,
}) {
  const groups = uniqueCustomerGroups(
    [
      {
        phone: sender.phone,
        email: sender.email,
        uid: sender.uid,
        name: sender.name,
      },
      {
        phone: recipient.phone,
        email: recipient.email,
        uid: recipient.uid,
        name: recipient.name,
      },
    ],
    shipmentId,
  );

  if (!groups.length) {
    return { success: true, sent: 0, skipped: true, reason: "no_customer" };
  }

  const scopedTripId = tripId || NO_TRIP_SCOPE;
  const messageNotificationType =
    CUSTOMER_NOTIFICATION_TYPES.RECEIVED_AT_DIVISORIA;
  const dedupNotificationType = `${messageNotificationType}__${shipmentId}`;
  const results = [];

  for (const group of groups) {
    const shipmentCount = Math.max(group.shipmentIds.length, 1);
    const customSmsMessage = buildCustomerSmsMessage(
      messageNotificationType,
      shipmentCount,
    );
    const customEmail = await buildCustomerEmailContent({
      db,
      notificationType: messageNotificationType,
      shipmentCount,
      shipmentIds: group.shipmentIds,
      tripId: scopedTripId === NO_TRIP_SCOPE ? null : scopedTripId,
      customerName: group.name || "Customer",
      shipments: group.shipments,
    });
    const customPush = buildCustomerPushBody(
      messageNotificationType,
      shipmentCount,
      group.shipmentIds,
    );

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
              notificationType: dedupNotificationType,
              channel,
            }),
            group,
            tripId: scopedTripId,
            notificationType: messageNotificationType,
            customSmsMessage,
            customEmail,
            customPush,
            actor,
            source: "SHIPMENT_CREATED",
          }),
        ),
    );
    results.push({ customerId: group.customerId, channelResults });
  }

  const sent = results.reduce(
    (sum, entry) =>
      sum +
      entry.channelResults.filter((result) => result.sent === true).length,
    0,
  );

  return { success: true, customers: groups.length, sent, results };
}

module.exports = {
  NO_TRIP_SCOPE,
  buildDedupKey,
  buildCustomerGroup,
  collectShipmentCustomerGroups,
  groupShipmentsByCustomer,
  loadTripShipments,
  resolveCustomerIdentity,
  retryNotificationLog,
  sendDirectCustomerNotification,
  sendShipmentCreatedCustomerNotifications,
  sendShipmentCustomerNotification,
  sendTripCustomerNotifications,
  sendTripStatusCustomerNotifications,
  sendAutomaticTripLifecycleNotification,
  sendAutomaticShipmentLifecycleNotification,
  CUSTOMER_NOTIFICATION_TYPES,
};
