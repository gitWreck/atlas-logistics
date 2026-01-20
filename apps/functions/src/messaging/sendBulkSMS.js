"use strict";

/**
 * ======================================================
 * ATLAS — sendBulkSMS (PROD SAFE, 10/10)
 * Node 20 – CommonJS – Firebase Functions v2
 *
 * ✅ Features:
 * - Admin/Manager only (authGuards)
 * - Semaphore secrets (no hard-coded keys)
 * - Phone normalization (PH) + strong validation
 * - Message builder (buildStatusSMS)
 * - SMS cost tracking (shared/sms-cost)
 * - Smart suppression (sms_state per trackingId+phone)
 * - Optional bypass suppression (force=true)
 * - Concurrency-limited sending (stable + faster)
 * - Per-recipient isolated errors + summary
 * - Writes sms_logs for every attempt (success/fail)
 * - Audit trail for requested + completed (shared/audit)
 * ======================================================
 */

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const admin = require("firebase-admin");

// Internal modules
const { buildStatusSMS } = require("./buildStatusSMS");
const { calculateSmsCost } = require("../../shared/sms-cost");
const { DELAY_REASONS } = require("../../shared/delay-reasons");
const { buildSmsSignature } = require("../../shared/sms-suppression"); // you said you have this
const { writeAuditEvent } = require("../../shared/audit"); // you said you have this
const { assertAdminOrManager } = require("../system/authGuards");

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;

// Secrets (Semaphore)
const SEMAPHORE_API_KEY = defineSecret("SEMAPHORE_API_KEY");
const SEMAPHORE_SENDER_NAME = defineSecret("SEMAPHORE_SENDER_NAME");

// Limits
const MAX_BULK_RECIPIENTS = 50;
const MAX_SMS_CREDITS = 5;
const CONCURRENCY = 5;

// Collections
const SMS_LOGS_COL = "sms_logs";
const SMS_STATE_COL = "sms_state";

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

function normalizeDelayReason(r) {
  if (!r) return null;
  return String(r).trim().toUpperCase();
}

async function sendViaSemaphore({ phone, message, apiKey, sender }) {
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

async function runPool(items, limit, worker) {
  const results = new Array(items.length);
  let idx = 0;

  const runners = new Array(Math.min(limit, items.length))
    .fill(null)
    .map(async () => {
      while (true) {
        const current = idx++;
        if (current >= items.length) break;
        results[current] = await worker(items[current], current);
      }
    });

  await Promise.all(runners);
  return results;
}

/* ======================================================
   FUNCTION
====================================================== */
exports.sendBulkSMS = onCall(
  {
    region: "asia-southeast1",
    secrets: [SEMAPHORE_API_KEY, SEMAPHORE_SENDER_NAME],
    timeoutSeconds: 90,
    memory: "512MiB",
  },
  async (request) => {
    // ✅ Auth (Admin or Manager)
    const actor = await assertAdminOrManager(request);
    const uid = actor.uid;
    const role = actor.role;

    // ✅ Payload
    const {
      trackingId,
      status,
      delayReason = null,
      delayCleared = false,
      recipients = [],

      // Controls
      suppressSame = true, // default ON
      force = false, // bypass suppression
      reason = "manual_bulk_send",
    } = request.data || {};

    if (!trackingId || !status) {
      throw new HttpsError(
        "invalid-argument",
        "trackingId and status are required",
      );
    }

    if (!Array.isArray(recipients) || recipients.length === 0) {
      throw new HttpsError("invalid-argument", "recipients[] is required");
    }

    if (recipients.length > MAX_BULK_RECIPIENTS) {
      throw new HttpsError(
        "failed-precondition",
        `Bulk SMS limit exceeded (max ${MAX_BULK_RECIPIENTS})`,
      );
    }

    const normDelayReason = normalizeDelayReason(delayReason);
    if (normDelayReason && !DELAY_REASONS[normDelayReason]) {
      throw new HttpsError(
        "invalid-argument",
        `Unknown delay reason: ${normDelayReason}`,
      );
    }

    // ✅ Secrets
    const apiKey = SEMAPHORE_API_KEY.value();
    const sender = SEMAPHORE_SENDER_NAME.value();

    if (!apiKey)
      throw new HttpsError("failed-precondition", "SEMAPHORE_API_KEY not set");
    if (!sender)
      throw new HttpsError(
        "failed-precondition",
        "SEMAPHORE_SENDER_NAME not set",
      );

    // ✅ Message
    const message = buildStatusSMS({
      trackingId,
      status,
      delayReason: normDelayReason,
      delayCleared: !!delayCleared,
    });

    const { length, credits } = calculateSmsCost(message);
    if (credits > MAX_SMS_CREDITS) {
      throw new HttpsError(
        "failed-precondition",
        `SMS too long (${credits} credits)`,
      );
    }

    // ✅ One audit entry for request
    await writeAuditEvent(db, {
      actorUid: uid,
      actorRole: role,
      action: "sms_bulk_requested",
      entityType: "tracking_record",
      entityId: trackingId,
      meta: {
        status,
        delayReason: normDelayReason,
        delayCleared: !!delayCleared,
        recipientCount: recipients.length,
        suppressSame: !!suppressSame,
        force: !!force,
        reason,
        credits,
        length,
      },
    });

    // Normalize recipients
    const normalized = recipients.map((r) => {
      const raw = r?.phone ?? r?.mobile ?? r?.number ?? null;
      return {
        rawPhone: raw,
        phone: normalizePhonePH(raw),
        name: r?.name ? String(r.name) : null,
      };
    });

    let sent = 0;
    let failed = 0;
    let suppressed = 0;

    const results = await runPool(normalized, CONCURRENCY, async (rec) => {
      const phone = rec.phone;

      if (!phone) {
        failed++;
        return {
          phone: rec.rawPhone || null,
          success: false,
          error: "Invalid phone number",
        };
      }

      // Signature for suppression
      const signature = buildSmsSignature({
        trackingId,
        phone,
        status,
        delayReason: normDelayReason,
        delayCleared: !!delayCleared,
        message,
      });

      const stateId = `${trackingId}__${phone}`;
      const stateRef = db.collection(SMS_STATE_COL).doc(stateId);

      if (suppressSame && !force) {
        const stateSnap = await stateRef.get();
        const lastSig = stateSnap.exists
          ? stateSnap.data()?.lastSentSignature
          : null;

        if (lastSig && lastSig === signature) {
          suppressed++;
          // still return success for UX (it was intentionally suppressed)
          return { phone, success: true, suppressed: true };
        }
      }

      // Send attempt
      try {
        const providerResult = await sendViaSemaphore({
          phone,
          message,
          apiKey,
          sender,
        });

        const logRef = await db.collection(SMS_LOGS_COL).add({
          trackingId,
          phone,
          status,
          delayReason: normDelayReason,
          delayCleared: !!delayCleared,

          message,
          length,
          credits,

          provider: "semaphore",
          sender,

          type: "BULK",
          bulk: true,
          suppressed: false,

          requestedBy: uid,
          requestedRole: role,
          requestReason: reason,

          result: providerResult,
          at: FieldValue.serverTimestamp(),
          system: "atlas",
        });

        await stateRef.set(
          {
            trackingId,
            phone,
            lastSentSignature: signature,
            lastSentAt: FieldValue.serverTimestamp(),
            lastSmsLogId: logRef.id,
            lastStatus: status,
            lastDelayReason: normDelayReason,
            lastDelayCleared: !!delayCleared,
          },
          { merge: true },
        );

        sent++;
        return { phone, success: true, suppressed: false };
      } catch (err) {
        failed++;

        // Log failures too (important for ops)
        await db.collection(SMS_LOGS_COL).add({
          trackingId,
          phone,
          status,
          delayReason: normDelayReason,
          delayCleared: !!delayCleared,

          message,
          length,
          credits,

          provider: "semaphore",
          sender,

          type: "BULK",
          bulk: true,
          suppressed: false,

          requestedBy: uid,
          requestedRole: role,
          requestReason: reason,

          error: String(err?.message || err).slice(0, 500),
          at: FieldValue.serverTimestamp(),
          system: "atlas",
        });

        return { phone, success: false, error: String(err?.message || err) };
      }
    });

    // ✅ Completion audit
    await writeAuditEvent(db, {
      actorUid: uid,
      actorRole: role,
      action: "sms_bulk_completed",
      entityType: "tracking_record",
      entityId: trackingId,
      meta: {
        total: recipients.length,
        sent,
        failed,
        suppressed,
        status,
        delayReason: normDelayReason,
        delayCleared: !!delayCleared,
        reason,
      },
    });

    return {
      success: true,
      summary: {
        total: recipients.length,
        sent,
        failed,
        suppressed,
        credits,
        length,
      },
      results,
    };
  },
);
