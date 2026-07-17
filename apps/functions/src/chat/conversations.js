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
const CALL_LOCK_COLLECTION = "callAccountLocks";
const CALL_HEARTBEAT_STALE_MS = 90 * 1000;
const BACKGROUND_CALL_HEARTBEAT_STALE_MS = 10 * 60 * 1000;
const RINGING_CALL_STALE_MS = 45 * 1000;

function cleanCallIdentity(value, fallback = null) {
  const normalized = String(value || "")
    .trim()
    .replace(/[^a-zA-Z0-9._:-]/g, "")
    .slice(0, 160);
  return normalized || fallback;
}

function timestampMillis(value) {
  if (!value) return 0;
  if (typeof value.toMillis === "function") return value.toMillis();
  if (typeof value.toDate === "function") return value.toDate().getTime();
  if (value instanceof Date) return value.getTime();
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const seconds = Number(value.seconds || value._seconds || 0);
  if (seconds > 0) return seconds * 1000;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

function isCallStale(call = {}, nowMillis = Date.now()) {
  const status = String(call.status || "").trim().toLowerCase();
  if (!ACTIVE_CALL_STATUSES.includes(status)) return false;

  // A ringing call has a fixed lifetime. Caller heartbeats must not keep an
  // unanswered call and both participant locks alive indefinitely.
  if (status === "ringing") {
    const ringingStartedAt = timestampMillis(call.createdAt || call.startedAt);
    return !ringingStartedAt || nowMillis - ringingStartedAt > RINGING_CALL_STALE_MS;
  }

  const fallbackHeartbeat = timestampMillis(
    call.lastHeartbeat || call.updatedAt || call.startedAt || call.createdAt,
  );
  // Legacy/failed call documents without a usable timestamp must never keep
  // an account locked permanently.
  if (!fallbackHeartbeat) return true;

  const callerHeartbeat = timestampMillis(call.callerLastHeartbeatAt) || fallbackHeartbeat;
  const receiverHeartbeat = timestampMillis(call.receiverLastHeartbeatAt) || fallbackHeartbeat;
  const participantHeartbeatIsStale = (participantRole, heartbeat) => {
    const lifecycleState = String(call[`${participantRole}LifecycleState`] || "foreground")
      .trim()
      .toLowerCase();
    const staleAfter = lifecycleState === "background"
      ? BACKGROUND_CALL_HEARTBEAT_STALE_MS
      : CALL_HEARTBEAT_STALE_MS;
    return nowMillis - heartbeat > staleAfter;
  };
  return (
    participantHeartbeatIsStale("caller", callerHeartbeat) ||
    participantHeartbeatIsStale("receiver", receiverHeartbeat)
  );
}

function callBusyError({ callerBusy, receiverBusy, receiverName }) {
  if (callerBusy && receiverBusy) {
    return new HttpsError(
      "already-exists",
      "You and this contact currently have active calls.",
      { reason: "both-busy" },
    );
  }
  if (callerBusy) {
    return new HttpsError(
      "already-exists",
      "This account is currently in an active call on another device.",
      { reason: "caller-busy" },
    );
  }
  return new HttpsError(
    "already-exists",
    `${String(receiverName || "This contact").trim()} is currently on another call.`,
    { reason: "receiver-busy" },
  );
}

async function findActiveCallCandidates(participantIds) {
  const lookups = [];
  for (const participantId of participantIds) {
    lookups.push(
      db
        .collection("calls")
        .where("status", "in", ACTIVE_CALL_STATUSES)
        .where("callerId", "==", participantId)
        .limit(20)
        .get(),
      db
        .collection("calls")
        .where("status", "in", ACTIVE_CALL_STATUSES)
        .where("receiverId", "==", participantId)
        .limit(20)
        .get(),
    );
  }

  const snapshots = await Promise.all(lookups);
  const candidateIds = new Set();
  snapshots.forEach((snapshot) => {
    snapshot.docs.forEach((docSnap) => candidateIds.add(docSnap.id));
  });
  return candidateIds;
}

async function createRingingConversationCall({
  conversationId,
  callType,
  callerId,
  callerRole,
  callerName,
  callerSessionId,
  callerDeviceId,
  receiverId,
  receiverRole,
  receiverName,
  participantIds,
  extraFields = {},
}) {
  const callRef = db.collection("calls").doc();
  const callerLockRef = db.collection(CALL_LOCK_COLLECTION).doc(callerId);
  const receiverLockRef = db.collection(CALL_LOCK_COLLECTION).doc(receiverId);
  const candidateIds = await findActiveCallCandidates([callerId, receiverId]);
  const now = FieldValue.serverTimestamp();
  const rtcRoomId = `atlas_${callRef.id}`;
  const rtcConfig = getRtcSecretConfig();

  const staleEndedCalls = await db.runTransaction(async (tx) => {
    const callerLockSnap = await tx.get(callerLockRef);
    const receiverLockSnap = await tx.get(receiverLockRef);
    const lockedCallIds = [callerLockSnap, receiverLockSnap]
      .map((snap) => String(snap.data()?.activeCallId || "").trim())
      .filter(Boolean);
    lockedCallIds.forEach((callId) => candidateIds.add(callId));

    const candidateSnaps = [];
    for (const callId of candidateIds) {
      candidateSnaps.push(await tx.get(db.collection("calls").doc(callId)));
    }

    let callerBusy = false;
    let receiverBusy = false;
    const staleCalls = new Map();
    const liveCallIds = new Set();
    const nowMillis = Date.now();

    candidateSnaps.forEach((snap) => {
      if (!snap.exists) return;
      const call = snap.data() || {};
      const status = String(call.status || "").trim().toLowerCase();
      if (!ACTIVE_CALL_STATUSES.includes(status)) return;
      if (isCallStale(call, nowMillis)) {
        staleCalls.set(snap.id, call);
        return;
      }
      liveCallIds.add(snap.id);
      if (call.callerId === callerId || call.receiverId === callerId) callerBusy = true;
      if (call.callerId === receiverId || call.receiverId === receiverId) receiverBusy = true;
    });

    const callerLockCallId = String(callerLockSnap.data()?.activeCallId || "").trim();
    const receiverLockCallId = String(receiverLockSnap.data()?.activeCallId || "").trim();
    if (callerLockCallId && liveCallIds.has(callerLockCallId)) callerBusy = true;
    if (receiverLockCallId && liveCallIds.has(receiverLockCallId)) receiverBusy = true;

    if (callerBusy || receiverBusy) {
      throw callBusyError({ callerBusy, receiverBusy, receiverName });
    }

    staleCalls.forEach((call, callId) => {
      const connectedAtMillis = timestampMillis(call.connectedAt || call.answeredAt || call.startedAt);
      const staleDuration = connectedAtMillis
        ? Math.max(0, Math.floor((Date.now() - connectedAtMillis) / 1000))
        : 0;
      tx.update(db.collection("calls").doc(callId), {
        status: "ended",
        endedAt: now,
        endedBy: "system",
        endedReason: "stale_heartbeat",
        duration: staleDuration,
        updatedAt: now,
        signalingEvent: "call_ended",
        termination: {
          event: "call_ended",
          callId,
          endedBy: "system",
          reason: "stale_heartbeat",
          participantIds: [call.callerId, call.receiverId].filter(Boolean),
          timestamp: now,
        },
      });
    });

    const callData = {
      callId: callRef.id,
      conversationId,
      callerId,
      callerRole,
      callerName,
      callerSessionId,
      callerDeviceId,
      callerLastHeartbeatAt: now,
      receiverId,
      receiverRole,
      receiverName: receiverName || null,
      receiverSessionId: null,
      receiverDeviceId: null,
      receiverLastHeartbeatAt: now,
      participantIds: [...new Set(participantIds || [callerId, receiverId])],
      type: callType,
      status: "ringing",
      rtcRoomId,
      roomId: rtcRoomId,
      rtcProvider: "tencent",
      rtcConfigStatus: rtcConfig.isConfigured ? "configured" : "pending-setup",
      createdAt: now,
      startedAt: now,
      lastHeartbeat: now,
      updatedAt: now,
      ...extraFields,
    };
    tx.set(callRef, callData);
    tx.set(callerLockRef, {
      userId: callerId,
      activeCallId: callRef.id,
      participantRole: "caller",
      sessionId: callerSessionId,
      deviceId: callerDeviceId,
      status: "ringing",
      lastHeartbeatAt: now,
      updatedAt: now,
    });
    tx.set(receiverLockRef, {
      userId: receiverId,
      activeCallId: callRef.id,
      participantRole: "receiver",
      sessionId: null,
      deviceId: null,
      status: "ringing",
      lastHeartbeatAt: now,
      updatedAt: now,
    });
    return [...staleCalls.entries()].map(([callId, call]) => ({
      ...call,
      id: callId,
      callId,
      duration: Math.max(
        0,
        Math.floor((Date.now() - (timestampMillis(call.connectedAt || call.answeredAt || call.startedAt) || Date.now())) / 1000),
      ),
    }));
  });

  for (const staleCall of staleEndedCalls) {
    const minutes = Math.floor(staleCall.duration / 60);
    const seconds = Math.floor(staleCall.duration % 60);
    try {
      await writeCallHistoryMessage({
        conversationId: staleCall.conversationId,
        call: staleCall,
        text: `${staleCall.type === "video" ? "Video Call" : "Voice Call"}\n${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`,
        duration: staleCall.duration,
      });
    } catch (error) {
      console.error("Unable to write recovered stale call history:", staleCall.callId, error);
    }
  }

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
    const participantIds = Array.isArray(conversation.participantIds)
      ? conversation.participantIds
      : [];
    const isStaffMember = STAFF_ROLES.includes(normalizedRole);
    const isParticipant = participantIds.includes(uid);
    
    // Allow access if user is a participant or is a staff member able to access direct conversations
    if (!isParticipant && !isStaffMember) {
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

async function getAuthorizedCallForUser(callRef, uid, user) {
  const callSnap = await callRef.get();
  if (!callSnap.exists) throw new HttpsError("not-found", "Call not found.");
  const call = callSnap.data() || {};
  if (call.callerId !== uid && call.receiverId !== uid) {
    throw new HttpsError("permission-denied", "Call access denied.");
  }
  const conversationId = String(call.conversationId || "").trim();
  if (!conversationId) {
    throw new HttpsError("failed-precondition", "Call has no conversation.");
  }
  await getConversationForUser(
    conversationId,
    uid,
    String(user?.role || "").toLowerCase(),
  );
  return { callSnap, call };
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

    let conversation = {
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

    if (conversation.type === "customer_support") {
      const supportStaffIds = [
        String(process.env.AUTO_SUPPORT_ROSE_UID || "").trim(),
        String(process.env.AUTO_SUPPORT_LEAN_UID || "").trim(),
      ];

      if (
        supportStaffIds.some((staffId) => !staffId) ||
        new Set(supportStaffIds).size !== supportStaffIds.length
      ) {
        throw new HttpsError(
          "failed-precondition",
          "Automatic support assignment is not configured.",
        );
      }

      const assignmentStateRef = db
        .collection("supportAssignmentState")
        .doc("customer_support");
      const presenceCutoffMillis = Date.now() - (2 * 60 * 1000);

      conversation = await db.runTransaction(async (tx) => {
        const assignmentStateSnap = await tx.get(assignmentStateRef);
        const staffSnaps = [];
        for (const staffId of supportStaffIds) {
          staffSnaps.push(await tx.get(db.collection("users").doc(staffId)));
        }

        const rawNextIndex = Number(assignmentStateSnap.data()?.nextIndex || 0);
        const nextIndex = Number.isInteger(rawNextIndex)
          ? ((rawNextIndex % supportStaffIds.length) + supportStaffIds.length) % supportStaffIds.length
          : 0;

        const orderedCandidates = [];
        for (let offset = 0; offset < supportStaffIds.length; offset += 1) {
          const rosterIndex = (nextIndex + offset) % supportStaffIds.length;
          const staffSnap = staffSnaps[rosterIndex];
          const staff = staffSnap.data() || {};
          const staffRole = String(staff.role || "").trim().toLowerCase();
          if (staffSnap.exists && STAFF_ROLES.includes(staffRole)) {
            const presence = staff.presence || {};
            const presenceUpdatedAtMillis = timestampMillis(
              presence.lastHeartbeatAt || presence.updatedAt,
            );
            orderedCandidates.push({
              id: staffSnap.id,
              name: displayName(staff, "Staff"),
              role: staffRole,
              rosterIndex,
              reliablyOnline:
                staff.active !== false &&
                presence.online === true &&
                presenceUpdatedAtMillis >= presenceCutoffMillis,
            });
          }
        }

        const assignee =
          orderedCandidates.find((candidate) => candidate.reliablyOnline) ||
          orderedCandidates[0];

        if (!assignee) {
          throw new HttpsError(
            "failed-precondition",
            "Automatic support assignees are not configured as valid staff users.",
          );
        }

        const assignedConversation = {
          ...conversation,
          ...staffAssignmentFields({
            assigneeId: assignee.id,
            assigneeRole: assignee.role,
            assigneeName: assignee.name,
          }),
          status: "active",
          assignedAt: now,
          assignmentSource: "automatic_round_robin",
        };

        tx.set(conversationRef, assignedConversation);
        tx.set(
          assignmentStateRef,
          {
            nextIndex: (assignee.rosterIndex + 1) % supportStaffIds.length,
            lastAssignedStaffId: assignee.id,
            updatedAt: now,
          },
          { merge: true },
        );

        return assignedConversation;
      });
    } else {
      await conversationRef.set(conversation);
    }

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
    const messageText = text || (
      attachmentType === "image"
        ? "Photo"
        : attachmentType === "audio"
          ? "Voice message"
          : attachmentName || "Attachment"
    );
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
            : attachmentType === "audio"
              ? "audio"
              : "document"
          : "text",
        text,
        attachments: attachmentUrl
          ? [
              {
                url: attachmentUrl,
                type: attachmentType === "image" ? "image" : attachmentType === "audio" ? "audio" : "document",
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
        message: messageText,
        sender: { uid, role, name: senderName },
      });
    } else if (isStaff) {
      await notifyCustomer({
        conversationId,
        customerId: conversation.customerId,
        message: messageText,
        sender: { uid, role, name: senderName },
      });
    } else {
      await notifyStaff({
        conversationId,
        conversation,
        message: messageText,
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
      const callerSessionId = cleanCallIdentity(req.data?.sessionId, `legacy:${uid}`);
      const callerDeviceId = cleanCallIdentity(req.data?.deviceId, callerSessionId);
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
        const receiver = receiverSnap.data() || {};
        const callerName = displayName(user, "Atlas staff");
        const driverId = participantIds.find(
          (participantId) =>
            String(conversation.participantRoles?.[participantId] || "").toLowerCase() === "driver",
        ) || null;
        return createRingingConversationCall({
          conversationId,
          callType,
          callerId: uid,
          callerRole: role,
          callerName,
          callerSessionId,
          callerDeviceId,
          receiverId,
          receiverRole: String(receiver.role || "staff").toLowerCase(),
          receiverName: displayName(receiver, "This contact"),
          participantIds,
          extraFields: {
            driverId,
            driverAccessTokens: conversation.driverAccessTokens || [],
            checkerAccessTokens: conversation.checkerAccessTokens || [],
          },
        });
      }

      const customerId = String(conversation.customerId || "").trim();
      if (!customerId) {
        throw new HttpsError(
          "failed-precondition",
          "Conversation has no associated customer.",
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

      // Customer accounts are stored in users/{uid}; the account creation
      // flow does not create a parallel customers/{uid} document.
      const customerSnap = await db.collection("users").doc(customerId).get();
      const customerData = customerSnap.data() || {};
      if (
        !customerSnap.exists ||
        String(customerData.role || "").trim().toLowerCase() !== "customer"
      ) {
        throw new HttpsError("not-found", "Customer account not found.");
      }

      const assignedManagerId = String(
        assignedStaffId(conversation) ||
          customerData.primaryAssignedStaffId ||
          (isManagerCaller ? uid : ""),
      ).trim();

      if (!assignedManagerId) {
        throw new HttpsError(
          "failed-precondition",
          "This conversation has no assigned manager.",
        );
      }

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
        callerSessionId,
        callerDeviceId,
        receiverId,
        receiverRole,
        receiverName: displayName(receiverSnap.data() || {}, "This contact"),
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
      const sessionId = cleanCallIdentity(req.data?.sessionId, `legacy:${uid}`);
      const deviceId = cleanCallIdentity(req.data?.deviceId, sessionId);

      const userSnap = await db.collection("users").doc(uid).get();
      if (!userSnap.exists || userSnap.data()?.active === false) {
        throw new HttpsError("permission-denied", "Inactive or missing user.");
      }

      const callRef = db.collection("calls").doc(callId);
      await getAuthorizedCallForUser(callRef, uid, userSnap.data() || {});
      const now = FieldValue.serverTimestamp();

      const result = await db.runTransaction(async (tx) => {
        const callSnap = await tx.get(callRef);
        if (!callSnap.exists) {
          throw new HttpsError("not-found", "Call not found.");
        }

        const call = callSnap.data() || {};
        if (call.receiverId !== uid) {
          throw new HttpsError("permission-denied", "Only the receiver can accept this call.");
        }

        const boundSessionId = cleanCallIdentity(call.receiverSessionId);
        if (boundSessionId && boundSessionId !== sessionId) {
          throw new HttpsError(
            "already-exists",
            "This call was answered on another device.",
            { reason: "answered-on-another-device" },
          );
        }

        if (call.status === "accepted" && boundSessionId === sessionId) {
          return {
            accepted: true,
            callId,
            rtcRoomId: call.rtcRoomId || call.roomId || null,
            conversationId: call.conversationId || null,
            callerId: call.callerId || null,
            receiverId: call.receiverId || null,
            type: call.type || null,
          };
        }

        if (call.status !== "ringing") {
          throw new HttpsError("failed-precondition", "Call is no longer pending.");
        }

        const receiverLockRef = db.collection(CALL_LOCK_COLLECTION).doc(uid);
        const receiverLockSnap = await tx.get(receiverLockRef);
        const lockedCallId = String(receiverLockSnap.data()?.activeCallId || "").trim();
        if (lockedCallId && lockedCallId !== callId) {
          throw new HttpsError(
            "already-exists",
            "This account is currently in an active call on another device.",
            { reason: "caller-busy" },
          );
        }

        tx.update(callRef, {
          status: "accepted",
          answeredAt: now,
          acceptedBy: uid,
          receiverSessionId: sessionId,
          receiverDeviceId: deviceId,
          receiverLastHeartbeatAt: now,
          lastHeartbeat: now,
          updatedAt: now,
        });
        tx.set(receiverLockRef, {
          userId: uid,
          activeCallId: callId,
          participantRole: "receiver",
          sessionId,
          deviceId,
          status: "accepted",
          lastHeartbeatAt: now,
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
    const sessionId = cleanCallIdentity(req.data?.sessionId, `legacy:${uid}`);
    const deviceId = cleanCallIdentity(req.data?.deviceId, sessionId);
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
      const callerLockRef = db.collection(CALL_LOCK_COLLECTION).doc(call.callerId);
      const receiverLockRef = db.collection(CALL_LOCK_COLLECTION).doc(call.receiverId);
      const callerLockSnap = await tx.get(callerLockRef);
      const receiverLockSnap = await tx.get(receiverLockRef);
      const participantRole = call.callerId === uid
        ? "caller"
        : call.receiverId === uid
          ? "receiver"
          : null;
      const boundSessionId = participantRole
        ? cleanCallIdentity(call[`${participantRole}SessionId`])
        : null;

      if (participantRole && boundSessionId && boundSessionId !== sessionId) {
        throw new HttpsError(
          "failed-precondition",
          "This call is active on another device.",
          { reason: "session-mismatch" },
        );
      }

      if (status === "connected" && TERMINAL_CALL_STATUSES.includes(currentStatus)) {
        throw new HttpsError("failed-precondition", "Call has already ended.");
      }
      // A terminal call is immutable. Repeated hangups are successful no-ops.
      if (TERMINAL_CALL_STATUSES.includes(currentStatus)) {
        if (String(callerLockSnap.data()?.activeCallId || "") === callId) {
          tx.delete(callerLockRef);
        }
        if (String(receiverLockSnap.data()?.activeCallId || "") === callId) {
          tx.delete(receiverLockRef);
        }
        return { changed: false, call, status: currentStatus };
      }
      if (["declined", "missed", "busy", "cancelled", "timeout"].includes(status) && currentStatus !== "ringing") {
        return { changed: false, call, status: currentStatus };
      }

      const now = FieldValue.serverTimestamp();
      const update = {
        status,
        updatedAt: now,
        statusUpdatedBy: uid,
        lastHeartbeat: now,
      };
      if (participantRole) {
        update[`${participantRole}SessionId`] = sessionId;
        update[`${participantRole}DeviceId`] = deviceId;
        update[`${participantRole}LastHeartbeatAt`] = now;
      }
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
        if (String(callerLockSnap.data()?.activeCallId || "") === callId) {
          tx.delete(callerLockRef);
        }
        if (String(receiverLockSnap.data()?.activeCallId || "") === callId) {
          tx.delete(receiverLockRef);
        }
      } else if (participantRole) {
        const participantLockRef = participantRole === "caller" ? callerLockRef : receiverLockRef;
        tx.set(participantLockRef, {
          userId: uid,
          activeCallId: callId,
          participantRole,
          sessionId,
          deviceId,
          status,
          lastHeartbeatAt: now,
          updatedAt: now,
        });
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

exports.heartbeatConversationCall = onCall(
  { region: "asia-southeast1", maxInstances: 40 },
  async (req) => {
    const uid = requireAuth(req);
    const callId = cleanText(req.data?.callId, "callId", 160);
    const sessionId = cleanCallIdentity(req.data?.sessionId, `legacy:${uid}`);
    const deviceId = cleanCallIdentity(req.data?.deviceId, sessionId);
    const lifecycleState = String(req.data?.lifecycleState || "foreground")
      .trim()
      .toLowerCase() === "background"
      ? "background"
      : "foreground";
    const callRef = db.collection("calls").doc(callId);

    const userSnap = await db.collection("users").doc(uid).get();
    if (!userSnap.exists || userSnap.data()?.active === false) {
      throw new HttpsError("permission-denied", "Inactive or missing user.");
    }
    await getAuthorizedCallForUser(callRef, uid, userSnap.data() || {});

    return db.runTransaction(async (tx) => {
      const callSnap = await tx.get(callRef);
      if (!callSnap.exists) throw new HttpsError("not-found", "Call not found.");

      const call = callSnap.data() || {};
      const status = String(call.status || "").trim().toLowerCase();
      if (TERMINAL_CALL_STATUSES.includes(status)) {
        return { success: true, active: false, status };
      }
      if (!ACTIVE_CALL_STATUSES.includes(status)) {
        throw new HttpsError("failed-precondition", "Call is not active.");
      }

      const participantRole = call.callerId === uid
        ? "caller"
        : call.receiverId === uid
          ? "receiver"
          : null;
      if (!participantRole) {
        throw new HttpsError("permission-denied", "Call access denied.");
      }

      const boundSessionId = cleanCallIdentity(call[`${participantRole}SessionId`]);
      if (boundSessionId && boundSessionId !== sessionId) {
        throw new HttpsError(
          "failed-precondition",
          "This call is active on another device.",
          { reason: "session-mismatch" },
        );
      }

      const lockRef = db.collection(CALL_LOCK_COLLECTION).doc(uid);
      const lockSnap = await tx.get(lockRef);
      const lockedCallId = String(lockSnap.data()?.activeCallId || "").trim();
      if (lockedCallId && lockedCallId !== callId) {
        throw new HttpsError(
          "already-exists",
          "This account is currently in an active call on another device.",
          { reason: "caller-busy" },
        );
      }

      const now = FieldValue.serverTimestamp();
      tx.update(callRef, {
        [`${participantRole}SessionId`]: sessionId,
        [`${participantRole}DeviceId`]: deviceId,
        [`${participantRole}LastHeartbeatAt`]: now,
        [`${participantRole}LifecycleState`]: lifecycleState,
        [`${participantRole}LifecycleAt`]: now,
        lastHeartbeat: now,
      });
      tx.set(lockRef, {
        userId: uid,
        activeCallId: callId,
        participantRole,
        sessionId,
        deviceId,
        status,
        lastHeartbeatAt: now,
        updatedAt: now,
      });

      return { success: true, active: true, callId, status };
    });
  },
);

exports.endCurrentCallSession = onCall(
  { region: "asia-southeast1", maxInstances: 20 },
  async (req) => {
    const uid = requireAuth(req);
    const sessionId = cleanCallIdentity(req.data?.sessionId, `legacy:${uid}`);
    const lockRef = db.collection(CALL_LOCK_COLLECTION).doc(uid);

    const ended = await db.runTransaction(async (tx) => {
      const lockSnap = await tx.get(lockRef);
      if (!lockSnap.exists) return null;
      const lock = lockSnap.data() || {};
      if (cleanCallIdentity(lock.sessionId) !== sessionId) return null;

      const callId = String(lock.activeCallId || "").trim();
      if (!callId) {
        tx.delete(lockRef);
        return null;
      }

      const callRef = db.collection("calls").doc(callId);
      const callSnap = await tx.get(callRef);
      if (!callSnap.exists) {
        tx.delete(lockRef);
        return null;
      }
      const call = callSnap.data() || {};
      const status = String(call.status || "").trim().toLowerCase();
      const callerLockRef = db.collection(CALL_LOCK_COLLECTION).doc(call.callerId);
      const receiverLockRef = db.collection(CALL_LOCK_COLLECTION).doc(call.receiverId);
      const callerLockSnap = call.callerId === uid ? lockSnap : await tx.get(callerLockRef);
      const receiverLockSnap = call.receiverId === uid ? lockSnap : await tx.get(receiverLockRef);

      if (TERMINAL_CALL_STATUSES.includes(status)) {
        if (String(callerLockSnap.data()?.activeCallId || "") === callId) tx.delete(callerLockRef);
        if (String(receiverLockSnap.data()?.activeCallId || "") === callId) tx.delete(receiverLockRef);
        return null;
      }

      const now = FieldValue.serverTimestamp();
      const connectedAtMillis = timestampMillis(call.connectedAt || call.answeredAt || call.startedAt);
      const duration = connectedAtMillis
        ? Math.max(0, Math.floor((Date.now() - connectedAtMillis) / 1000))
        : 0;
      tx.update(callRef, {
        status: "ended",
        endedAt: now,
        endedBy: uid,
        endedReason: String(req.data?.reason || "logout").slice(0, 80),
        duration,
        updatedAt: now,
        signalingEvent: "call_ended",
        termination: {
          event: "call_ended",
          callId,
          endedBy: uid,
          reason: String(req.data?.reason || "logout").slice(0, 80),
          participantIds: [call.callerId, call.receiverId].filter(Boolean),
          timestamp: now,
        },
      });
      if (String(callerLockSnap.data()?.activeCallId || "") === callId) tx.delete(callerLockRef);
      if (String(receiverLockSnap.data()?.activeCallId || "") === callId) tx.delete(receiverLockRef);
      return { ...call, id: callId, callId, duration };
    });

    if (ended) {
      const minutes = Math.floor(ended.duration / 60);
      const seconds = Math.floor(ended.duration % 60);
      await writeCallHistoryMessage({
        conversationId: ended.conversationId,
        call: ended,
        text: `${ended.type === "video" ? "Video Call" : "Voice Call"}\n${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`,
        duration: ended.duration,
      });
    }

    return { success: true, ended: Boolean(ended), callId: ended?.callId || null };
  },
);
