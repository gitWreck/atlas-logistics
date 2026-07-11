"use strict";

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const { requireAuth, requireRole } = require("../utilities/helpers");
const { customerOwnsShipment } = require("../utilities/customerShipmentAccess");
const {
  TRTC_SDK_APP_ID,
  TRTC_SECRET_KEY,
  getRtcSecretConfig,
} = require("./trtcConfig");
const { assertDirectConversationAccess } = require("./checkerMessaging");

if (!admin.apps.length) admin.initializeApp();

const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;

const STAFF_ROLES = ["admin", "manager", "employee"];
const STAFF_MONITOR_ROLES = ["admin", "manager", "employee"];
const VALID_STATUSES = ["unassigned", "active", "closed"];
const VALID_PRIORITIES = ["normal", "urgent"];
const CALL_TYPES = ["voice", "video"];
const ACTIVE_CALL_STATUSES = [
  "ringing",
  "connecting",
  "accepted",
  "connected",
  "ongoing",
];
const CALL_STATUSES = [
  "ringing",
  "connecting",
  "accepted",
  "connected",
  "declined",
  "missed",
  "busy",
  "cancelled",
  "timeout",
  "ended",
];
const TERMINAL_CALL_STATUSES = ["ended", "declined", "missed", "busy", "cancelled", "timeout"];

async function assertUsersAvailableForCall(callerId, receiverId) {
  const lookups = [];
  for (const participantId of [callerId, receiverId]) {
    lookups.push(
      db
        .collection("calls")
        .where("status", "in", ACTIVE_CALL_STATUSES)
        .where("callerId", "==", participantId)
        .limit(1)
        .get(),
      db
        .collection("calls")
        .where("status", "in", ACTIVE_CALL_STATUSES)
        .where("receiverId", "==", participantId)
        .limit(1)
        .get(),
    );
  }

  const snapshots = await Promise.all(lookups);
  if (snapshots.some((snapshot) => !snapshot.empty)) {
    throw new HttpsError("already-exists", "One of you is already on another call.");
  }
}

async function createRingingConversationCall({
  conversationId,
  callType,
  callerId,
  callerRole,
  callerName,
  receiverId,
  receiverRole,
  participantIds,
  extraFields = {},
}) {
  await assertUsersAvailableForCall(callerId, receiverId);

  const callRef = db.collection("calls").doc();
  const now = FieldValue.serverTimestamp();
  const rtcRoomId = `atlas_${callRef.id}`;
  const rtcConfig = getRtcSecretConfig();

  await callRef.set({
    callId: callRef.id,
    conversationId,
    callerId,
    callerRole,
    callerName,
    receiverId,
    receiverRole,
    participantIds: [...new Set(participantIds || [callerId, receiverId])],
    type: callType,
    status: "ringing",
    rtcRoomId,
    roomId: rtcRoomId,
    rtcProvider: "tencent",
    rtcConfigStatus: rtcConfig.isConfigured ? "configured" : "pending-setup",
    createdAt: now,
    startedAt: now,
    updatedAt: now,
    ...extraFields,
  });

  await notifyIncomingCall({
    callId: callRef.id,
    conversationId,
    receiverId,
    callerName,
    callType,
  });

  return {
    success: true,
    callId: callRef.id,
    conversationId,
    receiverId,
    rtcRoomId,
    roomId: rtcRoomId,
    status: "ringing",
  };
}

function cleanText(value, fieldName = "text", maxLength = 2000) {
  const text = String(value || "").trim();
  if (!text) {
    throw new HttpsError("invalid-argument", `${fieldName} is required.`);
  }
  if (text.length > maxLength) {
    throw new HttpsError(
      "invalid-argument",
      `${fieldName} must be ${maxLength} characters or less.`,
    );
  }
  return text;
}

function normalizeTracking(value) {
  const trackingNumber = String(value || "").trim().toUpperCase();
  return trackingNumber || null;
}

function normalizeConversationStatus(value) {
  const status = String(value || "").trim().toLowerCase();
  if (!status) return "unassigned";
  if (["open", "pending", "resolved", "active"].includes(status)) return "active";
  if (["closed", "archived"].includes(status)) return "closed";
  return status;
}

function displayName(user = {}, fallback = "User") {
  return (
    user.name ||
    user.displayName ||
    user.fullName ||
    user.email ||
    fallback
  );
}

function assignedStaffId(conversation = {}) {
  return conversation.assignedStaffId || conversation.assignedTo || null;
}

function assignedStaffName(conversation = {}) {
  return conversation.assignedStaffName || conversation.assignedToName || null;
}

function assignedStaffRole(conversation = {}) {
  return conversation.assignedStaffRole || conversation.assignedRole || null;
}

function isRedundantCompletedCallStatus(call = {}, text = "") {
  if (String(call.status || "").trim().toLowerCase() !== "ended") return false;

  const normalizedText = String(text || "")
    .replace(/[^a-z\s]/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

  return /^(?:(?:voice|video) call )?(?:call )?ended$/.test(normalizedText);
}

async function writeCallHistoryMessage({ conversationRef, conversationId, call, text, duration = 0 }) {
  const targetRef = conversationRef || db.collection("conversations").doc(conversationId);
  const messageText = String(text || "").trim();

  if (!messageText) {
    throw new HttpsError("invalid-argument", "Call history message text is required.");
  }

  const now = FieldValue.serverTimestamp();
  const callData = call || {};
  const senderId = String(callData.callerId || "").trim() || "system";
  const senderRole = String(callData.callerRole || "").trim() || "system";
  const senderName = String(callData.callerName || "").trim() || "Atlas";
  const messageRef = targetRef.collection("messages").doc();

  await db.runTransaction(async (tx) => {
    tx.set(messageRef, {
      messageId: messageRef.id,
      senderId,
      senderRole,
      senderName,
      type: "call",
      text: messageText,
      callId: String(callData.callId || callData.id || "").trim() || null,
      callType: callData.type || null,
      callerId: String(callData.callerId || "").trim() || null,
      receiverId: String(callData.receiverId || "").trim() || null,
      duration: Math.max(0, Number(duration || 0)),
      attachments: [],
      status: "sent",
      createdAt: now,
      readBy: {},
      seenBy: {},
    });

    tx.update(targetRef, {
      lastMessage: messageText,
      lastMessageText: messageText,
      lastActivityAt: now,
      lastMessageAt: now,
      lastMessageBy: senderId,
      updatedAt: now,
    });
  });
}

function staffAssignmentFields({ assigneeId, assigneeRole, assigneeName } = {}) {
  return {
    assignedStaffId: assigneeId || null,
    assignedStaffName: assigneeName || null,
    assignedStaffRole: assigneeRole || null,
    assignedTo: assigneeId || null,
    assignedToName: assigneeName || null,
    assignedRole: assigneeRole || null,
  };
}

async function getStaffUserIds() {
  const snaps = await Promise.all(
    STAFF_ROLES.map((role) =>
      db.collection("users").where("role", "==", role).get(),
    ),
  );

  const ids = new Set();
  snaps.forEach((snap) => {
    snap.docs.forEach((doc) => {
      const data = doc.data() || {};
      if (data.active !== false) ids.add(doc.id);
    });
  });

  return [...ids];
}

async function getConversationForUser(conversationId, uid, role) {
  const ref = db.collection("conversations").doc(conversationId);
  const snap = await ref.get();

  if (!snap.exists) {
    throw new HttpsError("not-found", "Conversation not found.");
  }

  const conversation = snap.data() || {};
  const normalizedRole = String(role || "").toLowerCase();
  if (conversation.type === "direct_staff") {
    const userSnap = await db.collection("users").doc(uid).get();
    const allowed = await assertDirectConversationAccess(
      conversation,
      uid,
      userSnap.data() || { role: normalizedRole },
    );
    if (!allowed) {
      throw new HttpsError(
        "permission-denied",
        "This staff conversation is outside your current assignment.",
      );
    }
    return { ref, snap, conversation };
  }
  const isAdmin = normalizedRole === "admin";
  const isManager = normalizedRole === "manager";
  const isEmployee = normalizedRole === "employee";
  const isCustomer = conversation.customerId === uid;
  const isAssigned = assignedStaffId(conversation) === uid;

  if (!(isAdmin || isManager || isCustomer || (isEmployee && isAssigned))) {
    throw new HttpsError("permission-denied", "Conversation access denied.");
  }

  return { ref, snap, conversation };
}

async function getExpoPushTokens(userIds = []) {
  const tokenSet = new Set();

  await Promise.all(
    [...new Set(userIds.filter(Boolean))].map(async (uid) => {
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

async function sendExpoPush({ userIds, title, body, data }) {
  const tokens = await getExpoPushTokens(userIds);
  if (!tokens.length) return;

  const response = await fetch("https://exp.host/--/api/v2/push/send", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(
      tokens.map((to) => ({
        to,
        sound: "default",
        title,
        body,
        data,
      })),
    ),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    console.error("[CHAT_PUSH_FAILED]", response.status, text);
  }
}

async function notifyStaff({ conversationId, conversation, message, sender }) {
  const targetUserIds = [];
  const assignedStaffIdValue = assignedStaffId(conversation);
  if (assignedStaffIdValue) targetUserIds.push(assignedStaffIdValue);

  const staffIds = (await getStaffUserIds()).filter((uid) => uid !== assignedStaffIdValue);
  targetUserIds.push(...staffIds);

  if (!targetUserIds.length) return;

  const batch = db.batch();
  const now = FieldValue.serverTimestamp();
  const title = `New chat from ${conversation.customerName || "Customer"}`;

  targetUserIds.forEach((uid) => {
    const notificationRef = db
      .collection("users")
      .doc(uid)
      .collection("notifications")
      .doc();

    batch.set(notificationRef, {
      type: "CHAT_MESSAGE",
      title,
      body: message,
      data: {
        screen: "chat",
        conversationId,
        trackingNumber: conversation.trackingNumber || null,
      },
      entityType: "conversation",
      entityId: conversationId,
      ownerId: uid,
      read: false,
      createdAt: now,
    });
  });

  const alertRef = db.collection("admin_alerts").doc();
  batch.set(alertRef, {
    type: "CHAT_MESSAGE",
    status: "UNREAD",
    conversationId,
    customerId: conversation.customerId,
    trackingNumber: conversation.trackingNumber || null,
    message,
    details: {
      customerName: conversation.customerName || sender.name || "Customer",
      senderName: sender.name || "Customer",
      trackingNumber: conversation.trackingNumber || null,
    },
    createdAt: now,
    updatedAt: now,
  });

  await batch.commit();
}

async function notifyCustomer({ conversationId, customerId, message, sender }) {
  if (!customerId) return;

  const notificationRef = db
    .collection("users")
    .doc(customerId)
    .collection("notifications")
    .doc();

  await notificationRef.set({
    type: "CHAT_MESSAGE",
    title: `Reply from ${sender.role === "admin" ? "Admin" : sender.role === "employee" ? "Support" : "Atlas"}`,
    body: message,
    data: {
      screen: "chat",
      conversationId,
    },
    entityType: "conversation",
    entityId: conversationId,
    ownerId: customerId,
    read: false,
    createdAt: FieldValue.serverTimestamp(),
  });

  await sendExpoPush({
    userIds: [customerId],
    title: "Atlas Support",
    body: message,
    data: {
      screen: "chat",
      conversationId,
    },
  });
}

async function notifyDirectParticipants({ conversationId, conversation, message, sender }) {
  const recipients = (conversation.participantIds || []).filter(
    (participantId) => participantId && participantId !== sender.uid,
  );
  if (!recipients.length) return;

  const batch = db.batch();
  const now = FieldValue.serverTimestamp();
  recipients.forEach((uid) => {
    const notificationRef = db.collection("users").doc(uid).collection("notifications").doc();
    batch.set(notificationRef, {
      type: "CHAT_MESSAGE",
      title: sender.name || "Atlas staff",
      body: message,
      data: { screen: "checker-chat", conversationId },
      entityType: "conversation",
      entityId: conversationId,
      ownerId: uid,
      read: false,
      createdAt: now,
    });
  });
  await batch.commit();
  await sendExpoPush({
    userIds: recipients,
    title: sender.name || "Atlas staff",
    body: message,
    data: { screen: "checker-chat", conversationId },
  });
}

async function notifyIncomingCall({ callId, conversationId, receiverId, callerName, callType }) {
  if (!receiverId) return;

  const notificationRef = db
    .collection("users")
    .doc(receiverId)
    .collection("notifications")
    .doc();

  await notificationRef.set({
    type: callType === "video" ? "INCOMING_VIDEO_CALL" : "INCOMING_VOICE_CALL",
    title: `${callType === "video" ? "Video" : "Voice"} call request`,
    body: `${callerName || "Atlas support"} is calling you.`,
    data: {
      screen: "call",
      conversationId,
      callId,
      callType,
    },
    entityType: "call",
    entityId: callId,
    ownerId: receiverId,
    read: false,
    createdAt: FieldValue.serverTimestamp(),
  });
}

exports.createConversation = onCall(
  { region: "asia-southeast1", maxInstances: 10 },
  async (req) => {
    const { uid, role, user } = await requireRole(db, req, ["customer"]);
    const trackingNumber = normalizeTracking(req.data?.trackingNumber);
    const initialMessage = String(req.data?.message || "").trim();

    let shipmentData = null;
    if (trackingNumber) {
      const shipmentSnap = await db.collection("shipments").doc(trackingNumber).get();
      if (!shipmentSnap.exists) {
        throw new HttpsError("not-found", "Shipment not found.");
      }
      shipmentData = shipmentSnap.data() || {};

      if (!customerOwnsShipment(shipmentData, { uid, ...user })) {
        throw new HttpsError(
          "permission-denied",
          "You are not authorized to access this shipment.",
        );
      }
    }

    if (trackingNumber) {
      const existingSnap = await db
        .collection("conversations")
        .where("customerId", "==", uid)
        .where("trackingNumber", "==", trackingNumber)
        .limit(10)
        .get();

      const existing = existingSnap.docs.find((doc) => {
        const status = String(doc.data()?.status || "open").toLowerCase();
        return status !== "closed";
      });

      if (existing) {
        return { success: true, conversationId: existing.id, reused: true };
      }
    }

    if (!initialMessage) {
      return {
        success: false,
        requiresMessage: true,
        message: "Send a message to start a new conversation.",
      };
    }

    const conversationRef = db.collection("conversations").doc();
    const customerName = displayName(user, "Customer");
    const now = FieldValue.serverTimestamp();

    const conversation = {
      conversationId: conversationRef.id,
      type: trackingNumber ? "shipment" : "customer_support",
      shipmentId: trackingNumber,
      trackingNumber,
      shipmentSummary: shipmentData
        ? {
            status: shipmentData.status || null,
            origin: shipmentData.origin || shipmentData.sender?.address?.city || null,
            destination:
              shipmentData.destination ||
              shipmentData.recipient?.address?.city ||
              null,
          }
        : null,
      customerId: uid,
      customerName,
      customerPhone: user.phoneNumber || user.phone || null,
      assignedStaffId: null,
      assignedStaffName: null,
      assignedStaffRole: null,
      assignedTo: null,
      assignedToName: null,
      assignedRole: null,
      participantIds: [uid],
      participantRoles: {
        [uid]: role,
      },
      lastMessage: initialMessage || "Conversation started",
      lastMessageType: "text",
      lastMessageSender: uid,
      lastMessageText: initialMessage || "Conversation started",
      lastMessageAt: now,
      lastMessageBy: uid,
      lastActivityAt: now,
      status: "unassigned",
      priority: "normal",
      unreadCustomer: 0,
      unreadStaff: initialMessage ? 1 : 0,
      unreadCounts: {
        [uid]: 0,
        staff: initialMessage ? 1 : 0,
      },
      createdAt: now,
      updatedAt: now,
    };

    await conversationRef.set(conversation);

    if (initialMessage) {
      await conversationRef.collection("messages").add({
        senderId: uid,
        senderRole: role,
        senderName: customerName,
        type: "text",
        text: initialMessage,
        attachments: [],
        createdAt: FieldValue.serverTimestamp(),
        readBy: {
          [uid]: FieldValue.serverTimestamp(),
        },
      });

      await notifyStaff({
        conversationId: conversationRef.id,
        conversation,
        message: initialMessage,
        sender: { uid, role, name: customerName },
      });
    }

    return { success: true, conversationId: conversationRef.id, reused: false };
  },
);

exports.createCallHistoryMessage = onCall(
  { region: "asia-southeast1", maxInstances: 20 },
  async (req) => {
    const uid = requireAuth(req);
    const conversationId = cleanText(req.data?.conversationId, "conversationId", 160);
    const callId = cleanText(req.data?.callId, "callId", 160);
    const text = cleanText(req.data?.text, "text", 2000);
    const duration = Math.max(0, Number(req.data?.duration || 0));

    const userSnap = await db.collection("users").doc(uid).get();
    if (!userSnap.exists || userSnap.data()?.active === false) {
      throw new HttpsError("permission-denied", "Inactive or missing user.");
    }

    const user = userSnap.data() || {};
    const role = String(user.role || "").toLowerCase();
    const { ref } = await getConversationForUser(conversationId, uid, role);

    const callRef = db.collection("calls").doc(callId);
    const callSnap = await callRef.get();
    if (!callSnap.exists) {
      throw new HttpsError("not-found", "Call not found.");
    }

    const call = callSnap.data() || {};
    const isParticipant = String(call.callerId || "").trim() === uid || String(call.receiverId || "").trim() === uid;
    if (!isParticipant && !STAFF_MONITOR_ROLES.includes(role)) {
      throw new HttpsError("permission-denied", "Call access denied.");
    }

    // Completed calls are recorded once by updateConversationCallStatus as
    // "Voice/Video Call\nMM:SS". Ignore the legacy follow-up status write so
    // every role pair uses the same single completed-call bubble.
    if (isRedundantCompletedCallStatus(call, text)) {
      return { success: true, skipped: true };
    }

    await writeCallHistoryMessage({
      conversationRef: ref,
      conversationId,
      call,
      text,
      duration,
    });

    return { success: true };
  },
);

exports.sendChatMessage = onCall(
  { region: "asia-southeast1", maxInstances: 20 },
  async (req) => {
    const uid = requireAuth(req);
    const conversationId = cleanText(req.data?.conversationId, "conversationId", 160);
    const rawText = req.data?.text;
    const attachmentUrl = req.data?.attachmentUrl || null;
    const attachmentType = String(req.data?.attachmentType || "").trim().toLowerCase();
    const attachmentName = String(req.data?.attachmentName || "").trim() || null;
    const text = rawText == null ? "" : String(rawText).trim();

    if (!text && !attachmentUrl) {
      throw new HttpsError("invalid-argument", "Message text or attachment is required.");
    }

    const userSnap = await db.collection("users").doc(uid).get();
    if (!userSnap.exists || userSnap.data()?.active === false) {
      throw new HttpsError("permission-denied", "Inactive or missing user.");
    }

    const user = userSnap.data() || {};
    const role = String(user.role || "").toLowerCase();
    const { ref, conversation } = await getConversationForUser(
      conversationId,
      uid,
      role,
    );

    if (conversation.status === "closed") {
      throw new HttpsError("failed-precondition", "Conversation is closed.");
    }

    const senderName = displayName(user, role === "customer" ? "Customer" : "Staff");
    const isStaff = STAFF_ROLES.includes(role);
    const isDirectStaff = conversation.type === "direct_staff";
    const now = FieldValue.serverTimestamp();
    const messageText = text || (attachmentType === "image" ? "Photo" : attachmentName || "Attachment");
    const updates = {
      lastMessage: messageText,
      lastMessageText: messageText,
      lastActivityAt: now,
      lastMessageAt: now,
      lastMessageBy: uid,
      updatedAt: now,
      status: normalizeConversationStatus(conversation.status) === "closed" ? "closed" : normalizeConversationStatus(conversation.status) === "unassigned" ? "active" : normalizeConversationStatus(conversation.status),
    };

    if (isDirectStaff) {
      (conversation.participantIds || []).forEach((participantId) => {
        updates[`unreadCounts.${participantId}`] =
          participantId === uid ? 0 : FieldValue.increment(1);
      });
      updates[`participantRoles.${uid}`] = role;
    } else if (isStaff) {
      updates[`unreadCounts.${conversation.customerId}`] = FieldValue.increment(1);
      updates.unreadCustomer = FieldValue.increment(1);
      updates.unreadStaff = 0;
      updates["unreadCounts.staff"] = 0;
      if (!assignedStaffId(conversation)) {
        Object.assign(
          updates,
          staffAssignmentFields({
            assigneeId: uid,
            assigneeRole: role,
            assigneeName: senderName,
          }),
        );
      }
      updates[`participantRoles.${uid}`] = role;
      updates.participantIds = FieldValue.arrayUnion(uid);
    } else {
      updates.unreadStaff = FieldValue.increment(1);
      updates.unreadCustomer = 0;
      updates["unreadCounts.staff"] = FieldValue.increment(1);
    }

    await db.runTransaction(async (tx) => {
      const latest = await tx.get(ref);
      if (!latest.exists) {
        throw new HttpsError("not-found", "Conversation not found.");
      }

      const messageRef = ref.collection("messages").doc();
      tx.set(messageRef, {
        messageId: messageRef.id,
        senderId: uid,
        senderRole: role,
        senderName,
        type: attachmentUrl
          ? attachmentType === "image"
            ? "image"
            : "document"
          : "text",
        text,
        attachments: attachmentUrl
          ? [
              {
                url: attachmentUrl,
                type: attachmentType === "image" ? "image" : "document",
                name: attachmentName || null,
              },
            ]
          : [],
        attachmentUrl: attachmentUrl || null,
        attachmentType: attachmentType || null,
        attachmentName: attachmentName || null,
        status: "sent",
        createdAt: now,
        readBy: {
          [uid]: now,
        },
        seenBy: {
          [uid]: now,
        },
      });
      tx.update(ref, updates);
    });

    if (isDirectStaff) {
      await notifyDirectParticipants({
        conversationId,
        conversation,
        message: text || (attachmentType === "image" ? "Photo" : attachmentName || "Attachment"),
        sender: { uid, role, name: senderName },
      });
    } else if (isStaff) {
      await notifyCustomer({
        conversationId,
        customerId: conversation.customerId,
        message: text || (attachmentType === "image" ? "Photo" : attachmentName || "Attachment"),
        sender: { uid, role, name: senderName },
      });
    } else {
      await notifyStaff({
        conversationId,
        conversation,
        message: text || (attachmentType === "image" ? "Photo" : attachmentName || "Attachment"),
        sender: { uid, role, name: senderName },
      });
    }

    return { success: true };
  },
);

exports.markConversationRead = onCall(
  { region: "asia-southeast1", maxInstances: 20 },
  async (req) => {
    const uid = requireAuth(req);
    const conversationId = cleanText(req.data?.conversationId, "conversationId", 160);
    const userSnap = await db.collection("users").doc(uid).get();
    if (!userSnap.exists) {
      throw new HttpsError("permission-denied", "User profile missing.");
    }

    const role = String(userSnap.data()?.role || "").toLowerCase();
    const { ref, conversation } = await getConversationForUser(conversationId, uid, role);
    const directStaff = conversation.type === "direct_staff";
    const key = directStaff ? uid : STAFF_ROLES.includes(role) ? "staff" : uid;

    const updates = {
      [`unreadCounts.${key}`]: 0,
      updatedAt: FieldValue.serverTimestamp(),
    };
    if (!directStaff) {
      updates.unreadCustomer = role === "customer" ? 0 : FieldValue.increment(0);
      updates.unreadStaff = role === "customer" ? FieldValue.increment(0) : 0;
    }

    await ref.update(updates);

    return { success: true };
  },
);

exports.updateConversationStatus = onCall(
  { region: "asia-southeast1", maxInstances: 10 },
  async (req) => {
    const { uid, role } = await requireRole(db, req, STAFF_ROLES);
    const conversationId = cleanText(req.data?.conversationId, "conversationId", 160);
    const status = String(req.data?.status || "").trim().toLowerCase();
    const priority = req.data?.priority
      ? String(req.data.priority).trim().toLowerCase()
      : null;

    if (!VALID_STATUSES.includes(status)) {
      throw new HttpsError("invalid-argument", "Invalid conversation status.");
    }
    if (priority && !VALID_PRIORITIES.includes(priority)) {
      throw new HttpsError("invalid-argument", "Invalid conversation priority.");
    }

    const { ref } = await getConversationForUser(conversationId, uid, role);
    const update = {
      status,
      updatedAt: FieldValue.serverTimestamp(),
      statusUpdatedBy: uid,
      statusUpdatedByRole: role,
    };
    if (priority) update.priority = priority;

    await ref.update(update);
    return { success: true };
  },
);

exports.assignConversation = onCall(
  { region: "asia-southeast1", maxInstances: 10 },
  async (req) => {
    const { uid, role, user } = await requireRole(db, req, ["admin"]);
    const conversationId = cleanText(req.data?.conversationId, "conversationId", 160);
    const assignerName = displayName(user, "Staff");
    const now = FieldValue.serverTimestamp();

    await getConversationForUser(conversationId, uid, role);

    // An empty/absent assigneeId means "unassign" the conversation.
    const assigneeId = String(req.data?.assigneeId ?? "").trim();

    if (!assigneeId) {
      await db.collection("conversations").doc(conversationId).update({
        ...staffAssignmentFields({
          assigneeId: null,
          assigneeRole: null,
          assigneeName: null,
        }),
        assignedBy: uid,
        assignedByName: assignerName,
        assignedByRole: role,
        assignedAt: now,
        updatedAt: now,
      });

      return { success: true, unassigned: true };
    }

    const assigneeSnap = await db.collection("users").doc(assigneeId).get();
    if (!assigneeSnap.exists) {
      throw new HttpsError("not-found", "Assignee not found.");
    }

    const assignee = assigneeSnap.data() || {};
    const assigneeRole = String(assignee.role || "").toLowerCase();
    if (!STAFF_ROLES.includes(assigneeRole)) {
      throw new HttpsError("invalid-argument", "Assignee must be staff.");
    }

    const assigneeName = displayName(assignee, "Staff");
    await db.collection("conversations").doc(conversationId).update({
      ...staffAssignmentFields({
        assigneeId,
        assigneeRole,
        assigneeName,
      }),
      participantIds: FieldValue.arrayUnion(assigneeId),
      [`participantRoles.${assigneeId}`]: assigneeRole,
      updatedAt: now,
      assignedBy: uid,
      assignedByName: assignerName,
      assignedByRole: role,
      assignedAt: now,
    });

    const notificationRef = db
      .collection("users")
      .doc(assigneeId)
      .collection("notifications")
      .doc();

    await notificationRef.set({
      type: "CHAT_ASSIGNED",
      title: "Conversation assigned",
      body: `${assignerName} assigned you a support conversation.`,
      data: {
        screen: "chat",
        conversationId,
      },
      entityType: "conversation",
      entityId: conversationId,
      ownerId: assigneeId,
      read: false,
      createdAt: now,
    });

    return { success: true };
  },
);

exports.startConversationCall = onCall(
  {
    region: "asia-southeast1",
    maxInstances: 20,
    secrets: [TRTC_SDK_APP_ID, TRTC_SECRET_KEY],
  },
  async (req) => {
    try {
      const uid = requireAuth(req);
      const conversationId = cleanText(req.data?.conversationId, "conversationId", 160);
      const callType = String(req.data?.type || req.data?.callType || "voice")
        .trim()
        .toLowerCase();

      if (!CALL_TYPES.includes(callType)) {
        throw new HttpsError("invalid-argument", "Invalid call type.");
      }

      const userSnap = await db.collection("users").doc(uid).get();
      if (!userSnap.exists || userSnap.data()?.active === false) {
        throw new HttpsError("permission-denied", "Inactive or missing user.");
      }

      const user = userSnap.data() || {};
      const role = String(user.role || "").toLowerCase();
      const conversationRef = db.collection("conversations").doc(conversationId);
      const conversationSnap = await conversationRef.get();

      if (!conversationSnap.exists) {
        throw new HttpsError("not-found", "Conversation not found.");
      }

      const conversation = conversationSnap.data() || {};
      if (conversation.status === "closed") {
        throw new HttpsError("failed-precondition", "Conversation is closed.");
      }

      if (conversation.type === "direct_staff") {
        await getConversationForUser(conversationId, uid, role);

        const participantIds = [...new Set(
          (conversation.participantIds || [])
            .map((participantId) => String(participantId || "").trim())
            .filter(Boolean),
        )];
        const receiverId = participantIds.find((participantId) => participantId !== uid);

        if (!participantIds.includes(uid) || !receiverId) {
          throw new HttpsError(
            "failed-precondition",
            "This conversation has no available call recipient.",
          );
        }

        const receiverSnap = await db.collection("users").doc(receiverId).get();
        if (!receiverSnap.exists || receiverSnap.data()?.active === false) {
          throw new HttpsError(
            "failed-precondition",
            "The other participant is not available for calls.",
          );
        }
        const callerName = displayName(user, "Atlas staff");
        return createRingingConversationCall({
          conversationId,
          callType,
          callerId: uid,
          callerRole: role,
          callerName,
          receiverId,
          receiverRole: String(receiverSnap.data()?.role || "staff").toLowerCase(),
          participantIds,
        });
      }

      const customerId = String(conversation.customerId || "").trim();
      if (!customerId) {
        throw new HttpsError(
          "failed-precondition",
          "Conversation has no associated customer.",
        );
      }

      const customerSnap = await db.collection("customers").doc(customerId).get();
      if (!customerSnap.exists) {
        throw new HttpsError("not-found", "Customer profile not found.");
      }
      const customerData = customerSnap.data() || {};
      const assignedManagerId = String(customerData.primaryAssignedStaffId || "").trim();

      if (!assignedManagerId) {
        throw new HttpsError(
          "failed-precondition",
          "The customer has no assigned manager.",
        );
      }

      const isCustomerCaller = role === "customer" && uid === customerId;
      const isManagerCaller = role === "manager";
      if (!isCustomerCaller && !isManagerCaller) {
        throw new HttpsError(
          "permission-denied",
          "Only the customer or a manager can start this call.",
        );
      }

      await getConversationForUser(conversationId, uid, role);

      const receiverId = isCustomerCaller ? assignedManagerId : customerId;
      const receiverSnap = await db.collection("users").doc(receiverId).get();
      if (!receiverSnap.exists || receiverSnap.data()?.active === false) {
        throw new HttpsError("failed-precondition", "The other participant is not available for calls.");
      }

      const receiverRole = String(receiverSnap.data()?.role || "").trim().toLowerCase();
      const expectedReceiverRole = isCustomerCaller ? "manager" : "customer";
      if (receiverRole !== expectedReceiverRole) {
        throw new HttpsError(
          "failed-precondition",
          `The call recipient must be a ${expectedReceiverRole}.`,
        );
      }

      return createRingingConversationCall({
        conversationId,
        callType,
        callerId: uid,
        callerRole: role,
        callerName: displayName(user, isCustomerCaller ? "Customer" : "Manager"),
        receiverId,
        receiverRole,
        participantIds: [uid, receiverId],
        extraFields: {
          shipmentId: conversation.shipmentId || conversation.trackingNumber || null,
          customerId,
          assignedStaffId: assignedManagerId,
          assignedStaffRole: "manager",
        },
      });
    } catch (error) {
      if (error instanceof HttpsError) {
        throw error;
      }

      console.error("Conversation call start failed:", error);
      throw new HttpsError("internal", "Failed to start the conversation call.");
    }
  },
);

exports.acceptConversationCall = onCall(
  { region: "asia-southeast1", maxInstances: 20 },
  async (req) => {
    try {
      const uid = requireAuth(req);
      const callId = cleanText(req.data?.callId, "callId", 160);

      const userSnap = await db.collection("users").doc(uid).get();
      if (!userSnap.exists || userSnap.data()?.active === false) {
        throw new HttpsError("permission-denied", "Inactive or missing user.");
      }

      const callRef = db.collection("calls").doc(callId);
      const now = FieldValue.serverTimestamp();

      const result = await db.runTransaction(async (tx) => {
        const callSnap = await tx.get(callRef);
        if (!callSnap.exists) {
          throw new HttpsError("not-found", "Call not found.");
        }

        const call = callSnap.data() || {};
        if (call.status === "accepted") {
          throw new HttpsError("already-exists", "Call already accepted.");
        }

        if (call.status !== "ringing") {
          throw new HttpsError("failed-precondition", "Call is no longer pending.");
        }

        if (call.receiverId !== uid) {
          throw new HttpsError("permission-denied", "Only the receiver can accept this call.");
        }

        tx.update(callRef, {
          status: "accepted",
          answeredAt: now,
          acceptedBy: uid,
          updatedAt: now,
        });

        return {
          accepted: true,
          callId,
          rtcRoomId: call.rtcRoomId || call.roomId || null,
          conversationId: call.conversationId || null,
          callerId: call.callerId || null,
          receiverId: call.receiverId || null,
          type: call.type || null,
        };
      });

      return result;
    } catch (error) {
      if (error instanceof HttpsError) {
        throw error;
      }

      console.error("Conversation call acceptance failed:", error);
      throw new HttpsError("internal", "Failed to accept the conversation call.");
    }
  },
);

exports.updateConversationCallStatus = onCall(
  { region: "asia-southeast1", maxInstances: 20 },
  async (req) => {
    const uid = requireAuth(req);
    const callId = cleanText(req.data?.callId, "callId", 160);
    const status = String(req.data?.status || "").trim().toLowerCase();
    const duration = Math.max(0, Number(req.data?.duration || 0));
    const endReason = String(req.data?.endReason || (status === "ended" ? "hangup" : status))
      .trim()
      .toLowerCase()
      .slice(0, 80);

    if (!CALL_STATUSES.includes(status)) {
      throw new HttpsError("invalid-argument", "Invalid call status.");
    }

    const userSnap = await db.collection("users").doc(uid).get();
    if (!userSnap.exists || userSnap.data()?.active === false) {
      throw new HttpsError("permission-denied", "Inactive or missing user.");
    }

    const user = userSnap.data() || {};
    const role = String(user.role || "").toLowerCase();
    const callRef = db.collection("calls").doc(callId);
    const initialSnap = await callRef.get();
    if (!initialSnap.exists) throw new HttpsError("not-found", "Call not found.");
    const initialCall = initialSnap.data() || {};
    await getConversationForUser(initialCall.conversationId, uid, role);

    const isParticipant = initialCall.callerId === uid || initialCall.receiverId === uid;
    if (!isParticipant && !STAFF_MONITOR_ROLES.includes(role)) {
      throw new HttpsError("permission-denied", "Call access denied.");
    }

    const transition = await db.runTransaction(async (tx) => {
      const snap = await tx.get(callRef);
      if (!snap.exists) throw new HttpsError("not-found", "Call not found.");
      const call = snap.data() || {};
      const currentStatus = String(call.status || "").trim().toLowerCase();

      if (status === "connected" && TERMINAL_CALL_STATUSES.includes(currentStatus)) {
        throw new HttpsError("failed-precondition", "Call has already ended.");
      }
      // A terminal call is immutable. Repeated hangups are successful no-ops.
      if (TERMINAL_CALL_STATUSES.includes(currentStatus)) {
        return { changed: false, call, status: currentStatus };
      }

      const now = FieldValue.serverTimestamp();
      const update = { status, updatedAt: now, statusUpdatedBy: uid };
      if (status === "connected") update.connectedAt = now;
      if (TERMINAL_CALL_STATUSES.includes(status)) {
        update.endedAt = now;
        update.endedBy = uid;
        update.endedReason = endReason || status;
        update.duration = duration;
        update.signalingEvent = "call_ended";
        update.termination = {
          event: "call_ended",
          callId,
          endedBy: uid,
          reason: endReason || status,
          participantIds: [call.callerId, call.receiverId].filter(Boolean),
          timestamp: now,
        };
      }
      tx.update(callRef, update);
      return { changed: true, call, status };
    });

    if (transition.changed && status === "ended") {
      const call = transition.call;
      const conversationRef = db.collection("conversations").doc(call.conversationId);
      const label = call.type === "video" ? "Video Call" : "Voice Call";
      const minutes = Math.floor(duration / 60);
      const seconds = Math.floor(duration % 60);
      const durationLabel = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
      const text = `${label}\n${durationLabel}`;

      await writeCallHistoryMessage({
        conversationRef,
        conversationId: call.conversationId,
        call,
        text,
        duration,
      });
    }

    return {
      success: true,
      changed: transition.changed,
      callId,
      status: transition.status,
      event: TERMINAL_CALL_STATUSES.includes(transition.status) ? "call_ended" : null,
    };
  },
);
