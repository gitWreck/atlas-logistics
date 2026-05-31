const { HttpsError } = require("firebase-functions/v2/https");
const crypto = require("crypto");

/* =========================
   STRING / FIELD HELPERS
========================= */
function requireString(value, fieldName) {
  if (typeof value !== "string" || !value.trim()) {
    throw new HttpsError("invalid-argument", `Missing/invalid: ${fieldName}`);
  }
  return value.trim();
}

function optionalString(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function requireNonEmptyString(value, fieldName) {
  return requireString(value, fieldName);
}

/* =========================
   NUMBER / DATE PARSERS
========================= */
function parseRequiredNumber(value, fieldName) {
  const num = Number(value);

  if (!Number.isFinite(num)) {
    throw new HttpsError(
      "invalid-argument",
      `${fieldName} must be a valid number.`,
    );
  }

  return num;
}

function parseOptionalNumber(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const num = Number(value);

  if (!Number.isFinite(num)) {
    throw new HttpsError(
      "invalid-argument",
      "A numeric field has an invalid value.",
    );
  }

  return num;
}

function parseOptionalDateString(value, fieldName) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  if (typeof value !== "string") {
    throw new HttpsError(
      "invalid-argument",
      `${fieldName} must be a date string.`,
    );
  }

  const trimmed = value.trim();
  if (!trimmed) return null;

  const testDate = new Date(trimmed);

  if (Number.isNaN(testDate.getTime())) {
    throw new HttpsError(
      "invalid-argument",
      `${fieldName} is not a valid date.`,
    );
  }

  return trimmed;
}

/* =========================
   STATUS / TIMELINE HELPERS
========================= */
const PUBLIC_STATUS_MAP = {
  DELIVERED: "DELIVERED",
  COMPLETED: "DELIVERED",
  DONE: "DELIVERED",

  DELIVERING: "OUT FOR DELIVERY",
  OUT_FOR_DELIVERY: "OUT FOR DELIVERY",
  READY_FOR_DELIVERY: "READY FOR DELIVERY",
  PARTIALLY_DELIVERED: "PARTIALLY DELIVERED",

  IN_TRANSIT: "IN TRANSIT",
  ON_THE_WAY: "IN TRANSIT",
};

function formatStatus(internalStatus) {
  if (!internalStatus) return "RECEIVED";

  const normalizedStatus = String(internalStatus).trim().toUpperCase();
  return PUBLIC_STATUS_MAP[normalizedStatus] || "RECEIVED";
}

function formatTimeline(history) {
  if (!Array.isArray(history) || !history.length) {
    return [];
  }

  return [...history]
    .sort((a, b) => {
      const aMillis = a?.at?.toMillis?.() || 0;
      const bMillis = b?.at?.toMillis?.() || 0;
      return bMillis - aMillis;
    })
    .map((entry) => ({
      status: formatStatus(entry?.status),
      date: entry?.at?.toDate?.().toISOString?.() || new Date().toISOString(),
      note: entry?.note || "",
      location: entry?.location || "",
    }));
}

function sanitizeDriverName(fullName) {
  if (!fullName || typeof fullName !== "string") {
    return "Unassigned";
  }

  const trimmed = fullName.trim();
  if (!trimmed) return "Unassigned";

  return `${trimmed.split(/\s+/)[0]} (Driver)`;
}

/* =========================
   DATE / CODE HELPERS
========================= */
function yyyymmddFromDate(date) {
  return (
    date.getFullYear().toString() +
    String(date.getMonth() + 1).padStart(2, "0") +
    String(date.getDate()).padStart(2, "0")
  );
}

function cleanCode(code) {
  return String(code || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

function pad4(value) {
  return String(value).padStart(4, "0");
}

function shortCode(place) {
  if (!place || typeof place !== "string") {
    return "XXX";
  }

  const words = place.trim().split(/\s+/).filter(Boolean);

  if (!words.length) {
    return "XXX";
  }

  if (words.length === 1) {
    return words[0].slice(0, 3).toUpperCase();
  }

  let code = words.map((word) => word[0].toUpperCase()).join("");

  const lastWord = words[words.length - 1].toUpperCase();
  let index = 1;

  while (code.length < 3 && index < lastWord.length) {
    code += lastWord[index];
    index += 1;
  }

  return code.slice(0, 3);
}

/* =========================
   HASH HELPERS
========================= */
function stableStringify(obj) {
  const seen = new WeakSet();

  function sorter(value) {
    if (value === null || typeof value !== "object") {
      return value;
    }

    if (seen.has(value)) {
      return "[Circular]";
    }

    seen.add(value);

    if (Array.isArray(value)) {
      return value.map(sorter);
    }

    const sortedKeys = Object.keys(value).sort();
    const result = {};

    for (const key of sortedKeys) {
      result[key] = sorter(value[key]);
    }

    return result;
  }

  return JSON.stringify(sorter(obj));
}

function sha256Hex(value) {
  return crypto.createHash("sha256").update(value, "utf8").digest("hex");
}

/* =========================
   AUTH / ROLE HELPERS
========================= */
function requireAuth(context) {
  if (!context?.auth?.uid) {
    throw new HttpsError("unauthenticated", "Authentication required");
  }

  return context.auth.uid;
}

async function requireRole(db, context, allowedRoles = []) {
  const uid = requireAuth(context);

  const userSnap = await db.collection("users").doc(uid).get();

  if (!userSnap.exists || userSnap.data()?.active !== true) {
    throw new HttpsError("permission-denied", "Inactive or missing user");
  }

  const userData = userSnap.data() || {};
  const role = String(userData.role || "").toLowerCase();

  if (!allowedRoles.includes(role)) {
    throw new HttpsError("permission-denied", "Insufficient role");
  }

  return {
    uid,
    role,
    user: userData,
  };
}

const updatedBy = (req) => {
  const updatedBy = req.data?.updatedBy || {};
  const uid = updatedBy.usercode || req.auth.uid || "unknown";
  const name = updatedBy.username || req.auth.token?.name || null;
  const role = updatedBy.role || req.auth.token?.role || null;
  return { uid, name, role };
};

async function assertAdminOrManager(db, tx, uid) {
  const userRef = db.collection("users").doc(uid);
  const userSnap = await tx.get(userRef);

  if (!userSnap.exists) {
    throw new HttpsError("permission-denied", "User profile missing");
  }

  const userData = userSnap.data() || {};

  if (userData.active !== true) {
    throw new HttpsError("permission-denied", "User is inactive");
  }

  const role = String(userData.role || "").toLowerCase();

  if (role !== "admin" && role !== "manager") {
    throw new HttpsError("permission-denied", "Admin/Manager only");
  }

  return {
    role,
    name: userData.name || null,
  };
}

/* =========================
   PHONE HELPERS
========================= */
function toE164(localNumber) {
  if (!localNumber || typeof localNumber !== "string") {
    return "";
  }

  const cleaned = localNumber.replace(/[\s\-()]/g, "");

  if (cleaned.startsWith("0")) {
    return `+63${cleaned.substring(1)}`;
  }

  return cleaned;
}

function toLocal(e164Number) {
  if (!e164Number || typeof e164Number !== "string") {
    return "";
  }

  const cleaned = e164Number.replace(/[\s\-()]/g, "");

  if (cleaned.startsWith("+63")) {
    return `0${cleaned.substring(3)}`;
  }

  return cleaned;
}

/* =========================
   VEHICLE HELPERS
========================= */
function normalizePlateNumber(value) {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim().toUpperCase();
}

/* =========================
   EXPORTS
========================= */
module.exports = {
  requireString,
  optionalString,
  requireNonEmptyString,

  parseRequiredNumber,
  parseOptionalNumber,
  parseOptionalDateString,

  formatStatus,
  formatTimeline,
  sanitizeDriverName,

  yyyymmddFromDate,
  cleanCode,
  pad4,
  shortCode,

  stableStringify,
  sha256Hex,

  requireAuth,
  requireRole,
  assertAdminOrManager,

  toE164,
  toLocal,

  normalizePlateNumber,

  updatedBy,
};
