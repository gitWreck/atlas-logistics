"use strict";

const crypto = require("crypto");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const { requireRole } = require("../utilities/helpers");

if (!admin.apps.length) admin.initializeApp();

const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;
// Include all variations of staff roles to ensure no one is filtered out
const CONTACT_ROLES = ["driver", "checker", "manager", "admin", "employee", "administrator", "staff", "support"];
const INACTIVE_TRIP_STATUSES = new Set([
  "completed",
  "cancelled",
  "canceled",
  "archived",
  "closed",
]);

function normalized(value) {
  return String(value || "")
    .trim()
    .replace(/[^a-z0-9]/gi, "")
    .toLowerCase();
}

function uniqueStrings(values = []) {
  return [...new Set(values.map((value) => String(value || "").trim()).filter(Boolean))];
}

function warehouseKeys(user = {}) {
  return uniqueStrings([
    user.warehouseId,
    user.warehouseCode,
    user.warehouseName,
    user.assignedWarehouseId,
    user.assignedWarehouseCode,
  ]).map(normalized).filter(Boolean);
}

function municipalityLabels(user = {}) {
  return uniqueStrings([
    ...(Array.isArray(user.assignedMunicipalities) ? user.assignedMunicipalities : []),
    ...(Array.isArray(user.municipalityCoverage) ? user.municipalityCoverage : []),
    ...(Array.isArray(user.serviceMunicipalities) ? user.serviceMunicipalities : []),
    ...(Array.isArray(user.handledMunicipalities) ? user.handledMunicipalities : []),
    user.assignedMunicipality,
    user.municipality,
  ]);
}

function overlaps(left = [], right = []) {
  const rightKeys = new Set(right.map(normalized).filter(Boolean));
  return left.some((value) => rightKeys.has(normalized(value)));
}

function sharesWarehouse(checker = {}, contact = {}) {
  const checkerKeys = warehouseKeys(checker);
  const contactKeys = new Set(warehouseKeys(contact));
  // If either user has no warehouse info, allow the contact (no warehouse restriction)
  if (checkerKeys.length === 0 || contactKeys.size === 0) {
    return true;
  }
  // Both have warehouse info, so they must match
  return checkerKeys.some((key) => contactKeys.has(key));
}

function displayName(user = {}, fallback = "Atlas staff") {
  return user.name || user.displayName || user.fullName || user.email || fallback;
}

function contactRoleLabel(user = {}) {
  const role = String(user.role || "").trim().toLowerCase();
  const descriptor = [user.jobTitle, user.position, user.department, user.team]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (role === "driver") return "Assigned Driver";
  if (role === "checker") return "Checker";
  if (descriptor.includes("supervisor")) return "Warehouse Supervisor";
  if (role === "manager") return "Warehouse Manager";
  if (descriptor.includes("customer") || descriptor.includes("support")) {
    return "Customer Service Representative";
  }
  if (descriptor.includes("dispatch")) return "Dispatcher";
  return "Operations Staff";
}

function profilePhoto(user = {}) {
  return user.photoURL || user.profilePhotoURL || user.profilePicture || user.avatarUrl || null;
}

function isOnline(user = {}) {
  if (user.isOnline === true || String(user.onlineStatus || "").toLowerCase() === "online") {
    return true;
  }
  const lastSeen = user.lastSeenAt || user.lastSeen || user.lastActiveAt;
  const date = typeof lastSeen?.toDate === "function" ? lastSeen.toDate() : new Date(lastSeen || 0);
  return Number.isFinite(date.getTime()) && Date.now() - date.getTime() < 5 * 60 * 1000;
}

function checkerAccessKey(checker = {}) {
  const payload = JSON.stringify({
    warehouse: warehouseKeys(checker).sort(),
    municipalities: municipalityLabels(checker).map(normalized).sort(),
  });
  return crypto.createHash("sha256").update(payload).digest("hex").slice(0, 32);
}

function checkerAccessToken(uid, accessKey) {
  return `${uid}:${accessKey}`;
}

async function ensureCheckerAccessKey(uid, checker, ref = db.collection("users").doc(uid)) {
  const accessKey = checkerAccessKey(checker);
  if (checker.checkerChatAccessKey !== accessKey) {
    await ref.set(
      {
        checkerChatAccessKey: accessKey,
        checkerChatAccessUpdatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
  }
  return accessKey;
}

function driverAccessKey(driver = {}) {
  const payload = JSON.stringify({
    warehouse: warehouseKeys(driver).sort(),
    municipalities: municipalityLabels(driver).map(normalized).sort(),
  });
  return crypto.createHash("sha256").update(payload).digest("hex").slice(0, 32);
}

function driverAccessToken(uid, accessKey) {
  return `${uid}:${accessKey}`;
}

async function ensureDriverAccessKey(uid, driver, ref = db.collection("users").doc(uid)) {
  const accessKey = driverAccessKey(driver);
  if (driver.driverChatAccessKey !== accessKey) {
    await ref.set(
      {
        driverChatAccessKey: accessKey,
        driverChatAccessUpdatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
  }
  return accessKey;
}

async function routeCoverageById() {
  const snap = await db.collection("routes").where("active", "==", true).get();
  const result = new Map();
  snap.docs.forEach((docSnap) => {
    const route = docSnap.data() || {};
    result.set(docSnap.id, {
      municipalities: uniqueStrings(route.municipalityCoverage || []),
      warehouse: warehouseKeys(route),
    });
    if (route.routeId) result.set(String(route.routeId), result.get(docSnap.id));
  });
  return result;
}

async function deriveDriverCoverage(drivers = []) {
  const coverage = new Map(drivers.map((driver) => [driver.id, municipalityLabels(driver)]));
  const driverIds = drivers.map((driver) => driver.id);
  if (!driverIds.length) return coverage;

  const routes = await routeCoverageById();
  for (let index = 0; index < driverIds.length; index += 30) {
    const ids = driverIds.slice(index, index + 30);
    const snap = await db.collection("truck_trips").where("driverId", "in", ids).get();
    snap.docs.forEach((docSnap) => {
      const trip = docSnap.data() || {};
      if (INACTIVE_TRIP_STATUSES.has(String(trip.status || "").toLowerCase())) return;
      const current = coverage.get(trip.driverId) || [];
      const route = routes.get(String(trip.routeId || ""));
      coverage.set(
        trip.driverId,
        uniqueStrings([
          ...current,
          ...(route?.municipalities || []),
          ...(Array.isArray(trip.municipalityCoverage) ? trip.municipalityCoverage : []),
          trip.municipality,
        ]),
      );
    });
  }
  return coverage;
}

function contactIsAuthorized(checker, contact, contactMunicipalities = municipalityLabels(contact)) {
  if (!contact || contact.active === false || String(contact.status || "").toLowerCase() === "inactive") {
    return false;
  }
  const role = String(contact.role || "").toLowerCase();
  if (!CONTACT_ROLES.includes(role) || !sharesWarehouse(checker, contact)) return false;

  const checkerMunicipalities = municipalityLabels(checker);
  if (role === "driver" || role === "checker") {
    // Allow if either has no municipality restriction, or if they overlap
    return checkerMunicipalities.length === 0 || contactMunicipalities.length === 0 || overlaps(checkerMunicipalities, contactMunicipalities);
  }

  // Area-scoped support employees must overlap. Warehouse-wide management and
  // operations contacts remain available when they do not declare an area.
  return !contactMunicipalities.length || checkerMunicipalities.length === 0 || overlaps(checkerMunicipalities, contactMunicipalities);
}

function serializeContact(id, user, municipalities = municipalityLabels(user)) {
  return {
    id,
    name: displayName(user),
    role: String(user.role || "").toLowerCase(),
    roleLabel: contactRoleLabel(user),
    municipality: municipalities.join(", ") || "Warehouse-wide",
    municipalities,
    warehouseName: user.warehouseName || user.warehouseCode || null,
    photoURL: profilePhoto(user),
    online: isOnline(user),
  };
}

async function authorizedContactsForChecker(uid, checker) {
  const usersSnap = await db.collection("users").where("role", "in", CONTACT_ROLES).get();
  const users = usersSnap.docs
    .filter((docSnap) => docSnap.id !== uid)
    .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
  const drivers = users.filter((user) => String(user.role || "").toLowerCase() === "driver");
  const driverCoverage = await deriveDriverCoverage(drivers);

  return users
    .filter((contact) =>
      contactIsAuthorized(
        checker,
        contact,
        driverCoverage.get(contact.id) || municipalityLabels(contact),
      ),
    )
    .map((contact) =>
      serializeContact(
        contact.id,
        contact,
        driverCoverage.get(contact.id) || municipalityLabels(contact),
      ),
    )
    .sort((a, b) => a.name.localeCompare(b.name));
}

async function getCheckerAndContacts(req) {
  const { uid, user } = await requireRole(db, req, ["checker"]);
  const checkerRef = db.collection("users").doc(uid);
  const accessKey = await ensureCheckerAccessKey(uid, user, checkerRef);
  const contacts = await authorizedContactsForChecker(uid, user);
  return { uid, checker: user, accessKey, contacts };
}

async function authorizedContactsForDriver(uid, driver) {
  const usersSnap = await db.collection("users").where("role", "in", CONTACT_ROLES).get();
  const users = usersSnap.docs
    .filter((docSnap) => docSnap.id !== uid)
    .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
  const driverCoverage = await deriveDriverCoverage([{ id: uid, ...driver }]);
  const municipalities = driverCoverage.get(uid) || municipalityLabels(driver);

  return users
    .filter((contact) => {
      if (
        !contact ||
        contact.active === false ||
        String(contact.status || "").toLowerCase() === "inactive"
      ) {
        return false;
      }

      const role = String(contact.role || "").toLowerCase();
      if (!CONTACT_ROLES.includes(role) || role === "driver") return false;
      
      // Allow warehouse check to be lenient (done in sharesWarehouse now)
      if (!sharesWarehouse(driver, contact)) {
        return false;
      }

      // Allow municipality/coverage matching to be optional for staff
      const contactMunicipalities = municipalityLabels(contact);
      if (role === "checker") {
        // For checkers, allow if either has no municipality restriction, or if they overlap
        return municipalities.length === 0 || contactMunicipalities.length === 0 || overlaps(municipalities, contactMunicipalities);
      }
      // For other staff, always allow (they can contact anyone in their warehouse)
      return true;
    })
    .map((contact) => serializeContact(contact.id, contact))
    .sort((a, b) => a.name.localeCompare(b.name));
}

async function getDriverAndContacts(req) {
  const { uid, user } = await requireRole(db, req, ["driver"]);
  const contacts = await authorizedContactsForDriver(uid, user);
  const coverage = await deriveDriverCoverage([{ id: uid, ...user }]);
  return {
    uid,
    driver: user,
    contacts,
    municipalities: coverage.get(uid) || municipalityLabels(user),
  };
}

async function assertDirectConversationAccess(conversation, uid, user) {
  if (String(conversation?.type || "") !== "direct_staff") return false;
  if (!Array.isArray(conversation.participantIds) || !conversation.participantIds.includes(uid)) {
    return false;
  }

  if (String(user?.role || "").toLowerCase() !== "checker") return true;
  const accessKey = checkerAccessKey(user);
  const token = checkerAccessToken(uid, accessKey);
  return Array.isArray(conversation.checkerAccessTokens) && conversation.checkerAccessTokens.includes(token);
}

exports.listCheckerChatContacts = onCall(
  { region: "asia-southeast1", maxInstances: 20, invoker: "public" },
  async (req) => {
    const { uid, checker, accessKey, contacts } = await getCheckerAndContacts(req);
    return {
      contacts,
      accessKey,
      accessToken: checkerAccessToken(uid, accessKey),
      warehouseName: checker.warehouseName || checker.warehouseCode || null,
      municipalities: municipalityLabels(checker),
    };
  },
);

exports.createCheckerConversation = onCall(
  { region: "asia-southeast1", maxInstances: 20, invoker: "public" },
  async (req) => {
    const contactId = String(req.data?.contactId || "").trim();
    if (!contactId) throw new HttpsError("invalid-argument", "contactId is required.");

    const { uid, checker, accessKey, contacts } = await getCheckerAndContacts(req);
    const authorizedContact = contacts.find((contact) => contact.id === contactId);
    if (!authorizedContact) {
      throw new HttpsError(
        "permission-denied",
        "This contact is outside your assigned warehouse or municipality.",
      );
    }

    const contactRef = db.collection("users").doc(contactId);
    const contactSnap = await contactRef.get();
    if (!contactSnap.exists) throw new HttpsError("not-found", "Contact not found.");
    const contact = contactSnap.data() || {};
    const contactRole = String(contact.role || "").toLowerCase();

    const ids = [uid, contactId].sort();
    const conversationId = `staff_${crypto.createHash("sha256").update(ids.join(":"))
      .digest("hex").slice(0, 32)}`;
    const ref = db.collection("conversations").doc(conversationId);
    const now = FieldValue.serverTimestamp();
    const accessTokens = [checkerAccessToken(uid, accessKey)];
    let driverAccessTokens = [];

    if (contactRole === "checker") {
      const contactAccessKey = await ensureCheckerAccessKey(contactId, contact, contactRef);
      accessTokens.push(checkerAccessToken(contactId, contactAccessKey));
    }
    if (contactRole === "driver") {
      const contactAccessKey = await ensureDriverAccessKey(contactId, contact, contactRef);
      driverAccessTokens = [driverAccessToken(contactId, contactAccessKey)];
    }

    const participantProfiles = {
      [uid]: serializeContact(uid, checker),
      [contactId]: serializeContact(contactId, contact, authorizedContact.municipalities),
    };

    await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) {
        tx.set(ref, {
          conversationId,
          type: "direct_staff",
          participantIds: ids,
          participantRoles: {
            [uid]: "checker",
            [contactId]: String(contact.role || "staff").toLowerCase(),
          },
          participantProfiles,
          checkerAccessTokens: accessTokens,
          driverAccessTokens,
          status: "active",
          lastMessage: "",
          lastMessageText: "",
          lastMessageAt: now,
          lastActivityAt: now,
          lastMessageBy: null,
          unreadCounts: { [uid]: 0, [contactId]: 0 },
          createdAt: now,
          updatedAt: now,
        });
        return;
      }

      const existing = snap.data() || {};
      if (
        existing.type !== "direct_staff" ||
        !ids.every((id) => Array.isArray(existing.participantIds) && existing.participantIds.includes(id))
      ) {
        throw new HttpsError("already-exists", "Conversation identifier conflict.");
      }
      tx.update(ref, {
        participantProfiles,
        checkerAccessTokens: uniqueStrings([
          ...(existing.checkerAccessTokens || []).filter(
            (token) => !token.startsWith(`${uid}:`) && !token.startsWith(`${contactId}:`),
          ),
          ...accessTokens,
        ]),
        driverAccessTokens: uniqueStrings([
          ...(existing.driverAccessTokens || []).filter(
            (token) => !token.startsWith(`${contactId}:`),
          ),
          ...driverAccessTokens,
        ]),
        updatedAt: now,
      });
    });

    return { success: true, conversationId };
  },
);

exports.listDriverChatContacts = onCall(
  { region: "asia-southeast1", maxInstances: 20, invoker: "public" },
  async (req) => {
    const { uid, driver, contacts, municipalities } = await getDriverAndContacts(req);
    const accessKey = await ensureDriverAccessKey(uid, driver);
    const accessToken = driverAccessToken(uid, accessKey);

    // Repair older direct threads created before Driver access tokens were
    // consistently attached. This keeps the security-rule-backed real-time
    // query working without changing message timestamps or conversation order.
    const conversationSnap = await db
      .collection("conversations")
      .where("participantIds", "array-contains", uid)
      .get();
    const batch = db.batch();
    let repairCount = 0;
    conversationSnap.docs.forEach((conversationDoc) => {
      const conversation = conversationDoc.data() || {};
      if (conversation.type !== "direct_staff") return;
      const currentTokens = Array.isArray(conversation.driverAccessTokens)
        ? conversation.driverAccessTokens
        : [];
      const nextTokens = uniqueStrings([
        ...currentTokens.filter((token) => !token.startsWith(`${uid}:`)),
        accessToken,
      ]);
      if (
        currentTokens.length === nextTokens.length &&
        currentTokens.every((token, index) => token === nextTokens[index])
      ) {
        return;
      }
      batch.update(conversationDoc.ref, { driverAccessTokens: nextTokens });
      repairCount += 1;
    });
    if (repairCount) await batch.commit();

    return {
      contacts,
      accessKey,
      accessToken,
      warehouseName: driver.warehouseName || driver.warehouseCode || null,
      municipalities,
    };
  },
);

exports.createDriverConversation = onCall(
  { region: "asia-southeast1", maxInstances: 20, invoker: "public" },
  async (req) => {
    const contactId = String(req.data?.contactId || "").trim();
    if (!contactId) throw new HttpsError("invalid-argument", "contactId is required.");

    const { uid, driver, contacts } = await getDriverAndContacts(req);
    const authorizedContact = contacts.find((contact) => contact.id === contactId);
    if (!authorizedContact) {
      throw new HttpsError(
        "permission-denied",
        "This contact is outside your assigned warehouse or delivery area.",
      );
    }

    const contactRef = db.collection("users").doc(contactId);
    const contactSnap = await contactRef.get();
    if (!contactSnap.exists) throw new HttpsError("not-found", "Contact not found.");
    const contact = contactSnap.data() || {};
    const ids = [uid, contactId].sort();
    const conversationId = `staff_${crypto.createHash("sha256").update(ids.join(":"))
      .digest("hex").slice(0, 32)}`;
    const ref = db.collection("conversations").doc(conversationId);
    const now = FieldValue.serverTimestamp();
    const accessTokens = [];
    const driverAccessTokens = [];

    // Generate driver access token
    const driverAccessKey = await ensureDriverAccessKey(uid, driver);
    driverAccessTokens.push(driverAccessToken(uid, driverAccessKey));

    if (String(contact.role || "").toLowerCase() === "checker") {
      const contactAccessKey = await ensureCheckerAccessKey(contactId, contact, contactRef);
      accessTokens.push(checkerAccessToken(contactId, contactAccessKey));
    }

    const participantProfiles = {
      [uid]: serializeContact(uid, driver),
      [contactId]: serializeContact(contactId, contact, authorizedContact.municipalities),
    };

    await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) {
        tx.set(ref, {
          conversationId,
          type: "direct_staff",
          participantIds: ids,
          participantRoles: {
            [uid]: "driver",
            [contactId]: String(contact.role || "staff").toLowerCase(),
          },
          participantProfiles,
          driverAccessTokens,
          checkerAccessTokens: accessTokens,
          status: "active",
          lastMessage: "",
          lastMessageText: "",
          lastMessageAt: now,
          lastActivityAt: now,
          lastMessageBy: null,
          unreadCounts: { [uid]: 0, [contactId]: 0 },
          createdAt: now,
          updatedAt: now,
        });
        return;
      }

      const existing = snap.data() || {};
      if (
        existing.type !== "direct_staff" ||
        !ids.every((id) => Array.isArray(existing.participantIds) && existing.participantIds.includes(id))
      ) {
        throw new HttpsError("already-exists", "Conversation identifier conflict.");
      }
      tx.update(ref, {
        participantProfiles,
        driverAccessTokens: uniqueStrings([
          ...(existing.driverAccessTokens || []).filter(
            (token) => !token.startsWith(`${uid}:`),
          ),
          ...driverAccessTokens,
        ]),
        checkerAccessTokens: uniqueStrings([
          ...(existing.checkerAccessTokens || []).filter(
            (token) => !token.startsWith(`${contactId}:`),
          ),
          ...accessTokens,
        ]),
        updatedAt: now,
      });
    });

    return { success: true, conversationId };
  },
);

const STAFF_MESSAGING_ROLES = ["admin", "manager", "administrator"];

async function authorizedContactsForStaff(uid, staffUser = {}) {
  const staffRole = String(staffUser.role || "").toLowerCase();
  const usersSnap = await db.collection("users").where("role", "in", CONTACT_ROLES).get();
  return usersSnap.docs
    .filter((docSnap) => docSnap.id !== uid)
    .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }))
    .filter((contact) => {
      if (
        !contact ||
        contact.active === false ||
        String(contact.status || "").toLowerCase() === "inactive"
      ) {
        return false;
      }
      if (!CONTACT_ROLES.includes(String(contact.role || "").toLowerCase())) {
        return false;
      }
      // Admin retains the global directory. Managers only see contacts in
      // their assigned warehouse and, when configured, municipality scope.
      return staffRole !== "manager" || contactIsAuthorized(staffUser, contact);
    })
    .map((contact) => serializeContact(contact.id, contact))
    .sort((a, b) => a.name.localeCompare(b.name));
}

exports.listStaffChatContacts = onCall(
  { region: "asia-southeast1", maxInstances: 20, invoker: "public" },
  async (req) => {
    const { uid, user } = await requireRole(db, req, STAFF_MESSAGING_ROLES);
    const contacts = await authorizedContactsForStaff(uid, user);
    return { contacts };
  },
);

exports.createStaffConversation = onCall(
  { region: "asia-southeast1", maxInstances: 20, invoker: "public" },
  async (req) => {
    const contactId = String(req.data?.contactId || "").trim();
    if (!contactId) throw new HttpsError("invalid-argument", "contactId is required.");

    const { uid, user } = await requireRole(db, req, STAFF_MESSAGING_ROLES);
    const contacts = await authorizedContactsForStaff(uid, user);
    const authorizedContact = contacts.find((contact) => contact.id === contactId);
    if (!authorizedContact) {
      throw new HttpsError("permission-denied", "This contact is not available.");
    }

    const contactRef = db.collection("users").doc(contactId);
    const contactSnap = await contactRef.get();
    if (!contactSnap.exists) throw new HttpsError("not-found", "Contact not found.");
    const contact = contactSnap.data() || {};
    const contactRole = String(contact.role || "").toLowerCase();

    const ids = [uid, contactId].sort();
    const conversationId = `staff_${crypto.createHash("sha256").update(ids.join(":"))
      .digest("hex").slice(0, 32)}`;
    const ref = db.collection("conversations").doc(conversationId);
    const now = FieldValue.serverTimestamp();
    const accessTokens = [];

    if (contactRole === "checker") {
      const contactAccessKey = await ensureCheckerAccessKey(contactId, contact, contactRef);
      accessTokens.push(checkerAccessToken(contactId, contactAccessKey));
    }
    if (contactRole === "driver") {
      // Drivers read via driverAccessTokens; set below.
    }

    let driverAccessTokens = [];
    if (contactRole === "driver") {
      const contactAccessKey = await ensureDriverAccessKey(contactId, contact, contactRef);
      driverAccessTokens = [driverAccessToken(contactId, contactAccessKey)];
    }

    const participantProfiles = {
      [uid]: serializeContact(uid, user),
      [contactId]: serializeContact(contactId, contact, authorizedContact.municipalities),
    };

    await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) {
        tx.set(ref, {
          conversationId,
          type: "direct_staff",
          participantIds: ids,
          participantRoles: {
            [uid]: String(user.role || "admin").toLowerCase(),
            [contactId]: contactRole || "staff",
          },
          participantProfiles,
          checkerAccessTokens: accessTokens,
          driverAccessTokens,
          status: "active",
          lastMessage: "",
          lastMessageText: "",
          lastMessageAt: now,
          lastActivityAt: now,
          lastMessageBy: null,
          unreadCounts: { [uid]: 0, [contactId]: 0 },
          createdAt: now,
          updatedAt: now,
        });
        return;
      }

      const existing = snap.data() || {};
      if (
        existing.type !== "direct_staff" ||
        !ids.every((id) => Array.isArray(existing.participantIds) && existing.participantIds.includes(id))
      ) {
        throw new HttpsError("already-exists", "Conversation identifier conflict.");
      }
      tx.update(ref, {
        participantProfiles,
        checkerAccessTokens: uniqueStrings([
          ...(existing.checkerAccessTokens || []).filter(
            (token) => !token.startsWith(`${contactId}:`),
          ),
          ...accessTokens,
        ]),
        driverAccessTokens: uniqueStrings([
          ...(existing.driverAccessTokens || []).filter(
            (token) => !token.startsWith(`${contactId}:`),
          ),
          ...driverAccessTokens,
        ]),
        updatedAt: now,
      });
    });

    return { success: true, conversationId };
  },
);

module.exports.assertDirectConversationAccess = assertDirectConversationAccess;
module.exports.checkerAccessKey = checkerAccessKey;
