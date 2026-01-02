"use strict";

/*************************************************
 * ATLAS — SMS SENDER (MANUAL + QUEUE) — FINAL 15/10
 * Node 20 – CommonJS – Firebase Functions v2
 *
 * ✅ Manual send (admin / manager)
 * ✅ Auto-send from sms_queue (consumer)
 * ✅ Smart suppression (sms_state signature)
 * ✅ Semaphore secrets (defineSecret)
 * ✅ Credits guard (both manual + auto)
 * ✅ Strong validation + PH phone normalization
 * ✅ Robust failure handling + retry + dead-letter
 * ✅ Fully audited (manual + auto + suppressed + dead-letter)
 *************************************************/

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { defineSecret } = require("firebase-functions/params");
const admin = require("firebase-admin");

const { buildStatusSMS } = require("./buildStatusSMS");
const { calculateSmsCost } = require("./shared/sms-cost");
const { buildSmsSignature } = require("./shared/sms-suppression");
const { writeAuditEvent } = require("./shared/audit");
const { assertAdminOrManager } = require("./authGuards");

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;

/* ======================================================
   SECRETS
====================================================== */
const SEMAPHORE_API_KEY = defineSecret("SEMAPHORE_API_KEY");
const SEMAPHORE_SENDER_NAME = defineSecret("SEMAPHORE_SENDER_NAME");

/* ======================================================
   LIMITS / COLLECTIONS
====================================================== */
const MAX_SMS_CREDITS = 5;
const AUTO_MAX_ATTEMPTS = 3;

const SMS_LOGS_COL = "sms_logs";
const SMS_STATE_COL = "sms_state";
const SMS_QUEUE_COL = "sms_queue";
const SMS_DEAD_COL = "sms_deadletter";

/* ======================================================
   HELPERS
====================================================== */
function normalizePhonePH(phone) {
  if (!phone) return null;
  let p = String(phone).replace(/[^\d]/g, "");
  if (p.startsWith("09")) p = "63" + p.slice(1);
  if (p.startsWith("63") && p.length === 12) return p;
  return null;
}

function requireString(v, fieldName) {
  if (typeof v !== "string" || !v.trim()) {
    throw new HttpsError("invalid-argument", `${fieldName} is required`);
  }
  return v.trim();
}

function safeStr(v, max = 500) {
  return String(v ?? "").slice(0, max);
}

async function sendViaSemaphore({ phone, message, apiKey, sender }) {
  // Node 20 has global fetch
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const res = await fetch("https://api.semaphore.co/api/v4/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        apikey: apiKey,
        number: phone,
        message,
        sendername: sender || undefined,
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      throw new Error(`Semaphore HTTP ${res.status}: ${txt}`.slice(0, 300));
    }

    return await res.json().catch(() => ({}));
  } finally {
    clearTimeout(timeout);
  }
}

/* ======================================================
   🔹 MANUAL SEND (CALLABLE)
   NOTE: intentionally named sendManualSMS to avoid collisions
====================================================== */
exports.sendManualSMS = onCall(
  {
    region: "asia-southeast1",
    secrets: [SEMAPHORE_API_KEY, SEMAPHORE_SENDER_NAME],
    timeoutSeconds: 30,
    memory: "256MiB",
  },
  async (request) => {
    const actor = await assertAdminOrManager(request);
    const uid = actor.uid;
    const role = actor.role;

    const trackingId = requireString(request.data?.trackingId, "trackingId");
    const phoneRaw = requireString(request.data?.phone, "phone");
    const status = requireString(request.data?.status, "status");

    const delayReason =
      typeof request.data?.delayReason === "string" && request.data.delayReason.trim()
        ? request.data.delayReason.trim()
        : null;

    const delayCleared = !!request.data?.delayCleared;

    const suppressSame = request.data?.suppressSame !== false; // default true
    const force = !!request.data?.force; // bypass suppression
    const reason =
      typeof request.data?.reason === "string" && request.data.reason.trim()
        ? request.data.reason.trim()
        : "manual_send";

    const normalized = normalizePhonePH(phoneRaw);
    if (!normalized) {
      throw new HttpsError("invalid-argument", "Invalid phone number");
    }

    // Build message from canonical builder
    const message = buildStatusSMS({
      trackingId,
      status,
      delayReason,
      delayCleared,
    });

    const { length, credits } = calculateSmsCost(message);
    if (credits > MAX_SMS_CREDITS) {
      throw new HttpsError(
        "failed-precondition",
        `SMS too long (${credits} credits)`
      );
    }

    const signature = buildSmsSignature({
      trackingId,
      phone: normalized,
      status,
      delayReason,
      delayCleared,
      message,
    });

    const stateRef = db.collection(SMS_STATE_COL).doc(`${trackingId}__${normalized}`);

    // Suppression check
    if (suppressSame && !force) {
      const stateSnap = await stateRef.get();
      if (stateSnap.exists && stateSnap.data()?.lastSentSignature === signature) {
        await writeAuditEvent(db, {
          actorUid: uid,
          actorRole: role,
          action: "SMS_SUPPRESSED_DUPLICATE",
          entityType: "tracking_record",
          entityId: trackingId,
          meta: { phone: normalized, status, delayReason, delayCleared },
        });

        return { success: true, suppressed: true };
      }
    }

    const apiKey = SEMAPHORE_API_KEY.value();
    const sender = SEMAPHORE_SENDER_NAME.value();
    if (!apiKey) throw new HttpsError("failed-precondition", "SEMAPHORE_API_KEY not set");
    if (!sender) throw new HttpsError("failed-precondition", "SEMAPHORE_SENDER_NAME not set");

    // Send
    try {
      const providerResult = await sendViaSemaphore({
        phone: normalized,
        message,
        apiKey,
        sender,
      });

      const logRef = await db.collection(SMS_LOGS_COL).add({
        trackingId,
        phone: normalized,
        status,
        delayReason,
        delayCleared: !!delayCleared,
        message,
        length,
        credits,
        provider: "semaphore",
        sender,
        type: "MANUAL",
        requestedBy: uid,
        requestedRole: role,
        requestReason: reason,
        signature,
        result: providerResult,
        at: FieldValue.serverTimestamp(),
        system: "atlas",
      });

      await stateRef.set(
        {
          trackingId,
          phone: normalized,
          lastSentSignature: signature,
          lastSentAt: FieldValue.serverTimestamp(),
          lastSmsLogId: logRef.id,
          lastStatus: status,
          lastDelayReason: delayReason,
          lastDelayCleared: !!delayCleared,
          source: "manual",
        },
        { merge: true }
      );

      await writeAuditEvent(db, {
        actorUid: uid,
        actorRole: role,
        action: "SMS_MANUAL_SENT",
        entityType: "tracking_record",
        entityId: trackingId,
        meta: { phone: normalized, status, delayReason, delayCleared, credits, length, reason },
      });

      return { success: true, smsLogId: logRef.id, suppressed: false };
    } catch (err) {
      const msg = safeStr(err?.message || err, 500);

      await db.collection(SMS_LOGS_COL).add({
        trackingId,
        phone: normalized,
        status,
        delayReason,
        delayCleared: !!delayCleared,
        message,
        length,
        credits,
        provider: "semaphore",
        sender: SEMAPHORE_SENDER_NAME.value() || null,
        type: "MANUAL",
        requestedBy: uid,
        requestedRole: role,
        requestReason: reason,
        signature,
        error: msg,
        at: FieldValue.serverTimestamp(),
        system: "atlas",
      });

      await writeAuditEvent(db, {
        actorUid: uid,
        actorRole: role,
        action: "SMS_MANUAL_FAILED",
        entityType: "tracking_record",
        entityId: trackingId,
        meta: { phone: normalized, status, delayReason, delayCleared, error: msg },
      });

      throw new HttpsError("internal", "SMS send failed", { error: msg });
    }
  }
);

/* ======================================================
   🔁 AUTO SEND — QUEUE CONSUMER
   - Reads sms_queue/{queueId}
   - Idempotent via sms_state signature
   - Retries with attempts counter
   - Dead-letters after AUTO_MAX_ATTEMPTS
====================================================== */
exports.sendSMSFromQueue = onDocumentCreated(
  {
    region: "asia-southeast1",
    document: `${SMS_QUEUE_COL}/{queueId}`,
    secrets: [SEMAPHORE_API_KEY, SEMAPHORE_SENDER_NAME],
    timeoutSeconds: 60,
    memory: "256MiB",
  },
  async (event) => {
    const queueId = event.params.queueId;
    const ref = event.data?.ref;

    const data = event.data?.data();
    if (!data || !ref) return;

    const trackingId = data.trackingId || null;
    const truckTripId = data.truckTripId || null;
    const shipmentId = data.shipmentId || null;

    const phoneNorm = normalizePhonePH(data.phone);
    const message = typeof data.message === "string" ? data.message : null;
    const status = data.status || null;
    const delayReason = data.delayReason || null;
    const delayCleared = !!data.delayCleared;
    const signature = data.signature || null;

    // If critical data missing, dead-letter immediately (no infinite retries)
    if (!trackingId || !phoneNorm || !message || !status || !signature) {
      await db.collection(SMS_DEAD_COL).doc(queueId).set(
        {
          ...data,
          _deadReason: "missing_required_fields",
          _deadAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
      // best-effort cleanup
      await ref.delete().catch(() => {});
      return;
    }

    // Credits guard (auto path MUST enforce too)
    const { credits, length } = calculateSmsCost(message);
    if (credits > MAX_SMS_CREDITS) {
      await db.collection(SMS_DEAD_COL).doc(queueId).set(
        {
          ...data,
          _deadReason: `sms_too_long_${credits}_credits`,
          _deadAt: FieldValue.serverTimestamp(),
          credits,
          length,
        },
        { merge: true }
      );
      await ref.delete().catch(() => {});
      return;
    }

    const stateRef = db.collection(SMS_STATE_COL).doc(`${trackingId}__${phoneNorm}`);
    const stateSnap = await stateRef.get();

    // Idempotency: if already sent this signature, drop queue item
    if (stateSnap.exists && stateSnap.data()?.lastSentSignature === signature) {
      await ref.delete().catch(() => {});
      return;
    }

    const apiKey = SEMAPHORE_API_KEY.value();
    const sender = SEMAPHORE_SENDER_NAME.value();
    if (!apiKey || !sender) {
      // infra misconfig: retry later by throwing (function will retry)
      throw new Error("Semaphore secrets missing");
    }

    // Attempts handling
    const prevAttempts = Number(data.attempts || 0);
    if (prevAttempts >= AUTO_MAX_ATTEMPTS) {
      await db.collection(SMS_DEAD_COL).doc(queueId).set(
        {
          ...data,
          phone: phoneNorm,
          _deadReason: "max_attempts_reached",
          _deadAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
      await ref.delete().catch(() => {});
      return;
    }

    // Mark attempt (best effort — no txn needed)
    await ref.set(
      {
        attempts: prevAttempts + 1,
        lastAttemptAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    try {
      const providerResult = await sendViaSemaphore({
        phone: phoneNorm,
        message,
        apiKey,
        sender,
      });

      const logRef = await db.collection(SMS_LOGS_COL).add({
        trackingId,
        shipmentId,
        truckTripId,
        phone: phoneNorm,
        status,
        delayReason,
        delayCleared,
        message,
        length,
        credits,
        provider: "semaphore",
        sender,
        type: "AUTO",
        signature,
        result: providerResult,
        at: FieldValue.serverTimestamp(),
        system: "atlas",
      });

      await stateRef.set(
        {
          trackingId,
          phone: phoneNorm,
          lastSentSignature: signature,
          lastSentAt: FieldValue.serverTimestamp(),
          lastSmsLogId: logRef.id,
          lastStatus: status,
          lastDelayReason: delayReason,
          lastDelayCleared: !!delayCleared,
          source: "auto",
          truckTripId: truckTripId || null,
        },
        { merge: true }
      );

      await writeAuditEvent(db, {
        actorUid: null,
        actorRole: "system",
        action: "SMS_AUTO_SENT",
        entityType: "tracking_record",
        entityId: trackingId,
        meta: {
          queueId,
          phone: phoneNorm,
          status,
          delayReason,
          delayCleared,
          truckTripId,
          shipmentId,
          credits,
          length,
        },
      });

      // ✅ cleanup queue item (success)
      await ref.delete().catch(() => {});
    } catch (err) {
      const msg = safeStr(err?.message || err, 500);

      // Log failure attempt
      await db.collection(SMS_LOGS_COL).add({
        trackingId,
        shipmentId,
        truckTripId,
        phone: phoneNorm,
        status,
        delayReason,
        delayCleared,
        message,
        length,
        credits,
        provider: "semaphore",
        sender,
        type: "AUTO",
        signature,
        error: msg,
        at: FieldValue.serverTimestamp(),
        system: "atlas",
      });

      await writeAuditEvent(db, {
        actorUid: null,
        actorRole: "system",
        action: "SMS_AUTO_FAILED",
        entityType: "tracking_record",
        entityId: trackingId,
        meta: { queueId, phone: phoneNorm, status, delayReason, delayCleared, error: msg },
      });

      // If next attempt would exceed max, dead-letter and delete queue.
      const nextAttempts = prevAttempts + 1;
      if (nextAttempts >= AUTO_MAX_ATTEMPTS) {
        await db.collection(SMS_DEAD_COL).doc(queueId).set(
          {
            ...data,
            phone: phoneNorm,
            attempts: nextAttempts,
            lastError: msg,
            _deadReason: "provider_fail_max_attempts",
            _deadAt: FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
        await ref.delete().catch(() => {});
        return;
      }

      // Otherwise, leave in queue for retry (do NOT delete)
      await ref.set(
        {
          lastError: msg,
          lastErrorAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      // Throw to allow function retry/backoff
      throw err;
    }
  }
);
