"use strict";

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const {
  requireAuth,
  isAnonymousAuth,
  requireRole,
} = require("../utilities/helpers");
const { customerOwnsShipment } = require("../utilities/customerShipmentAccess");
const {
  TRTC_SDK_APP_ID,
  TRTC_SECRET_KEY,
  getRtcSecretConfig,
} = require("./trtcConfig");
const { assertDirectConversationAccess } = require("./checkerMessaging");
const {
  assertCustomerCommsAllowed,
  resolveShipmentCommsOwner,
  getCheckerActivePieceIds,
  evaluateCheckerCustomerComms,
} = require("./customerCommsAuth");
const {
  resolveShipmentReference,
} = require("../shipments/resolveShipmentReference");

if (!admin.apps.length) admin.initializeApp();

const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;

const STAFF_ROLES = ["admin", "manager", "employee", "checker", "administrator", "staff", "support"];
const STAFF_MONITOR_ROLES = ["admin", "manager", "employee", "administrator", "staff", "support"];
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
  "failed",
  "ended",
];
const TERMINAL_CALL_STATUSES = ["ended", "declined", "missed", "busy", "cancelled", "timeout", "failed"];
// Non-answer terminal statuses that should trigger Atlas Support fallback ringing.
const SUPPORT_FALLBACK_STATUSES = ["declined", "missed", "busy", "timeout", "failed"];
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
      // Communication log context (spec section 18); overridable via extraFields.
      shipmentId: null,
      pieceIds: [],
      checkerId: null,
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

/**
 * Atlas Customer Support fallback: when the primary support agent (Rose /
 * admin) does not answer, automatically ring the secondary agent (Lean /
 * manager) for the same customer (spec section 2). Employee identities are
 * never exposed — the customer only ever sees "Atlas Support".
 */
async function startSupportFallbackCall(call = {}, routing = {}) {
  const secondaryId = String(routing.secondaryId || "").trim();
  if (!secondaryId) return;

  const callerId = String(call.callerId || "").trim();
  const conversationId = String(call.conversationId || "").trim();
  if (!callerId || !conversationId) return;

  const secondarySnap = await db.collection("users").doc(secondaryId).get();
  if (!secondarySnap.exists || secondarySnap.data()?.active === false) return null;
  const secondary = secondarySnap.data() || {};

  return createRingingConversationCall({
    conversationId,
    callType: call.type === "video" ? "video" : "voice",
    callerId,
    callerRole: String(call.callerRole || "customer").toLowerCase(),
    callerName: call.callerName || "Customer",
    callerSessionId: null,
    callerDeviceId: null,
    receiverId: secondaryId,
    receiverRole: String(secondary.role || "manager").toLowerCase(),
    // Privacy: never surface the real agent name to the customer.
    receiverName: "Atlas Support",
    participantIds: [callerId, secondaryId],
    extraFields: {
      conversationType: call.conversationType || null,
      customerId: call.customerId || null,
      shipmentId: call.shipmentId || null,
      isSupportFallback: true,
      routedFromCallId: String(call.callId || "").trim() || null,
      supportRouting: {
        primaryId: routing.primaryId || null,
        secondaryId,
        stage: "secondary",
      },
    },
  });
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

/**
 * Resolve the shipment document tied to a conversation (if any). Returns null
 * rather than throwing so callers can decide how to gate missing shipments.
 */
async function loadShipmentForConversation(conversation = {}) {
  const ref = String(
    conversation.shipmentId || conversation.trackingNumber || "",
  ).trim();
  if (!ref) return null;
  try {
    const { shipment } = await resolveShipmentReference(db, ref);
    return shipment || null;
  } catch (error) {
    return null;
  }
}

/**
 * Keep shipment-thread ownership aligned with custody (spec §14):
 *   - Checker owns while they hold OFD / Failed Delivery pieces.
 *   - Warehouse (Rose → Lean) owns otherwise.
 * Returns the conversation fields after any ownership write.
 */
async function syncShipmentConversationOwnership(conversationRef, conversation = {}) {
  if (String(conversation.type || "") !== "shipment") {
    return conversation;
  }

  const shipment = await loadShipmentForConversation(conversation);
  if (!shipment) return conversation;

  const owner = resolveShipmentCommsOwner(shipment);
  const currentAssignee = String(assignedStaffId(conversation) || "").trim();
  const currentRole = String(
    assignedStaffRole(conversation) || "",
  ).trim().toLowerCase();
  const now = FieldValue.serverTimestamp();

  if (owner.ownerType === "checker" && owner.checkerId) {
    if (currentAssignee === owner.checkerId && currentRole === "checker") {
      return conversation;
    }

    const checkerSnap = await db.collection("users").doc(owner.checkerId).get();
    const checker = checkerSnap.data() || {};
    const checkerName = displayName(checker, "Checker");
    const assignment = {
      ...staffAssignmentFields({
        assigneeId: owner.checkerId,
        assigneeRole: "checker",
        assigneeName: checkerName,
      }),
      participantIds: FieldValue.arrayUnion(owner.checkerId),
      [`participantRoles.${owner.checkerId}`]: "checker",
      [`participantProfiles.${owner.checkerId}`]: {
        name: checkerName,
        role: "checker",
      },
      assignmentSource: "shipment_custody",
      status: "active",
      updatedAt: now,
    };
    await conversationRef.update(assignment);
    return {
      ...conversation,
      ...staffAssignmentFields({
        assigneeId: owner.checkerId,
        assigneeRole: "checker",
        assigneeName: checkerName,
      }),
      assignmentSource: "shipment_custody",
    };
  }

  // Warehouse owns again — if a checker still holds the assignment, hand back
  // to Rose (admin) then Lean (manager).
  if (currentRole === "checker") {
    const roseId = String(process.env.AUTO_SUPPORT_ROSE_UID || "").trim();
    const leanId = String(process.env.AUTO_SUPPORT_LEAN_UID || "").trim();
    const warehouseIds = [roseId, leanId].filter(Boolean);

    let warehouseId = null;
    let warehouseUser = null;
    for (const candidateId of warehouseIds) {
      const snap = await db.collection("users").doc(candidateId).get();
      if (snap.exists && snap.data()?.active !== false) {
        warehouseId = candidateId;
        warehouseUser = snap.data() || {};
        break;
      }
    }

    if (warehouseId) {
      const warehouseName = displayName(warehouseUser, "Atlas Support");
      const warehouseRole = String(warehouseUser.role || "manager")
        .trim()
        .toLowerCase();
      const assignment = {
        ...staffAssignmentFields({
          assigneeId: warehouseId,
          assigneeRole: warehouseRole,
          assigneeName: warehouseName,
        }),
        participantIds: FieldValue.arrayUnion(warehouseId),
        [`participantRoles.${warehouseId}`]: warehouseRole,
        assignmentSource: "custody_ended_warehouse",
        updatedAt: now,
      };
      await conversationRef.update(assignment);
      return {
        ...conversation,
        ...staffAssignmentFields({
          assigneeId: warehouseId,
          assigneeRole: warehouseRole,
          assigneeName: warehouseName,
        }),
        assignmentSource: "custody_ended_warehouse",
      };
    }
  }

  return conversation;
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
      messageStatus: "sent",
      createdAt: now,
      sentAt: now,
      deliveredAt: now,
      seenAt: null,
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
    const isParticipant = participantIds.includes(uid);
    
    // Staff members (admin, manager, employee, checker) can always access direct_staff conversations
    // OR the user must be an explicit participant
    if (STAFF_ROLES.includes(normalizedRole) || isParticipant) {
      return { ref, snap, conversation };
    }
    
    throw new HttpsError(
      "permission-denied",
      "This staff conversation is outside your current assignment.",
    );
  }
  const isAdmin = normalizedRole === "admin" || normalizedRole === "administrator";
  const isManager = normalizedRole === "manager";
  const isCustomer = conversation.customerId === uid;
  const isAssigned = assignedStaffId(conversation) === uid;
  const isParticipant =
    Array.isArray(conversation.participantIds) &&
    conversation.participantIds.includes(uid);
  // Field staff (employee / checker / driver) may access a shipment thread when
  // they are the assigned owner or an explicit participant.
  const isFieldStaff =
    ["employee", "checker", "driver"].includes(normalizedRole) &&
    (isAssigned || isParticipant);

  if (!(isAdmin || isManager || isCustomer || isFieldStaff)) {
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
  const assignedStaffIdValue = String(assignedStaffId(conversation) || "").trim();
  const assignedRole = String(
    assignedStaffRole(conversation) || "",
  ).trim().toLowerCase();
  const isShipmentThread = String(conversation.type || "") === "shipment";
  // Spec §14: one responsible owner. While a checker owns a shipment thread,
  // customer replies notify that checker only — not the whole admin roster.
  const checkerOwnsThread = isShipmentThread && assignedRole === "checker";

  const targetUserIds = [];
  if (assignedStaffIdValue) targetUserIds.push(assignedStaffIdValue);

  if (!checkerOwnsThread) {
    const staffIds = (await getStaffUserIds()).filter(
      (staffId) => staffId !== assignedStaffIdValue,
    );
    targetUserIds.push(...staffIds);
  }

  if (!targetUserIds.length) return;

  const batch = db.batch();
  const now = FieldValue.serverTimestamp();
  const title = checkerOwnsThread
    ? `Customer reply · ${conversation.trackingNumber || "shipment"}`
    : `New chat from ${conversation.customerName || "Customer"}`;

  targetUserIds.forEach((targetUid) => {
    const notificationRef = db
      .collection("users")
      .doc(targetUid)
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
      ownerId: targetUid,
      read: false,
      createdAt: now,
    });
  });

  // Keep a warehouse audit trail, but do not treat it as the primary inbox
  // owner while a checker holds custody.
  if (!checkerOwnsThread) {
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
  }

  await batch.commit();

  await sendExpoPush({
    userIds: targetUserIds,
    title,
    body: message,
    data: {
      screen: "chat",
      conversationId,
      trackingNumber: conversation.trackingNumber || null,
    },
  });
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

function authTokenName(req, fallback = "Guest") {
  const token = req?.auth?.token || {};
  if (typeof token.name === "string" && token.name.trim()) {
    return token.name.trim();
  }
  if (typeof token.email === "string" && token.email.trim()) {
    return token.email.split("@")[0];
  }
  return fallback;
}

async function resolveChatActor(db, req, { requireProfile = true } = {}) {
  const uid = requireAuth(req);
  const guest = isAnonymousAuth(req);

  if (guest) {
    return { uid, role: "guest", user: {}, guest: true, profileMissing: false };
  }

  const userSnap = await db.collection("users").doc(uid).get();
  const missingOrInactive =
    !userSnap.exists || userSnap.data()?.active === false;

  if (missingOrInactive) {
    if (requireProfile) {
      throw new HttpsError("permission-denied", "Inactive or missing user.");
    }

    return {
      uid,
      role: "guest",
      user: { name: authTokenName(req, "Guest") },
      guest: false,
      profileMissing: true,
    };
  }

  const user = userSnap.data() || {};
  return {
    uid,
    role: String(user.role || "").toLowerCase(),
    user,
    guest: false,
    profileMissing: false,
  };
}

async function findOpenWebSupportConversation(uid) {
  const existingSnap = await db
    .collection("conversations")
    .where("customerId", "==", uid)
    .orderBy("lastMessageAt", "desc")
    .limit(10)
    .get();

  return existingSnap.docs.find((doc) => {
    const data = doc.data() || {};
    const status = String(data.status || "open").toLowerCase();
    if (status === "closed") return false;
    if (data.type === "guest_support") return true;
    return data.type === "customer_support" && !data.trackingNumber;
  });
}

/** Open general (non-shipment) customer support thread for a signed-in customer. */
function customerSupportConversationId(uid) {
  return `customer_support_${String(uid || "").trim()}`;
}

async function findOpenCustomerSupportConversation(uid) {
  const canonicalId = customerSupportConversationId(uid);
  const canonicalSnap = await db.collection("conversations").doc(canonicalId).get();
  if (canonicalSnap.exists) {
    const data = canonicalSnap.data() || {};
    const status = String(data.status || "open").toLowerCase();
    if (!["closed", "archived"].includes(status) && data.type === "customer_support") {
      return canonicalSnap;
    }
  }

  const existingSnap = await db
    .collection("conversations")
    .where("customerId", "==", uid)
    .orderBy("lastMessageAt", "desc")
    .limit(40)
    .get();

  return existingSnap.docs.find((doc) => {
    const data = doc.data() || {};
    const status = String(data.status || "open").toLowerCase();
    if (["closed", "archived"].includes(status)) return false;
    if (data.type !== "customer_support") return false;
    return !data.trackingNumber && !data.shipmentId;
  });
}

/** Collapse accidental duplicate general-support threads to a single inbox entry. */
async function archiveDuplicateCustomerSupportThreads(uid, keepId) {
  const keep = String(keepId || "").trim();
  if (!keep) return;

  const existingSnap = await db
    .collection("conversations")
    .where("customerId", "==", uid)
    .orderBy("lastMessageAt", "desc")
    .limit(40)
    .get();

  const duplicates = existingSnap.docs.filter((doc) => {
    if (doc.id === keep) return false;
    const data = doc.data() || {};
    if (String(data.type || "") !== "customer_support") return false;
    if (data.trackingNumber || data.shipmentId) return false;
    const status = String(data.status || "open").toLowerCase();
    return !["closed", "archived"].includes(status);
  });

  if (!duplicates.length) return;

  const now = FieldValue.serverTimestamp();
  for (let i = 0; i < duplicates.length; i += 400) {
    const batch = db.batch();
    duplicates.slice(i, i + 400).forEach((doc) => {
      batch.update(doc.ref, {
        status: "archived",
        archivedReason: "duplicate_default_support",
        updatedAt: now,
      });
    });
    await batch.commit();
  }
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
    const source = String(req.data?.source || "").trim().toLowerCase();
    const isWebSupport = source === "web";
    // Web live chat (incl. post-logout anonymous) must not require a users/{uid}
    // profile. Mobile customer chat still requires an active customer profile.
    const {
      uid,
      role,
      user,
      guest,
      profileMissing,
    } = await resolveChatActor(db, req, {
      requireProfile: !isWebSupport,
    });

    if (role !== "customer" && role !== "guest" && !isWebSupport) {
      throw new HttpsError("permission-denied", "Insufficient role");
    }

    const trackingNumber =
      guest || isWebSupport ? null : normalizeTracking(req.data?.trackingNumber);
    const initialMessage = String(req.data?.message || "").trim();
    const ensureDefault = req.data?.ensureDefault === true;

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

    if (guest || isWebSupport) {
      const existing = await findOpenWebSupportConversation(uid);
      if (existing) {
        return { success: true, conversationId: existing.id, reused: true };
      }
    } else if (trackingNumber) {
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
    } else {
      // Always reuse the customer's open general Atlas Support thread.
      const existing = await findOpenCustomerSupportConversation(uid);
      if (existing) {
        if (ensureDefault) {
          await archiveDuplicateCustomerSupportThreads(uid, existing.id);
        }
        return { success: true, conversationId: existing.id, reused: true };
      }
    }

    // Default Atlas Support inbox entry can be created without a first message.
    if (!initialMessage && !ensureDefault && !(guest || isWebSupport)) {
      return {
        success: false,
        requiresMessage: true,
        message: "Send a message to start a new conversation.",
      };
    }

    const treatAsGuest = guest || profileMissing;
    const isGeneralCustomerSupport = !treatAsGuest && !trackingNumber;
    // One canonical doc per customer so concurrent ensureDefault calls cannot
    // create duplicate Atlas Customer Support inbox rows.
    const conversationRef = isGeneralCustomerSupport
      ? db.collection("conversations").doc(customerSupportConversationId(uid))
      : db.collection("conversations").doc();
    const customerName = treatAsGuest
      ? displayName(user, authTokenName(req, "Guest"))
      : displayName(user, "Customer");
    const now = FieldValue.serverTimestamp();
    const seedText =
      initialMessage ||
      (ensureDefault || isGeneralCustomerSupport
        ? "How can we help you today?"
        : "Conversation started");

    // Race-safe reuse if another request created the canonical doc first.
    if (isGeneralCustomerSupport) {
      const existingCanonical = await conversationRef.get();
      if (existingCanonical.exists) {
        if (ensureDefault) {
          await archiveDuplicateCustomerSupportThreads(uid, conversationRef.id);
        }
        return { success: true, conversationId: conversationRef.id, reused: true };
      }
    }

    let conversation = {
      conversationId: conversationRef.id,
      type: treatAsGuest
        ? "guest_support"
        : trackingNumber
          ? "shipment"
          : "customer_support",
      isGuest: treatAsGuest,
      source: guest || isWebSupport ? "web" : null,
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
      lastMessage: seedText,
      lastMessageType: "text",
      lastMessageSender: initialMessage ? uid : null,
      lastMessageText: seedText,
      lastMessageAt: now,
      lastMessageBy: initialMessage ? uid : null,
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

    if (
      conversation.type === "customer_support" ||
      conversation.type === "guest_support"
    ) {
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
        const existingConversationSnap = await tx.get(conversationRef);
        if (existingConversationSnap.exists) {
          return {
            ...(existingConversationSnap.data() || {}),
            __reusedCanonical: true,
          };
        }

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

      if (conversation.__reusedCanonical) {
        if (ensureDefault || isGeneralCustomerSupport) {
          await archiveDuplicateCustomerSupportThreads(uid, conversationRef.id);
        }
        return { success: true, conversationId: conversationRef.id, reused: true };
      }
    } else {
      await conversationRef.set(conversation);
    }

    if (initialMessage) {
      const initialSentAt = FieldValue.serverTimestamp();
      await conversationRef.collection("messages").add({
        senderId: uid,
        senderRole: role,
        senderName: customerName,
        type: "text",
        text: initialMessage,
        attachments: [],
        status: "sent",
        messageStatus: "sent",
        createdAt: initialSentAt,
        sentAt: initialSentAt,
        deliveredAt: initialSentAt,
        seenAt: null,
        readBy: {
          [uid]: initialSentAt,
        },
        seenBy: {
          [uid]: initialSentAt,
        },
      });

      await notifyStaff({
        conversationId: conversationRef.id,
        conversation,
        message: initialMessage,
        sender: { uid, role, name: customerName },
      });
    }

    if (ensureDefault || isGeneralCustomerSupport) {
      await archiveDuplicateCustomerSupportThreads(uid, conversationRef.id);
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
    const {
      uid,
      role,
      user,
      guest,
      profileMissing,
    } = await resolveChatActor(db, req, { requireProfile: false });
    const conversationId = cleanText(req.data?.conversationId, "conversationId", 160);
    const rawText = req.data?.text;
    const attachmentUrl = req.data?.attachmentUrl || null;
    const attachmentType = String(req.data?.attachmentType || "").trim().toLowerCase();
    const attachmentName = String(req.data?.attachmentName || "").trim() || null;
    const text = rawText == null ? "" : String(rawText).trim();

    if (!text && !attachmentUrl) {
      throw new HttpsError("invalid-argument", "Message text or attachment is required.");
    }

    const { ref, conversation } = await getConversationForUser(
      conversationId,
      uid,
      role,
    );

    if (profileMissing && conversation.customerId !== uid) {
      throw new HttpsError("permission-denied", "Inactive or missing user.");
    }

    if (conversation.status === "closed") {
      throw new HttpsError("failed-precondition", "Conversation is closed.");
    }

    const isDirectStaff = conversation.type === "direct_staff";
    const isRequester = conversation.customerId === uid;
    const isStaff = STAFF_ROLES.includes(role) && !isRequester;
    const isShipmentThread = String(conversation.type || "") === "shipment";

    // Keep shipment ownership aligned with custody before any send/notify.
    let liveConversation = conversation;
    if (isShipmentThread) {
      liveConversation = await syncShipmentConversationOwnership(
        ref,
        conversation,
      );
    }

    // Customer-facing messages from a driver are always blocked, and from a
    // checker are allowed only while the shipment is in their custody and out
    // for delivery (spec sections 7, 8, 13, 17). Admin/manager are unrestricted.
    let shipmentForComms = null;
    if (!isDirectStaff && isStaff && (role === "driver" || role === "checker")) {
      shipmentForComms = await loadShipmentForConversation(liveConversation);
      assertCustomerCommsAllowed({
        uid,
        role,
        shipment: shipmentForComms,
      });
    }

    // Customers must never see employee names (Rose, Lean, etc.) — only
    // "Atlas Support" (spec sections 1, 16). Staff still see real names in
    // direct_staff threads.
    const publicSenderName =
      !isDirectStaff && isStaff ? "Atlas Support" : null;

    const senderName =
      publicSenderName ||
      (guest || profileMissing
        ? displayName(user, authTokenName(req, "Guest"))
        : displayName(
            user,
            isRequester ? "Customer" : isStaff ? "Staff" : "Customer",
          ));
    // Internal assignment should keep the real staff name; customers only see
    // the masked senderName on the message bubble.
    const assignmentDisplayName = displayName(
      user,
      isStaff ? "Atlas staff" : "Customer",
    );
    const senderRole =
      guest || profileMissing || isRequester
        ? guest || profileMissing
          ? "guest"
          : "customer"
        : role;
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
      status: normalizeConversationStatus(liveConversation.status) === "closed" ? "closed" : normalizeConversationStatus(liveConversation.status) === "unassigned" ? "active" : normalizeConversationStatus(liveConversation.status),
    };

    if (isDirectStaff) {
      (liveConversation.participantIds || []).forEach((participantId) => {
        updates[`unreadCounts.${participantId}`] =
          participantId === uid ? 0 : FieldValue.increment(1);
      });
      updates[`participantRoles.${uid}`] = role;
    } else if (isStaff) {
      updates[`unreadCounts.${liveConversation.customerId}`] = FieldValue.increment(1);
      updates.unreadCustomer = FieldValue.increment(1);
      updates.unreadStaff = 0;
      updates["unreadCounts.staff"] = 0;
      // Checker with custody always takes ownership of the shipment thread
      // (even if Admin was previously assigned). Other staff claim only when
      // unassigned.
      const shouldTakeOwnership =
        role === "checker" || !assignedStaffId(liveConversation);
      if (shouldTakeOwnership) {
        Object.assign(
          updates,
          staffAssignmentFields({
            assigneeId: uid,
            assigneeRole: role,
            assigneeName: assignmentDisplayName,
          }),
        );
        if (role === "checker") {
          updates.assignmentSource = "checker_message";
        }
      }
      updates[`participantRoles.${uid}`] = role;
      updates.participantIds = FieldValue.arrayUnion(uid);
    } else {
      updates.unreadStaff = FieldValue.increment(1);
      updates.unreadCustomer = 0;
      updates["unreadCounts.staff"] = FieldValue.increment(1);
      const assigneeId = String(assignedStaffId(liveConversation) || "").trim();
      if (assigneeId) {
        updates[`unreadCounts.${assigneeId}`] = FieldValue.increment(1);
      }
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
        senderRole,
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
        messageStatus: "sent",
        createdAt: now,
        sentAt: now,
        deliveredAt: now,
        seenAt: null,
        readBy: {
          [uid]: now,
        },
        seenBy: {
          [uid]: now,
        },
      });
      tx.update(ref, updates);
    });

    const conversationForNotify = {
      ...liveConversation,
      ...(isStaff && (role === "checker" || !assignedStaffId(liveConversation))
        ? staffAssignmentFields({
            assigneeId: uid,
            assigneeRole: role,
            assigneeName: assignmentDisplayName,
          })
        : {}),
    };

    if (isDirectStaff) {
      await notifyDirectParticipants({
        conversationId,
        conversation: conversationForNotify,
        message: messageText,
        sender: { uid, role, name: senderName },
      });
    } else if (isStaff) {
      if (!liveConversation.isGuest) {
        await notifyCustomer({
          conversationId,
          customerId: liveConversation.customerId,
          message: messageText,
          sender: { uid, role, name: senderName },
        });
      }
    } else {
      await notifyStaff({
        conversationId,
        conversation: conversationForNotify,
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
    const { uid, role, profileMissing } = await resolveChatActor(db, req, {
      requireProfile: false,
    });
    const conversationId = cleanText(req.data?.conversationId, "conversationId", 160);

    const { ref, conversation } = await getConversationForUser(
      conversationId,
      uid,
      role,
    );

    if (profileMissing && conversation.customerId !== uid) {
      throw new HttpsError("permission-denied", "User profile missing.");
    }

    const directStaff = conversation.type === "direct_staff";
    const isStaffReader =
      STAFF_ROLES.includes(role) && conversation.customerId !== uid;
    const key = directStaff
      ? uid
      : isStaffReader
        ? "staff"
        : uid;

    const updates = {
      [`unreadCounts.${key}`]: 0,
      [`lastReadAt.${uid}`]: FieldValue.serverTimestamp(),
    };
    // Checkers (and any assigned staff) also clear their personal unread bucket
    // used when customers reply on shipment threads.
    if (isStaffReader) {
      updates[`unreadCounts.${uid}`] = 0;
      updates.unreadStaff = 0;
    }
    if (!directStaff) {
      updates.unreadCustomer = role === "customer" ? 0 : FieldValue.increment(0);
      if (role === "customer") {
        updates.unreadStaff = FieldValue.increment(0);
      }
    }

    const requestedIds = Array.isArray(req.data?.messageIds)
      ? [...new Set(
          req.data.messageIds
            .map((value) => String(value || "").trim())
            .filter(Boolean),
        )].slice(0, 200)
      : [];
    let messageDocs = [];

    if (requestedIds.length) {
      const refs = requestedIds.map((messageId) =>
        ref.collection("messages").doc(messageId),
      );
      messageDocs = await db.getAll(...refs);
    } else {
      // Backward compatibility for older clients. New clients always provide
      // visible message IDs so online presence alone never marks a message seen.
      const latest = await ref
        .collection("messages")
        .orderBy("createdAt", "desc")
        .limit(200)
        .get();
      messageDocs = latest.docs;
    }

    const batch = db.batch();
    batch.update(ref, updates);
    let seenCount = 0;
    messageDocs.forEach((messageDoc) => {
      if (!messageDoc.exists) return;
      const message = messageDoc.data() || {};
      if (String(message.senderId || "") === uid) return;
      const alreadySeenByUser = Boolean(message.seenBy?.[uid] || message.readBy?.[uid]);
      if (alreadySeenByUser && message.messageStatus === "seen") return;
      const seenUpdate = {
        [`seenBy.${uid}`]: FieldValue.serverTimestamp(),
        [`readBy.${uid}`]: FieldValue.serverTimestamp(),
        messageStatus: "seen",
      };
      if (!message.seenAt) {
        seenUpdate.seenAt = FieldValue.serverTimestamp();
      }
      batch.update(messageDoc.ref, seenUpdate);
      seenCount += 1;
    });
    await batch.commit();

    return { success: true, seenCount };
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
            conversationType: conversation.type || null,
            shipmentId:
              conversation.shipmentId || conversation.trackingNumber || null,
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
      const isAdminCaller = ["admin", "administrator"].includes(role);
      const isManagerCaller = role === "manager";
      const isCheckerCaller = role === "checker";
      if (
        !isCustomerCaller &&
        !isAdminCaller &&
        !isManagerCaller &&
        !isCheckerCaller
      ) {
        // Drivers and any other role may never reach a customer (spec 13, 17).
        throw new HttpsError("permission-denied", "403 Permission Denied");
      }

      await getConversationForUser(conversationId, uid, role);

      // Load the shipment so custody rules can be enforced (checker) and so a
      // customer-initiated call routes to the current responsible owner.
      const shipment = await loadShipmentForConversation(conversation);

      // A checker may only reach a customer while the shipment is out for
      // delivery in their custody with an undelivered piece (spec 7, 8, 17).
      if (isCheckerCaller) {
        assertCustomerCommsAllowed({ uid, role, shipment });
      }

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

      let receiverId;
      let expectedReceiverRole; // null => accept any active staff (support)
      let assignedStaffRoleForCall;
      let supportRouting = null;
      let overrideReceiverName = null;

      // Customer-facing threads (support + shipment) are branded "Atlas Support".
      // Voice/Video always use Rose → Lean (spec §2), even when a checker owns
      // the shipment chat during OFD. Messaging ownership stays separate (§14).
      const isCustomerFacingSupportThread = [
        "customer_support",
        "guest_support",
        "shipment",
      ].includes(String(conversation.type || ""));

      if (isCustomerCaller) {
        if (isCustomerFacingSupportThread) {
          // Atlas Customer Support: ring Rose (admin) first, then fall back to
          // Lean (manager) on no-answer (spec section 2).
          const roseId = String(process.env.AUTO_SUPPORT_ROSE_UID || "").trim();
          const leanId = String(process.env.AUTO_SUPPORT_LEAN_UID || "").trim();

          let primaryId = roseId || leanId;
          let ringingRose = !!roseId && primaryId === roseId;

          // Skip straight to Lean when Rose is missing or deactivated.
          if (roseId) {
            const roseSnap = await db.collection("users").doc(roseId).get();
            if (!roseSnap.exists || roseSnap.data()?.active === false) {
              primaryId = leanId || null;
              ringingRose = false;
            }
          }

          if (!primaryId) {
            throw new HttpsError(
              "failed-precondition",
              "Atlas Customer Support is not available right now.",
            );
          }

          receiverId = primaryId;
          expectedReceiverRole = null;
          assignedStaffRoleForCall = "support";
          overrideReceiverName = "Atlas Support";
          supportRouting = {
            primaryId: roseId || null,
            secondaryId: leanId || null,
            // Only leave room for a fallback when we are actually ringing Rose
            // first and a distinct Lean exists.
            stage:
              ringingRose && leanId && leanId !== roseId ? "primary" : "secondary",
          };
        } else {
          // Non-support customer threads: route to assigned staff if any.
          const assignedManagerId = String(
            assignedStaffId(conversation) ||
              customerData.primaryAssignedStaffId ||
              "",
          ).trim();
          if (!assignedManagerId) {
            throw new HttpsError(
              "failed-precondition",
              "This conversation has no assigned manager.",
            );
          }
          receiverId = assignedManagerId;
          expectedReceiverRole = null;
          assignedStaffRoleForCall = "support";
          overrideReceiverName = "Atlas Support";
        }
      } else {
        // Staff (admin / manager / authorized checker) calling the customer.
        receiverId = customerId;
        expectedReceiverRole = "customer";
        assignedStaffRoleForCall = role;
      }

      const receiverSnap = await db.collection("users").doc(receiverId).get();
      if (!receiverSnap.exists || receiverSnap.data()?.active === false) {
        throw new HttpsError("failed-precondition", "The other participant is not available for calls.");
      }

      const receiverRole = String(receiverSnap.data()?.role || "").trim().toLowerCase();
      if (expectedReceiverRole && receiverRole !== expectedReceiverRole) {
        throw new HttpsError(
          "failed-precondition",
          `The call recipient must be a ${expectedReceiverRole}.`,
        );
      }

      // Communication log context (spec section 18).
      const commsCheckerId = isCheckerCaller
        ? uid
        : receiverRole === "checker"
          ? receiverId
          : null;
      const commsPieceIds =
        commsCheckerId && shipment
          ? getCheckerActivePieceIds(shipment, commsCheckerId)
          : [];

      return createRingingConversationCall({
        conversationId,
        callType,
        callerId: uid,
        callerRole: role,
        // Staff calling a customer always appear as "Atlas Support" so the
        // customer never sees employee names (spec sections 1, 16).
        callerName: isCustomerCaller
          ? displayName(user, "Customer")
          : "Atlas Support",
        callerSessionId,
        callerDeviceId,
        receiverId,
        receiverRole,
        receiverName:
          overrideReceiverName ||
          (expectedReceiverRole === "customer"
            ? displayName(receiverSnap.data() || {}, "Customer")
            : displayName(receiverSnap.data() || {}, "This contact")),
        participantIds: [uid, receiverId],
        extraFields: {
          conversationType: conversation.type || null,
          shipmentId: conversation.shipmentId || conversation.trackingNumber || null,
          pieceIds: commsPieceIds,
          checkerId: commsCheckerId,
          customerId,
          assignedStaffId: expectedReceiverRole === "customer" ? uid : receiverId,
          assignedStaffRole: assignedStaffRoleForCall,
          ...(supportRouting ? { supportRouting } : {}),
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

/**
 * Return a customer's phone number(s) for the cell-phone dialer, but only after
 * the backend re-validates the caller's authority (spec section 17). Customers
 * never use this — they only ever see "Atlas Customer Support".
 */
exports.getCustomerContactForShipment = onCall(
  { region: "asia-southeast1", maxInstances: 20 },
  async (req) => {
    try {
      const uid = requireAuth(req);
      const shipmentRef = cleanText(
        req.data?.shipmentId || req.data?.trackingNumber,
        "shipmentId",
        160,
      );

      const userSnap = await db.collection("users").doc(uid).get();
      if (!userSnap.exists || userSnap.data()?.active === false) {
        throw new HttpsError("permission-denied", "Inactive or missing user.");
      }
      const role = String(userSnap.data()?.role || "").trim().toLowerCase();

      let shipment = null;
      try {
        ({ shipment } = await resolveShipmentReference(db, shipmentRef));
      } catch (error) {
        throw new HttpsError("not-found", "Shipment not found.");
      }

      // Enforces: admin/manager unrestricted, driver denied, checker only while
      // in custody and out for delivery. Throws 403 otherwise.
      assertCustomerCommsAllowed({ uid, role, shipment });

      const recipient = shipment.recipient || {};
      const primaryPhone =
        String(
          recipient.phone ||
            shipment.consigneePhone ||
            shipment.customerPhone ||
            "",
        ).trim() || null;
      const secondaryPhone =
        String(recipient.secondaryPhone || recipient.altPhone || "").trim() ||
        null;

      if (!primaryPhone && !secondaryPhone) {
        throw new HttpsError(
          "failed-precondition",
          "No phone number is on file for this customer.",
        );
      }

      return {
        success: true,
        customerName: recipient.name || shipment.consigneeName || "Customer",
        primaryPhone,
        secondaryPhone,
      };
    } catch (error) {
      if (error instanceof HttpsError) throw error;
      console.error("getCustomerContactForShipment failed:", error);
      throw new HttpsError("internal", "Failed to retrieve customer contact.");
    }
  },
);

/**
 * Get (or create) the shipment conversation used for in-app Atlas RTC calls and
 * messaging between an authorized staff member and the shipment's customer.
 * Enforces the same custody rules as calls (spec sections 7, 8, 11, 17), and
 * requires the customer to have an Atlas account (otherwise only the cell-phone
 * dialer path via getCustomerContactForShipment is available).
 */
exports.getOrCreateShipmentConversation = onCall(
  { region: "asia-southeast1", maxInstances: 10 },
  async (req) => {
    try {
      const uid = requireAuth(req);
      const shipmentRefCode = cleanText(
        req.data?.shipmentId || req.data?.trackingNumber,
        "shipmentId",
        160,
      );

      const userSnap = await db.collection("users").doc(uid).get();
      if (!userSnap.exists || userSnap.data()?.active === false) {
        throw new HttpsError("permission-denied", "Inactive or missing user.");
      }
      const actor = userSnap.data() || {};
      const role = String(actor.role || "").trim().toLowerCase();

      let shipment = null;
      let shipmentDocId = shipmentRefCode;
      try {
        const resolved = await resolveShipmentReference(db, shipmentRefCode);
        shipment = resolved.shipment;
        shipmentDocId = resolved.shipmentDocId;
      } catch (error) {
        throw new HttpsError("not-found", "Shipment not found.");
      }

      assertCustomerCommsAllowed({ uid, role, shipment });

      // The in-app RTC/chat path needs the customer's Atlas account.
      const candidateIds = [
        shipment.recipient?.uid,
        shipment.customerId,
        shipment.sender?.uid,
        shipment.createdBy,
      ]
        .map((value) => String(value || "").trim())
        .filter(Boolean);

      let customerId = null;
      let customerUser = null;
      for (const candidate of candidateIds) {
        const snap = await db.collection("users").doc(candidate).get();
        if (
          snap.exists &&
          String(snap.data()?.role || "").toLowerCase() === "customer"
        ) {
          customerId = candidate;
          customerUser = snap.data() || {};
          break;
        }
      }

      if (!customerId) {
        throw new HttpsError(
          "failed-precondition",
          "This customer has no Atlas account. Use the cell phone option instead.",
        );
      }

      const now = FieldValue.serverTimestamp();
      const callerName = displayName(actor, "Atlas staff");
      const isCheckerActor = role === "checker";

      const existingSnap = await db
        .collection("conversations")
        .where("customerId", "==", customerId)
        .where("trackingNumber", "==", shipmentDocId)
        .limit(10)
        .get();

      const existing = existingSnap.docs.find(
        (docSnap) =>
          String(docSnap.data()?.status || "open").toLowerCase() !== "closed",
      );

      if (existing) {
        const existingData = existing.data() || {};
        const updates = {
          participantIds: FieldValue.arrayUnion(uid),
          [`participantRoles.${uid}`]: role,
          [`participantProfiles.${uid}`]: { name: callerName, role },
          updatedAt: now,
        };
        // Checker opening/messaging from My Deliveries takes ownership while
        // they hold custody (spec §14) — even if Admin was previously assigned.
        if (isCheckerActor) {
          Object.assign(
            updates,
            staffAssignmentFields({
              assigneeId: uid,
              assigneeRole: "checker",
              assigneeName: callerName,
            }),
          );
          updates.assignmentSource = "checker_open_shipment";
          updates.status = "active";
        }
        await existing.ref.update(updates);
        // Re-sync in case custody already ended (hand back to warehouse).
        await syncShipmentConversationOwnership(existing.ref, {
          ...existingData,
          ...updates,
          type: existingData.type || "shipment",
          shipmentId: existingData.shipmentId || shipmentDocId,
          trackingNumber: existingData.trackingNumber || shipmentDocId,
          assignedStaffId: isCheckerActor ? uid : assignedStaffId(existingData),
          assignedStaffRole: isCheckerActor
            ? "checker"
            : assignedStaffRole(existingData),
        });
        return {
          success: true,
          conversationId: existing.id,
          customerId,
          reused: true,
        };
      }

      const conversationRef = db.collection("conversations").doc();
      await conversationRef.set({
        conversationId: conversationRef.id,
        type: "shipment",
        isGuest: false,
        source: null,
        shipmentId: shipmentDocId,
        trackingNumber: shipmentDocId,
        shipmentSummary: {
          status: shipment.status || null,
          origin: shipment.origin || shipment.sender?.address?.city || null,
          destination:
            shipment.destination ||
            shipment.recipient?.address?.city ||
            null,
        },
        customerId,
        customerName: displayName(customerUser, "Customer"),
        customerPhone:
          customerUser.phoneNumber ||
          customerUser.phone ||
          shipment.recipient?.phone ||
          null,
        ...staffAssignmentFields({
          assigneeId: isCheckerActor ? uid : null,
          assigneeRole: isCheckerActor ? "checker" : null,
          assigneeName: isCheckerActor ? callerName : null,
        }),
        participantIds: [uid, customerId],
        participantRoles: { [uid]: role, [customerId]: "customer" },
        participantProfiles: { [uid]: { name: callerName, role } },
        lastMessage: "Conversation started",
        lastMessageText: "Conversation started",
        lastMessageAt: now,
        lastMessageBy: uid,
        lastActivityAt: now,
        status: "active",
        priority: "normal",
        unreadCustomer: 0,
        unreadStaff: 0,
        unreadCounts: { [uid]: 0, [customerId]: 0, staff: 0 },
        createdAt: now,
        updatedAt: now,
      });

      return {
        success: true,
        conversationId: conversationRef.id,
        customerId,
        reused: false,
      };
    } catch (error) {
      if (error instanceof HttpsError) throw error;
      console.error("getOrCreateShipmentConversation failed:", error);
      throw new HttpsError(
        "internal",
        "Failed to open the shipment conversation.",
      );
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

    // Atlas Support sequential fallback: if the primary agent (Rose) did not
    // answer, automatically ring the secondary agent (Lean) (spec section 2).
    let fallbackCallId = null;
    if (
      transition.changed &&
      SUPPORT_FALLBACK_STATUSES.includes(status) &&
      // The caller hanging up (reason "cancelled") must not trigger a fallback.
      endReason !== "cancelled"
    ) {
      const call = transition.call || {};
      const routing = call.supportRouting;
      if (
        routing &&
        routing.stage === "primary" &&
        routing.secondaryId &&
        routing.secondaryId !== routing.primaryId
      ) {
        try {
          const fallback = await startSupportFallbackCall(call, routing);
          fallbackCallId = fallback?.callId || null;
        } catch (error) {
          console.error("Atlas Support fallback ring failed:", error);
        }
      }
    }

    return {
      success: true,
      changed: transition.changed,
      callId,
      status: transition.status,
      event: TERMINAL_CALL_STATUSES.includes(transition.status) ? "call_ended" : null,
      fallbackCallId,
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
    const role = String(userSnap.data()?.role || "").trim().toLowerCase();
    await getAuthorizedCallForUser(callRef, uid, userSnap.data() || {});

    // Spec section 12: end customer communication immediately when custody ends.
    // Re-check on each heartbeat so an active checker↔customer call cannot continue
    // after delivery / return / reassignment.
    const preSnap = await callRef.get();
    if (preSnap.exists) {
      const preCall = preSnap.data() || {};
      const preStatus = String(preCall.status || "").trim().toLowerCase();
      const involvesCustomer =
        String(preCall.callerRole || "").toLowerCase() === "customer" ||
        String(preCall.receiverRole || "").toLowerCase() === "customer";
      const shipmentRef = String(preCall.shipmentId || "").trim();
      if (
        ACTIVE_CALL_STATUSES.includes(preStatus) &&
        involvesCustomer &&
        role === "checker" &&
        shipmentRef
      ) {
        let shipment = null;
        try {
          ({ shipment } = await resolveShipmentReference(db, shipmentRef));
        } catch (_) {
          shipment = null;
        }
        const { allowed } = evaluateCheckerCustomerComms(shipment || {}, uid);
        if (!allowed) {
          const now = FieldValue.serverTimestamp();
          await db.runTransaction(async (tx) => {
            const snap = await tx.get(callRef);
            if (!snap.exists) return;
            const call = snap.data() || {};
            if (TERMINAL_CALL_STATUSES.includes(String(call.status || "").toLowerCase())) {
              return;
            }
            const callerLockRef = db.collection(CALL_LOCK_COLLECTION).doc(call.callerId);
            const receiverLockRef = db.collection(CALL_LOCK_COLLECTION).doc(call.receiverId);
            tx.update(callRef, {
              status: "ended",
              endedAt: now,
              endedBy: "system",
              endedReason: "custody_ended",
              updatedAt: now,
              signalingEvent: "call_ended",
              termination: {
                event: "call_ended",
                callId,
                endedBy: "system",
                reason: "custody_ended",
                participantIds: [call.callerId, call.receiverId].filter(Boolean),
                timestamp: now,
              },
            });
            tx.delete(callerLockRef);
            tx.delete(receiverLockRef);
          });
          return { success: true, active: false, status: "ended", reason: "custody_ended" };
        }
      }
    }

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
