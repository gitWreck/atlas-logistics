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

function cleanCode(code) {
  return String(code || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

function yyyymmddFromDate(d) {
  return (
    d.getFullYear().toString() +
    String(d.getMonth() + 1).padStart(2, "0") +
    String(d.getDate()).padStart(2, "0")
  );
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

async function requireAuth(context) {
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

// Export everything
module.exports = {
  requireString,
  optionalString,
  cleanCode,
  yyyymmddFromDate,
  pad4,
  shortCode,
  assertAdminOrManager,
  requireRole,
  toE164,
  toLocal,
  stableStringify,
  sha256Hex,
};
