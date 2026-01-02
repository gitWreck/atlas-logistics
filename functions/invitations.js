"use strict";

/* =====================================================
   DEPENDENCIES
===================================================== */
const { onCall, onRequest, HttpsError } =
  require("firebase-functions/v2/https");

const admin = require("firebase-admin");
const crypto = require("crypto");
const sgMail = require("@sendgrid/mail");

/* =====================================================
   INIT (IDEMPOTENT — MATCHES YOUR OTHER FILES)
===================================================== */
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();
const auth = admin.auth();


/* =====================================================
   CONSTANTS
===================================================== */
const VALID_ROLES = new Set(["admin", "manager", "checker", "driver"]);
const INVITE_TTL_HOURS = Number(process.env.INVITE_TTL_HOURS || 72);
const MAX_INVITES_PER_ADMIN_PER_HOUR =
  Number(process.env.MAX_INVITES_PER_ADMIN_PER_HOUR || 30);

/* =====================================================
   HELPERS
===================================================== */
function env(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

function baseUrl() {
  return env("BASE_URL").replace(/\/+$/, "");
}

function nowMs() {
  return Date.now();
}

function toLowerTrim(s) {
  return (s || "").toString().trim().toLowerCase();
}

function isEmail(s) {
  const x = toLowerTrim(s);
  return x.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(x);
}

function sha256Hex(input) {
  return crypto.createHash("sha256").update(input).digest("hex");
}

function randomToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString("hex");
}

function maskEmail(email) {
  const [u, d] = toLowerTrim(email).split("@");
  if (!u || !d) return "hidden";
  const um = u[0] + "*".repeat(Math.max(1, u.length - 2)) + u.slice(-1);
  const [d0, ...rest] = d.split(".");
  const dm = d0[0] + "*".repeat(Math.max(1, d0.length - 2)) + d0.slice(-1);
  return `${um}@${dm}${rest.length ? "." + rest.join(".") : ""}`;
}

async function requireAuth(request) {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Sign in required.");
  }
  return request.auth.uid;
}

async function requireAdmin(uid) {
  const snap = await db.doc(`users/${uid}`).get();
  if (!snap.exists || snap.data()?.active !== true) {
    throw new HttpsError("permission-denied", "Inactive or missing user.");
  }
  if (snap.data()?.role !== "admin") {
    throw new HttpsError("permission-denied", "Admin only.");
  }
}

async function authUserExistsByEmail(email) {
  try {
    await auth.getUserByEmail(email);
    return true;
  } catch (e) {
    if (e.code === "auth/user-not-found") return false;
    throw new HttpsError("internal", "Auth lookup failed.");
  }
}

async function enforceAdminRateLimit(adminUid) {
  const hourKey = new Date().toISOString().slice(0, 13);
  const ref = db.doc(`admin_invite_rate/${adminUid}_${hourKey}`);

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const count = snap.exists ? snap.data().count || 0 : 0;
    if (count >= MAX_INVITES_PER_ADMIN_PER_HOUR) {
      throw new HttpsError("resource-exhausted", "Invite rate limit reached.");
    }
    if (!snap.exists) {
      tx.set(ref, {
        adminUid,
        hourKey,
        count: 1,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    } else {
      tx.update(ref, {
        count: count + 1,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }
  });
}

function inviteLink(token) {
  return `${baseUrl()}/login.html?invite=${encodeURIComponent(token)}`;
}

function setupSendGrid() {
  sgMail.setApiKey(env("SENDGRID_API_KEY"));
  return env("FROM_EMAIL");
}

/* =====================================================
   CREATE INVITE — ADMIN ONLY (CALLABLE)
===================================================== */
const createInvite = onCall(async (request) => {
  const adminUid = await requireAuth(request);
  await requireAdmin(adminUid);
  await enforceAdminRateLimit(adminUid);

  const email = toLowerTrim(request.data?.email);
  const role = toLowerTrim(request.data?.role);

  if (!isEmail(email)) {
    throw new HttpsError("invalid-argument", "Valid email required.");
  }
  if (!VALID_ROLES.has(role)) {
    throw new HttpsError("invalid-argument", "Invalid role.");
  }
  if (await authUserExistsByEmail(email)) {
    throw new HttpsError("failed-precondition", "Email already registered.");
  }

  const token = randomToken(32);
  const tokenHash = sha256Hex(token);
  const createdAtMs = nowMs();
  const expiresAtMs = createdAtMs + INVITE_TTL_HOURS * 3600000;

  const ref = db.collection("user_invites").doc();
  await ref.set({
    inviteId: ref.id,
    tokenHash,
    email,
    role,
    invitedBy: adminUid,
    used: false,
    revoked: false,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    createdAtMs,
    expiresAtMs,
    emailStatus: "pending",
  });

  const from = setupSendGrid();
  const url = inviteLink(token);

  await sgMail.send({
    to: email,
    from,
    subject: `Atlas Invitation (${role.toUpperCase()})`,
    text: `You are invited to Atlas as ${role}. Link (expires in ${INVITE_TTL_HOURS}h): ${url}`,
    html: `<p>You are invited to Atlas as <b>${role}</b>.</p><p><a href="${url}">Create account</a></p>`,
  });

  await ref.update({
    emailStatus: "sent",
    emailSentAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  return { ok: true };
});

/* =====================================================
   VALIDATE INVITE — PUBLIC (HTTP)
===================================================== */
const validateInvite = onRequest(async (req, res) => {
  try {
    res.set("Access-Control-Allow-Origin", "*");
    if (req.method === "OPTIONS") return res.status(204).send("");

    const token = (req.query.invite || "").toString().trim();
    if (token.length < 40) {
      return res.status(400).json({ ok: false });
    }

    const hash = sha256Hex(token);
    const q = await db
      .collection("user_invites")
      .where("tokenHash", "==", hash)
      .limit(1)
      .get();

    if (q.empty) return res.status(404).json({ ok: false });

    const d = q.docs[0].data();
    if (d.used || d.revoked || nowMs() > d.expiresAtMs) {
      return res.status(410).json({ ok: false });
    }

    res.json({
      ok: true,
      emailMasked: maskEmail(d.email),
      role: d.role,
    });
  } catch {
    res.status(500).json({ ok: false });
  }
});

/* =====================================================
   ACCEPT INVITE — AUTH REQUIRED (CALLABLE)
===================================================== */
const acceptInvite = onCall(async (request) => {
  const uid = await requireAuth(request);
  const token = (request.data?.inviteToken || "").toString().trim();
  if (token.length < 40) {
    throw new HttpsError("invalid-argument", "Invalid token.");
  }

  const user = await auth.getUser(uid);
  const email = toLowerTrim(user.email);

  const hash = sha256Hex(token);

  const result = await db.runTransaction(async (tx) => {
    const q = await tx.get(
      db.collection("user_invites").where("tokenHash", "==", hash).limit(1)
    );
    if (q.empty) throw new HttpsError("not-found", "Invite not found.");

    const doc = q.docs[0];
    const d = doc.data();
    if (d.used || d.revoked || nowMs() > d.expiresAtMs) {
      throw new HttpsError("failed-precondition", "Invite invalid.");
    }
    if (toLowerTrim(d.email) !== email) {
      throw new HttpsError("permission-denied", "Email mismatch.");
    }

    tx.set(
      db.doc(`users/${uid}`),
      {
        email,
        role: d.role,
        active: true,
        invitedBy: d.invitedBy || null,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    tx.update(doc.ref, {
      used: true,
      usedBy: uid,
      usedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return d.role;
  });

  return { ok: true, role: result };
});

/* =====================================================
   REVOKE INVITE — ADMIN ONLY (CALLABLE)
===================================================== */
const revokeInvite = onCall(async (request) => {
  const adminUid = await requireAuth(request);
  await requireAdmin(adminUid);

  const inviteId = (request.data?.inviteId || "").toString().trim();
  if (!inviteId) throw new HttpsError("invalid-argument", "inviteId required.");

  const ref = db.doc(`user_invites/${inviteId}`);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError("not-found", "Invite not found.");
  if (snap.data().used) {
    throw new HttpsError("failed-precondition", "Invite already used.");
  }

  await ref.update({
    revoked: true,
    revokedBy: adminUid,
    revokedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  return { ok: true };
});

/* =====================================================
   EXPORTS
===================================================== */
exports.createInvite = createInvite;
exports.validateInvite = validateInvite;
exports.acceptInvite = acceptInvite;
exports.revokeInvite = revokeInvite;
