"use strict";

const crypto = require("crypto");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const { requireRole } = require("../utilities/helpers");

if (!admin.apps.length) admin.initializeApp();

const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;
const CONTACT_ROLES = [
  "driver",
  "checker",
  "manager",
  "admin",
  "employee",
  "dispatcher",
  "operations_manager",
  "warehouse_manager",
];
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

function canonicalWarehouseKey(value) {
  const key = normalized(value);
  if (!key) return null;
  if (["odi", "odiongan", "odionganwarehouse", "odionganhub"].includes(key)) {
    return "odiongan";
  }
  if (["div", "divisoria", "divisoriawarehouse", "divisoriahub"].includes(key)) {
    return "divisoria";
  }
  return key;
}

function municipalityHubKeys(user = {}) {
  return municipalityLabels(user)
    .map((value) => canonicalWarehouseKey(value))
    .filter((value) => ["odiongan", "divisoria"].includes(value));
}

function warehouseKeys(user = {}) {
  const explicitKeys = uniqueStrings([
    user.warehouseId,
    user.warehouseCode,
    user.warehouseName,
    user.assignedWarehouseId,
    user.assignedWarehouseCode,
    user.assignedWarehouseName,
  ]).map(canonicalWarehouseKey).filter(Boolean);
  if (explicitKeys.length > 0) return explicitKeys;
  return uniqueStrings(municipalityHubKeys(user));
}

function municipalityLabels(user = {}) {
  return uniqueStrings([
    ...(Array.isArray(user.assignedMunicipalities) ? user.assignedMunicipalities : []),
    ...(Array.isArray(user.municipalityCoverage) ? user.municipalityCoverage : []),
    ...(Array.isArray(user.serviceMunicipalities) ? user.serviceMunicipalities : []),
    ...(Array.isArray(user.handledMunicipalities) ? user.handledMunicipalities : []),
    ...(Array.isArray(user.municipalities) ? user.municipalities : []),
    ...(Array.isArray(user.deliveryAreas) ? user.deliveryAreas : []),
    ...(Array.isArray(user.assignedDeliveryAreas) ? user.assignedDeliveryAreas : []),
    user.assignedMunicipality,
    user.municipality,
    user.assignedArea,
    user.area,
  ]);
}

function overlaps(left = [], right = []) {
  const rightKeys = new Set(right.map(normalized).filter(Boolean));
  return left.some((value) => rightKeys.has(normalized(value)));
}

function sharesWarehouse(checker = {}, contact = {}) {
  const checkerKeys = warehouseKeys(checker);
  const contactKeys = new Set(warehouseKeys(contact));
  return checkerKeys.length > 0 && checkerKeys.some((key) => contactKeys.has(key));
}

function displayName(user = {}, fallback = "Atlas staff") {
  return user.name || user.displayName || user.fullName || user.email || fallback;
}

function contactDescriptor(user = {}) {
  return [user.jobTitle, user.position, user.department, user.team]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function isDispatcherContact(user = {}) {
  const descriptor = contactDescriptor(user);
  return descriptor.includes("dispatch") || descriptor.includes("dispatcher");
}

function isOperationsContact(user = {}) {
  const descriptor = contactDescriptor(user);
  return descriptor.includes("operation") || descriptor.includes("operations") || descriptor.includes("ops");
}

function isWarehouseManagerContact(user = {}) {
  const role = String(user.role || "").trim().toLowerCase();
  return role === "manager" && !isDispatcherContact(user) && !isOperationsContact(user);
}

function contactRoleLabel(user = {}) {
  const role = String(user.role || "").trim().toLowerCase();
  const descriptor = contactDescriptor(user);

  if (role === "driver") return "Assigned Driver";
  if (role === "checker") return "Checker";
  if (isDispatcherContact(user)) return "Dispatcher";
  if (isOperationsContact(user)) return "Operations Manager";
  if (descriptor.includes("supervisor")) return "Warehouse Supervisor";
  if (role === "manager") return "Warehouse Manager";
  if (descriptor.includes("customer") || descriptor.includes("support")) {
    return "Customer Service Representative";
  }
  return "Operations Staff";
}

function roleDescriptor(user = {}) {
  return [
    user.contactType,
    user.staffType,
    user.jobTitle,
    user.position,
    user.department,
    user.team,
  ]
    .filter(Boolean)
    .join(" ")
    .trim()
    .toLowerCase();
}

function driverContactType(user = {}) {
  const role = String(user.role || "").trim().toLowerCase();
  const roleKey = normalized(role);
  const descriptor = roleDescriptor(user);

  if (roleKey === "checker") return "checker";
  if (roleKey === "dispatcher" || descriptor.includes("dispatch")) return "dispatcher";
  if (
    ["operationsmanager", "operationmanager"].includes(roleKey) ||
    descriptor.includes("operations manager") ||
    descriptor.includes("operation manager") ||
    descriptor.includes("operations lead") ||
    descriptor.includes("ops manager") ||
    (["manager", "employee", "admin"].includes(role) && descriptor.includes("operation"))
  ) {
    return "operations_manager";
  }
  if (
    roleKey === "warehousemanager" ||
    descriptor.includes("warehouse manager") ||
    descriptor.includes("warehouse supervisor") ||
    (role === "manager" && !descriptor.includes("operation") && !descriptor.includes("dispatch"))
  ) {
    return "warehouse_manager";
  }

  return null;
}

function driverContactRoleLabel(type) {
  if (type === "checker") return "Checker";
  if (type === "warehouse_manager") return "Warehouse Manager";
  if (type === "operations_manager") return "Operations Manager";
  if (type === "dispatcher") return "Dispatcher";
  if (type === "administrator") return "Administrator";
  if (type === "employee") return "Employee";
  if (type === "driver") return "Driver";
  return "Atlas staff";
}

function assignmentIds(user = {}, type = "") {
  const common = [
    ...(Array.isArray(user.authorizedContactIds) ? user.authorizedContactIds : []),
    ...(Array.isArray(user.assignedContactIds) ? user.assignedContactIds : []),
  ];
  const byType = {
    warehouse_manager: [
      user.warehouseManagerId,
      user.assignedWarehouseManagerId,
      ...(Array.isArray(user.warehouseManagerIds) ? user.warehouseManagerIds : []),
      ...(Array.isArray(user.assignedWarehouseManagerIds) ? user.assignedWarehouseManagerIds : []),
    ],
    operations_manager: [
      user.operationsManagerId,
      user.assignedOperationsManagerId,
      ...(Array.isArray(user.operationsManagerIds) ? user.operationsManagerIds : []),
      ...(Array.isArray(user.assignedOperationsManagerIds) ? user.assignedOperationsManagerIds : []),
    ],
    dispatcher: [
      user.dispatcherId,
      user.assignedDispatcherId,
      ...(Array.isArray(user.dispatcherIds) ? user.dispatcherIds : []),
      ...(Array.isArray(user.assignedDispatcherIds) ? user.assignedDispatcherIds : []),
    ],
  };
  return uniqueStrings([...common, ...(byType[type] || [])]);
}

function explicitlyAssignedToDriver(driver = {}, contactId = "", contact = {}, type = "") {
  const driverId = String(driver.id || driver.uid || "").trim();
  const contactDriverIds = uniqueStrings([
    contact.assignedDriverId,
    ...(Array.isArray(contact.assignedDriverIds) ? contact.assignedDriverIds : []),
    ...(Array.isArray(contact.authorizedDriverIds) ? contact.authorizedDriverIds : []),
  ]);
  return assignmentIds(driver, type).includes(String(contactId)) ||
    (driverId && contactDriverIds.includes(driverId));
}

function evaluateDriverContact(driver, contact, driverMunicipalities, contactId = "") {
  if (
    !contact ||
    contact.active === false ||
    String(contact.status || "").toLowerCase() === "inactive"
  ) {
    return { authorized: false, reason: "inactive" };
  }

  const type = driverContactType(contact);
  if (!type) return { authorized: false, reason: "role" };

  const explicitlyAssigned = explicitlyAssignedToDriver(
    { id: driver.id || driver.uid, ...driver },
    contactId,
    contact,
    type,
  );
  const driverAreas = uniqueStrings(driverMunicipalities);
  const contactAreas = municipalityLabels(contact);
  const sameMunicipality = driverAreas.length > 0 && overlaps(driverAreas, contactAreas);
  const sameWarehouse = sharesWarehouse(driver, contact);
  const authorized = explicitlyAssigned || (
    type === "checker"
      ? sameWarehouse && (sameMunicipality || driverAreas.length === 0 || contactAreas.length === 0)
      : type === "warehouse_manager" || type === "dispatcher" || type === "operations_manager"
        ? sameWarehouse
        : false
  );

  if (!authorized) return { authorized: false, reason: "assignment" };

  const sortOrder = type === "warehouse_manager"
    ? 1
    : type === "operations_manager" || type === "dispatcher"
      ? 2
      : type === "checker" && sameMunicipality
        ? 3
        : type === "checker"
          ? 4
          : 5;

  return {
    authorized,
    type,
    roleLabel: driverContactRoleLabel(type),
    sortOrder,
    sameMunicipality,
    explicitlyAssigned,
    contactMunicipalities: contactAreas,
  };
}

function profilePhoto(user = {}) {
  return user.photoURL ||
    user.profilePhotoURL ||
    user.profilePicture ||
    user.profileImageURL ||
    user.profileImageUrl ||
    user.avatarURL ||
    user.avatarUrl ||
    null;
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

function driverAccessKey(driver = {}, municipalities = municipalityLabels(driver)) {
  const payload = JSON.stringify({
    policyVersion: 3,
    warehouse: warehouseKeys(driver).sort(),
    municipalities: uniqueStrings(municipalities).map(normalized).sort(),
  });
  return crypto.createHash("sha256").update(payload).digest("hex").slice(0, 32);
}

function driverAccessToken(uid, accessKey) {
  return `${uid}:${accessKey}`;
}

async function ensureDriverAccessKey(
  uid,
  driver,
  municipalities,
  ref = db.collection("users").doc(uid),
) {
  const accessKey = driverAccessKey(driver, municipalities);
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
    return checkerMunicipalities.length > 0 && overlaps(checkerMunicipalities, contactMunicipalities);
  }

  // Area-scoped support employees must overlap. Warehouse-wide management and
  // operations contacts remain available when they do not declare an area.
  return !contactMunicipalities.length || overlaps(checkerMunicipalities, contactMunicipalities);
}

function serializeContact(
  id,
  user,
  municipalities = municipalityLabels(user),
  metadata = {},
) {
  const onlineStatusSupported = [
    user.isOnline,
    user.onlineStatus,
    user.lastSeenAt,
    user.lastSeen,
    user.lastActiveAt,
  ].some((value) => value !== undefined && value !== null && value !== "");
  return {
    id,
    name: displayName(user),
    role: String(user.role || "").toLowerCase(),
    roleLabel: metadata.roleLabel || contactRoleLabel(user),
    contactType: metadata.type || null,
    sortOrder: Number(metadata.sortOrder || 99),
    sameMunicipality: metadata.sameMunicipality === true,
    municipality: municipalities.join(", ") || "Warehouse-wide",
    municipalities,
    warehouseName:
      user.warehouseName ||
      user.assignedWarehouseName ||
      user.warehouseCode ||
      user.assignedWarehouseCode ||
      null,
    warehouseId: user.warehouseId || user.assignedWarehouseId || null,
    warehouseCode: user.warehouseCode || user.assignedWarehouseCode || null,
    photoURL: profilePhoto(user),
    online: isOnline(user),
    onlineStatusSupported,
  };
}

function contactSortRank(contact, driverMunicipalities = []) {
  const role = String(contact.role || "").toLowerCase();
  if (isWarehouseManagerContact(contact)) return 0;
  if (isOperationsContact(contact) || isDispatcherContact(contact)) return 1;
  if (role === "checker") {
    return overlaps(driverMunicipalities, contact.municipalities) ? 2 : 3;
  }
  return 4;
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
    .sort((a, b) => {
      const rankA = contactSortRank(a, municipalityLabels(checker));
      const rankB = contactSortRank(b, municipalityLabels(checker));
      if (rankA !== rankB) return rankA - rankB;
      if (rankA === 2 && rankB === 2) {
        return a.municipality.localeCompare(b.municipality) || a.name.localeCompare(b.name);
      }
      return a.name.localeCompare(b.name);
    });
}

async function getCheckerAndContacts(req) {
  const { uid, user } = await requireRole(db, req, ["checker"]);
  const checkerRef = db.collection("users").doc(uid);
  const accessKey = await ensureCheckerAccessKey(uid, user, checkerRef);
  const contacts = await authorizedContactsForChecker(uid, user);
  return { uid, checker: user, accessKey, contacts };
}

async function authorizedContactsForDriver(uid, driver, resolvedMunicipalities = null) {
  // Read candidates server-side and filter before returning them. This supports
  // legacy role casing/labels (for example "Checker" or "Warehouse Manager")
  // that cannot be matched by a case-sensitive Firestore `in` query.
  const usersSnap = await db.collection("users").get();
  const users = usersSnap.docs
    .filter((docSnap) => docSnap.id !== uid)
    .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
  const driverCoverage = resolvedMunicipalities
    ? null
    : await deriveDriverCoverage([{ id: uid, ...driver }]);
  const municipalities = uniqueStrings(
    resolvedMunicipalities || driverCoverage?.get(uid) || municipalityLabels(driver),
  );

  return users
    .map((contact) => ({
      contact,
      authorization: evaluateDriverContact(driver, contact, municipalities, contact.id),
    }))
    .filter(({ authorization }) => authorization.authorized)
    .map(({ contact, authorization }) => {
      return serializeContact(
        contact.id,
        contact,
        authorization.contactMunicipalities,
        authorization,
      );
    })
    .sort((a, b) => {
      if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
      return a.name.localeCompare(b.name);
    });
}

async function getDriverAndContacts(req) {
  const { uid, user } = await requireRole(db, req, ["driver"]);
  const coverage = await deriveDriverCoverage([{ id: uid, ...user }]);
  const municipalities = uniqueStrings(coverage.get(uid) || municipalityLabels(user));
  const driverRef = db.collection("users").doc(uid);
  const accessKey = await ensureDriverAccessKey(uid, user, municipalities, driverRef);
  const driver = { id: uid, ...user, driverChatAccessKey: accessKey };
  const contacts = await authorizedContactsForDriver(uid, driver, municipalities);
  return {
    uid,
    driver,
    accessKey,
    contacts,
    municipalities,
  };
}

async function assertDirectConversationAccess(conversation, uid, user) {
  if (String(conversation?.type || "") !== "direct_staff") return false;
  if (!Array.isArray(conversation.participantIds) || !conversation.participantIds.includes(uid)) {
    return false;
  }

  const role = String(user?.role || "").toLowerCase();
  if (role === "checker") {
    const accessKey = checkerAccessKey(user);
    const token = checkerAccessToken(uid, accessKey);
    if (
      !Array.isArray(conversation.checkerAccessTokens) ||
      !conversation.checkerAccessTokens.includes(token)
    ) {
      return false;
    }
  }

  const participantRoles = conversation.participantRoles || {};
  let driverId = conversation.participantIds.find(
    (participantId) => String(participantRoles[participantId] || "").toLowerCase() === "driver",
  );

  if (!driverId && role === "driver") driverId = uid;
  if (!driverId) return true;

  const contactId = conversation.participantIds.find(
    (participantId) => participantId !== driverId,
  );
  if (!contactId) return false;

  const [driverSnap, contactSnap] = await Promise.all([
    driverId === uid
      ? Promise.resolve({ exists: true, data: () => user })
      : db.collection("users").doc(driverId).get(),
    contactId === uid
      ? Promise.resolve({ exists: true, data: () => user })
      : db.collection("users").doc(contactId).get(),
  ]);
  if (!driverSnap.exists || !contactSnap.exists) return false;

  const driver = { id: driverId, ...(driverSnap.data() || {}) };
  const contact = { id: contactId, ...(contactSnap.data() || {}) };
  if (String(driver.role || "").toLowerCase() !== "driver") return false;

  const coverage = await deriveDriverCoverage([driver]);
  const municipalities = uniqueStrings(
    coverage.get(driverId) || municipalityLabels(driver),
  );
  const authorization = evaluateDriverContact(
    driver,
    contact,
    municipalities,
    contactId,
  );
  if (!authorization.authorized) return false;

  const token = driverAccessToken(
    driverId,
    driverAccessKey(driver, municipalities),
  );
  return Array.isArray(conversation.driverAccessTokens) &&
    conversation.driverAccessTokens.includes(token);
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

    const ids = [uid, contactId].sort();
    const conversationId = `staff_${crypto.createHash("sha256").update(ids.join(":"))
      .digest("hex").slice(0, 32)}`;
    const ref = db.collection("conversations").doc(conversationId);
    const now = FieldValue.serverTimestamp();
    const accessTokens = [checkerAccessToken(uid, accessKey)];
    const driverTokens = [];

    if (String(contact.role || "").toLowerCase() === "checker") {
      const contactAccessKey = await ensureCheckerAccessKey(contactId, contact, contactRef);
      accessTokens.push(checkerAccessToken(contactId, contactAccessKey));
    }
    if (String(contact.role || "").toLowerCase() === "driver") {
      const coverage = await deriveDriverCoverage([{ id: contactId, ...contact }]);
      const municipalities = uniqueStrings(
        coverage.get(contactId) || municipalityLabels(contact),
      );
      const contactAccessKey = await ensureDriverAccessKey(
        contactId,
        contact,
        municipalities,
        contactRef,
      );
      driverTokens.push(driverAccessToken(contactId, contactAccessKey));
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
          driverAccessTokens: driverTokens,
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
          ...driverTokens,
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
    const { uid, driver, accessKey, contacts, municipalities } = await getDriverAndContacts(req);
    return {
      contacts,
      accessKey,
      accessToken: driverAccessToken(uid, accessKey),
      warehouseName:
        driver.warehouseName ||
        driver.assignedWarehouseName ||
        driver.warehouseCode ||
        driver.assignedWarehouseCode ||
        null,
      municipalities,
    };
  },
);

exports.createDriverConversation = onCall(
  { region: "asia-southeast1", maxInstances: 20, invoker: "public" },
  async (req) => {
    const contactId = String(req.data?.contactId || "").trim();
    if (!contactId) throw new HttpsError("invalid-argument", "contactId is required.");

    const { uid, driver, accessKey, contacts } = await getDriverAndContacts(req);
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
    const driverTokens = [driverAccessToken(uid, accessKey)];

    if (String(contact.role || "").toLowerCase() === "checker") {
      const contactAccessKey = await ensureCheckerAccessKey(contactId, contact, contactRef);
      accessTokens.push(checkerAccessToken(contactId, contactAccessKey));
    }
    if (String(contact.role || "").toLowerCase() === "driver") {
      const contactCoverage = await deriveDriverCoverage([{ id: contactId, ...contact }]);
      const contactMunicipalities = uniqueStrings(
        contactCoverage.get(contactId) || municipalityLabels(contact),
      );
      const contactAccessKey = await ensureDriverAccessKey(
        contactId,
        contact,
        contactMunicipalities,
        contactRef,
      );
      driverTokens.push(driverAccessToken(contactId, contactAccessKey));
    }

    const participantProfiles = {
      [uid]: serializeContact(uid, driver),
      [contactId]: serializeContact(
        contactId,
        contact,
        authorizedContact.municipalities,
        authorizedContact,
      ),
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
          checkerAccessTokens: accessTokens,
          driverAccessTokens: driverTokens,
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
            (token) => !token.startsWith(`${uid}:`) && !token.startsWith(`${contactId}:`),
          ),
          ...driverTokens,
        ]),
        updatedAt: now,
      });
    });

    return { success: true, conversationId };
  },
);

module.exports.assertDirectConversationAccess = assertDirectConversationAccess;
module.exports.checkerAccessKey = checkerAccessKey;
module.exports.driverAccessKey = driverAccessKey;
module.exports.driverContactType = driverContactType;
module.exports.evaluateDriverContact = evaluateDriverContact;
