"use strict";

/**
 * smsQueueWorker (Scheduled)
 * ---------------------------------------------------------
 * ✅ Pull QUEUED items ready to send
 * ✅ Send via Semaphore
 * ✅ Log sms_logs for every attempt
 * ✅ Idempotent via sms_state (lastSentSignature)
 * ✅ Retry with exponential backoff
 */

const { onSchedule } = require("firebase-functions/v2/scheduler");
const { defineSecret } = require("firebase-functions/params");
const admin = require("firebase-admin");

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;

const SEMAPHORE_API_KEY = defineSecret("SEMAPHORE_API_KEY");
const SEMAPHORE_SENDER_NAME = defineSecret("SEMAPHORE_SENDER_NAME");

// tune
const BATCH_SIZE = 15;
const MAX_TRIES = 6;

function normalizePhonePH(phone) {
  if (!phone) return null;
  let p = String(phone).replace(/[^\d]/g, "");
  if (p.startsWith("09")) p = "63" + p.slice(1);
  if (p.startsWith("63") && p.length === 12) return p;
  return null;
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

function backoffSeconds(tries) {
  // 1, 2, 4, 8, 16, 32 minutes-ish
  const mins = Math.min(32, Math.pow(2, Math.max(0, tries)));
  return mins * 60;
}

exports.smsQueueWorker = onSchedule(
  {
    region: "asia-southeast1",
    schedule: "every 1 minutes",
    timeZone: "Asia/Manila",
    secrets: [SEMAPHORE_API_KEY, SEMAPHORE_SENDER_NAME],
  },
  async () => {
    const now = admin.firestore.Timestamp.now();

    // Fetch ready queue items
    const qSnap = await db
      .collection("sms_queue")
      .where("status", "==", "QUEUED")
      .where("nextAttemptAt", "<=", now)
      .orderBy("nextAttemptAt", "asc")
      .limit(BATCH_SIZE)
      .get();

    if (qSnap.empty) return;

    const apiKey = SEMAPHORE_API_KEY.value();
    const sender = SEMAPHORE_SENDER_NAME.value();

    for (const doc of qSnap.docs) {
      const q = doc.data() || {};
      const queueRef = doc.ref;

      const rawPhone = q.toPhone;
      const phone = normalizePhonePH(rawPhone);
      const message = String(q.message || "");
      const trackingNumber = q.trackingNumber || null;
      const idempotencyKey = String(q.idempotencyKey || "");

      // Hard fail if invalid
      if (!phone || !message || !idempotencyKey) {
        await queueRef.set(
          {
            status: "FAILED",
            error: "Invalid phone/message/idempotencyKey",
            failedAt: FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
        continue;
      }

      // Idempotency state: (trackingNumber optional)
      const stateId = trackingNumber ? `${trackingNumber}__${phone}` : `GEN__${phone}`;
      const stateRef = db.collection("sms_state").doc(stateId);

      const stateSnap = await stateRef.get();
      const lastKey = stateSnap.exists ? String(stateSnap.data()?.lastIdempotencyKey || "") : "";
      if (lastKey && lastKey === idempotencyKey) {
        // Already sent — mark done
        await queueRef.set(
          { status: "DONE", suppressed: true, doneAt: FieldValue.serverTimestamp() },
          { merge: true }
        );
        continue;
      }

      // Attempt send
      try {
        const result = await sendViaSemaphore({ phone, message, apiKey, sender });

        const logRef = await db.collection("sms_logs").add({
          provider: "semaphore",
          sender,
          phone,
          message,
          trackingNumber,
          idempotencyKey,
          queueId: doc.id,
          result,
          status: "SENT",
          at: FieldValue.serverTimestamp(),
          source: "smsQueueWorker",
        });

        await stateRef.set(
          {
            phone,
            trackingNumber: trackingNumber || null,
            lastIdempotencyKey: idempotencyKey,
            lastSentAt: FieldValue.serverTimestamp(),
            lastSmsLogId: logRef.id,
          },
          { merge: true }
        );

        await queueRef.set(
          { status: "DONE", tries: (q.tries || 0) + 1, doneAt: FieldValue.serverTimestamp() },
          { merge: true }
        );
      } catch (err) {
        const tries = (q.tries || 0) + 1;
        const next = admin.firestore.Timestamp.fromMillis(Date.now() + backoffSeconds(tries) * 1000);

        await db.collection("sms_logs").add({
          provider: "semaphore",
          sender,
          phone,
          message,
          trackingNumber,
          idempotencyKey,
          queueId: doc.id,
          status: "FAILED",
          error: String(err?.message || err).slice(0, 500),
          at: FieldValue.serverTimestamp(),
          source: "smsQueueWorker",
        });

        if (tries >= MAX_TRIES) {
          await queueRef.set(
            { status: "FAILED", tries, error: String(err?.message || err), failedAt: FieldValue.serverTimestamp() },
            { merge: true }
          );
        } else {
          await queueRef.set(
            { status: "QUEUED", tries, error: String(err?.message || err), nextAttemptAt: next },
            { merge: true }
          );
        }
      }
    }
  }
);
