"use strict";

const admin = require("firebase-admin");
const { HttpsError } = require("firebase-functions/v2/https");

if (!admin.apps.length) admin.initializeApp();

const db = admin.firestore();

/* ======================================================
   BASIC HELPERS
====================================================== */

function now() {
  return admin.firestore.FieldValue.serverTimestamp();
}

function ref(path) {
  return db.doc(path);
}

/* ======================================================
   AUTH / ROLE GUARDS
====================================================== */

async function requireAuth(context) {
  if (!context.auth?.uid) {
    throw new HttpsError("unauthenticated", "Authentication required");
  }
  return context.auth.uid;
}

async function requireRole(context, allowed = []) {
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
    user: snap.data()
  };
}

/* ======================================================
   🔐 BLACK-BOX AUDIT RECORDER (TRANSACTION SAFE)
====================================================== */

async function writeAuditLog(tx, {
  trackingDocId = null,
  trackingNumber = null,
  tripDocId = null,
  action,
  before,
  after,
  uid,
  role,
  extra = {}
}) {
  if (!action) {
    throw new Error("Audit log requires action");
  }

  const userSnap = await tx.get(db.collection("users").doc(uid));
  const user = userSnap.exists ? userSnap.data() : {};

  const logRef = db.collection("audit_logs").doc();

  tx.set(logRef, {
    trackingDocId,
    trackingNumber,
    tripDocId,
    action,
    before,
    after,
    by: {
      uid,
      name: user.name || "Unknown",
      role
    },
    extra,
    ts: admin.firestore.FieldValue.serverTimestamp()
  });
}

/* ======================================================
   EXPORTS
====================================================== */

module.exports = {
  db,
  now,
  ref,
  requireAuth,
  requireRole,
  writeAuditLog
};
