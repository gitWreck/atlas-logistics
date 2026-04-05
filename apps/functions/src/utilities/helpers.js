const { HttpsError } = require("firebase-functions/v2/https");
const crypto = require("crypto");

/* =========================
   HELPERS
========================= */
function requireString(v, field) {
  if (typeof v !== "string" || !v.trim()) {
    throw new HttpsError("invalid-argument", `Missing/invalid: ${field}`);
  }
  return v.trim();
}

function optionalString(v) {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

// -------------------------------------

// 1. Map Internal Statuses to Public 4
const formatStatus = (internalStatus) => {
  if (!internalStatus) return "RECEIVED";

  const s = internalStatus.toUpperCase();

  // GROUP 1: DELIVERED
  if (s === "DELIVERED" || s === "COMPLETED" || s === "DONE") {
    return "DELIVERED";
  }

  // GROUP 2: OUT FOR DELIVERY
  // Matches the "delivering" mode you added to the Checker App
  if (s === "DELIVERING" || s === "OUT_FOR_DELIVERY") {
    return "OUT FOR DELIVERY";
  }

  // GROUP 3: IN TRANSIT
  // strictly when the truck is moving
  if (s === "IN_TRANSIT" || s === "ON_THE_WAY") {
    return "IN TRANSIT";
  }

  // GROUP 4: RECEIVED (The Catch-All)
  // Covers: CREATED, ASSIGNED, LOADING, LOADED
  return "RECEIVED";
};

const sanitizeDriverName = (fullName) => {
  if (!fullName) return "Unassigned";
  // Returns "Juan" from "Juan Dela Cruz"
  return fullName.split(" ")[0] + " (Driver)";
};

// ---------------------------

function yyyymmddFromDate(d) {
  return (
    d.getFullYear().toString() +
    String(d.getMonth() + 1).padStart(2, "0") +
    String(d.getDate()).padStart(2, "0")
  );
}

const formatTimeline = (history) => {
  if (!history || !Array.isArray(history)) return [];
  return history
    .sort((a, b) => (b.at?.toMillis() || 0) - (a.at?.toMillis() || 0))
    .map((h) => ({
      status: formatStatus(h.status),
      date: h.at?.toDate().toISOString() || new Date().toISOString(),
      note: h.note || "",
      location: h.location || "",
    }));
};

function cleanCode(code) {
  return String(code || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

function pad4(n) {
  return String(n).padStart(4, "0");
}

function shortCode(place) {
  if (!place) return "XXX"; // fallback

  const words = place.trim().split(/\s+/);

  if (words.length === 1) {
    // Single word: first 3 letters
    return words[0].slice(0, 3).toUpperCase();
  } else {
    // Multiple words: first letters of first two words
    let code = words.map((w) => w[0].toUpperCase()).join("");

    // If less than 3 letters, pad with letters from last word
    const lastWord = words[words.length - 1].toUpperCase();
    let i = 1;
    while (code.length < 3 && i < lastWord.length) {
      code += lastWord[i];
      i++;
    }

    return code.slice(0, 3);
  }
}

/**
 * Stable stringify (sorted keys) to create deterministic hash
 */
function stableStringify(obj) {
  const seen = new WeakSet();
  const sorter = (value) => {
    if (value === null || typeof value !== "object") return value;
    if (seen.has(value)) return "[Circular]";
    seen.add(value);

    if (Array.isArray(value)) return value.map(sorter);

    const keys = Object.keys(value).sort();
    const out = {};
    for (const k of keys) out[k] = sorter(value[k]);
    return out;
  };
  return JSON.stringify(sorter(obj));
}

function sha256Hex(s) {
  return crypto.createHash("sha256").update(s, "utf8").digest("hex");
}

// auth / role guard

async function assertAdminOrManager(db, tx, uid) {
  const userRef = db.collection("users").doc(uid);
  const userSnap = await tx.get(userRef);

  if (!userSnap.exists) {
    throw new HttpsError("permission-denied", "User profile missing");
  }

  const u = userSnap.data() || {};
  if (u.active !== true) {
    throw new HttpsError("permission-denied", "User is inactive");
  }

  const role = String(u.role || "").toLowerCase();
  if (role !== "admin" && role !== "manager") {
    throw new HttpsError("permission-denied", "Admin/Manager only");
  }

  return { role, name: u.name || null };
}

function requireAuth(context) {
  if (!context.auth?.uid) {
    throw new HttpsError("unauthenticated", "Authentication required");
  }
  return context.auth.uid;
}

async function requireRole(db, context, allowed = []) {
  const uid = await requireAuth(context);

  const snap = await db.collection("users").doc(uid).get();
  if (!snap.exists || snap.data()?.active !== true) {
    throw new HttpsError("permission-denied", "Inactive or missing user");
  }

  const role = String(snap.data().role || "").toLowerCase();
  if (!allowed.includes(role)) {
    throw new HttpsError("permission-denied", "Insufficient role");
  }

  return {
    uid,
    role,
    user: snap.data(),
  };
}

// -----------------------------------

function toE164(localNumber) {
  if (!localNumber) return "";
  let cleaned = localNumber.replace(/[\s-()]/g, "");
  if (cleaned.startsWith("0")) {
    return "+63" + cleaned.substring(1);
  }
  return cleaned; // assume already E.164
}

/**
 * Convert E.164 (+63...) to local PH format (0917...)
 */
function toLocal(e164Number) {
  if (!e164Number) return "";
  let cleaned = e164Number.replace(/[\s-()]/g, "");
  if (cleaned.startsWith("+63")) {
    return "0" + cleaned.substring(3);
  }
  return cleaned; // assume already local
}

// -----------------------------------

function normalizePlateNumber(value) {
  if (typeof value !== "string") return "";
  return value.trim().toUpperCase();
}

function requireNonEmptyString(value, fieldName) {
  if (typeof value !== "string" || !value.trim()) {
    throw new HttpsError("invalid-argument", `${fieldName} is required.`);
  }
  return value.trim();
}

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
  if (value === null || value === undefined || value === "") return null;
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
  if (value === null || value === undefined || value === "") return null;
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

// Export everything
module.exports = {
  requireString,
  optionalString,
  formatStatus,
  sanitizeDriverName,

  formatTimeline,
  yyyymmddFromDate,

  cleanCode,
  pad4,
  shortCode,
  toE164,
  toLocal,

  stableStringify,
  sha256Hex,

  assertAdminOrManager,
  requireRole,
  requireAuth,

  normalizePlateNumber,
  requireNonEmptyString,
  parseRequiredNumber,
  parseOptionalNumber,
  parseOptionalDateString,
};
