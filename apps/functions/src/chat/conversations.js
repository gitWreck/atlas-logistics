"use strict";

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const {
  requireAuth,
  isAnonymousAuth,
  requireRole,
} = require("../utilities/helpers");
const { customerOwnsShipment } = require("../utilities/customerShipmentAccess");

if (!admin.apps.length) admin.initializeApp();

const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;

const STAFF_ROLES = ["admin", "manager"];
const VALID_STATUSES = ["open", "pending", "resolved", "closed"];
const VALID_PRIORITIES = ["normal", "urgent"];

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

function displayName(user = {}, fallback = "User") {
  return (
    user.name ||
    user.displayName ||
    user.fullName ||
    user.email ||
    fallback
  );
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
  const isStaff = STAFF_ROLES.includes(role);
  const isCustomer = conversation.customerId === uid;
  const isAssigned = conversation.assignedTo === uid;
  const isParticipant = Array.isArray(conversation.participantIds)
    ? conversation.participantIds.includes(uid)
    : false;

  if (!isStaff && !isCustomer && !isAssigned && !isParticipant) {
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
  const staffIds = await getStaffUserIds();
  if (!staffIds.length) return;

  const batch = db.batch();
  const now = FieldValue.serverTimestamp();
  const title = `New chat from ${conversation.customerName || "Customer"}`;

  staffIds.forEach((uid) => {
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
    title: `Reply from ${sender.role === "admin" ? "Admin" : "Manager"}`,
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

exports.createConversation = onCall(
  { region: "asia-southeast1", maxInstances: 10 },
  async (req) => {
    const source = String(req.data?.source || "").trim().toLowerCase();
    const isWebSupport = source === "web";
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
    }

    if (!initialMessage) {
      return {
        success: false,
        requiresMessage: true,
        message: "Send a message to start a new conversation.",
      };
    }

    const conversationRef = db.collection("conversations").doc();
    const treatAsGuest = guest || profileMissing;
    const customerName = treatAsGuest
      ? displayName(user, authTokenName(req, "Guest"))
      : displayName(user, "Customer");
    const now = FieldValue.serverTimestamp();

    const conversation = {
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
      assignedTo: null,
      assignedRole: null,
      participantIds: [uid],
      participantRoles: {
        [uid]: role,
      },
      lastMessageText: initialMessage || "Conversation started",
      lastMessageAt: now,
      lastMessageBy: uid,
      status: "open",
      priority: "normal",
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
    const text = cleanText(req.data?.text);
    const conversationId = cleanText(req.data?.conversationId, "conversationId", 160);

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

    const isRequester = conversation.customerId === uid;
    const isStaff = STAFF_ROLES.includes(role) && !isRequester;
    const senderName =
      guest || profileMissing
        ? displayName(user, authTokenName(req, "Guest"))
        : displayName(
            user,
            isRequester ? "Customer" : isStaff ? "Staff" : "Customer",
          );
    const senderRole =
      guest || profileMissing || isRequester
        ? guest || profileMissing
          ? "guest"
          : "customer"
        : role;
    const now = FieldValue.serverTimestamp();
    const updates = {
      lastMessageText: text,
      lastMessageAt: now,
      lastMessageBy: uid,
      updatedAt: now,
      status: conversation.status === "resolved" ? "open" : conversation.status,
    };

    if (isStaff) {
      updates[`unreadCounts.${conversation.customerId}`] = FieldValue.increment(1);
      updates["unreadCounts.staff"] = 0;
      updates.assignedTo = conversation.assignedTo || uid;
      updates.assignedRole = conversation.assignedRole || role;
      updates[`participantRoles.${uid}`] = role;
      updates.participantIds = FieldValue.arrayUnion(uid);
    } else {
      updates["unreadCounts.staff"] = FieldValue.increment(1);
    }

    await db.runTransaction(async (tx) => {
      const latest = await tx.get(ref);
      if (!latest.exists) {
        throw new HttpsError("not-found", "Conversation not found.");
      }

      const messageRef = ref.collection("messages").doc();
      tx.set(messageRef, {
        senderId: uid,
        senderRole,
        senderName,
        type: "text",
        text,
        attachments: [],
        createdAt: now,
        readBy: {
          [uid]: now,
        },
      });
      tx.update(ref, updates);
    });

    if (isStaff) {
      if (!conversation.isGuest) {
        await notifyCustomer({
          conversationId,
          customerId: conversation.customerId,
          message: text,
          sender: { uid, role, name: senderName },
        });
      }
    } else {
      await notifyStaff({
        conversationId,
        conversation,
        message: text,
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

    const key = STAFF_ROLES.includes(role) && conversation.customerId !== uid
      ? "staff"
      : uid;

    await ref.update({
      [`unreadCounts.${key}`]: 0,
      updatedAt: FieldValue.serverTimestamp(),
    });

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

    const update = {
      status,
      updatedAt: FieldValue.serverTimestamp(),
      statusUpdatedBy: uid,
      statusUpdatedByRole: role,
    };
    if (priority) update.priority = priority;

    await db.collection("conversations").doc(conversationId).update(update);
    return { success: true };
  },
);

exports.assignConversation = onCall(
  { region: "asia-southeast1", maxInstances: 10 },
  async (req) => {
    const { uid, role } = await requireRole(db, req, STAFF_ROLES);
    const conversationId = cleanText(req.data?.conversationId, "conversationId", 160);
    const assigneeId = String(req.data?.assigneeId || uid).trim();

    const assigneeSnap = await db.collection("users").doc(assigneeId).get();
    if (!assigneeSnap.exists) {
      throw new HttpsError("not-found", "Assignee not found.");
    }

    const assignee = assigneeSnap.data() || {};
    const assigneeRole = String(assignee.role || "").toLowerCase();
    if (!STAFF_ROLES.includes(assigneeRole)) {
      throw new HttpsError("invalid-argument", "Assignee must be staff.");
    }

    await db.collection("conversations").doc(conversationId).update({
      assignedTo: assigneeId,
      assignedRole: assigneeRole,
      participantIds: FieldValue.arrayUnion(assigneeId),
      [`participantRoles.${assigneeId}`]: assigneeRole,
      updatedAt: FieldValue.serverTimestamp(),
      assignedBy: uid,
      assignedByRole: role,
    });

    return { success: true };
  },
);
