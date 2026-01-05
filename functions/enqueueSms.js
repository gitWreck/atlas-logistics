"use strict";

/**
 * enqueueSms (Callable)
 * ---------------------------------------------------------
 * ✅ Admin/Manager can enqueue
 * ✅ Creates sms_queue item
 * ✅ Worker sends + retries
 */

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;

async function assertAdminOrManager(req) {
  if (!req.auth?.uid) throw new HttpsError("unauthenticated", "Login required");
  const snap = await db.collection("users").doc(req.auth.uid).get();
  if (!snap.exists || snap.data().active !== true) throw new HttpsError("permission-denied", "Inactive user");
  const role = String(snap.data().role || "").toLowerCase();
  if (role !== "admin" && role !== "manager") throw new HttpsError("permission-denied", "Admin/Manager only");
  return { uid: req.auth.uid, role };
}

exports.enqueueSms = onCall({ region: "asia-southeast1" }, async (req) => {
  const actor = await assertAdminOrManager(req);

  const toPhone = String(req.data?.toPhone || "").trim();
  const message = String(req.data?.message || "").trim();
  const trackingNumber = String(req.data?.trackingNumber || "").trim().toUpperCase() || null;
  const idempotencyKey = String(req.data?.idempotencyKey || "").trim();

  if (!toPhone) throw new HttpsError("invalid-argument", "toPhone required");
  if (!message) throw new HttpsError("invalid-argument", "message required");
  if (!idempotencyKey) throw new HttpsError("invalid-argument", "idempotencyKey required");

  const ref = await db.collection("sms_queue").add({
    toPhone,
    message,
    trackingNumber,
    idempotencyKey,
    status: "QUEUED",
    tries: 0,
    nextAttemptAt: FieldValue.serverTimestamp(),
    createdAt: FieldValue.serverTimestamp(),
    createdBy: actor.uid,
    createdRole: actor.role,
  });

  return { ok: true, queueId: ref.id };
});
