"use strict";

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const admin = require("firebase-admin");
const fetch = require("node-fetch");

const { buildStatusSMS } = require("./buildStatusSMS");
const { calculateSmsCost } = require("./shared/sms-cost");
const { buildSmsSignature } = require("./shared/sms-suppression");
const { writeAuditEvent } = require("./shared/audit");
const { assertAdminOrManager } = require("./authGuards");

const SEMAPHORE_API_KEY = defineSecret("SEMAPHORE_API_KEY");
const SEMAPHORE_SENDER_NAME = defineSecret("SEMAPHORE_SENDER_NAME");

function normalizePhone(phone) {
  if (!phone) return null;
  let p = String(phone).replace(/[^\d]/g, "");
  if (p.startsWith("09")) p = "63" + p.slice(1);
  if (p.startsWith("63") && p.length === 12) return p;
  return null;
}

async function sendViaSemaphore({ phone, message, apiKey, sender }) {
  const res = await fetch("https://api.semaphore.co/api/v4/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      apikey: apiKey,
      number: phone,
      message,
      sendername: sender,
    }),
  });
  if (!res.ok) throw new Error(`Semaphore HTTP ${res.status}`);
  return res.json();
}

exports.sendSMS = onCall(
  {
    region: "asia-southeast1",
    secrets: [SEMAPHORE_API_KEY, SEMAPHORE_SENDER_NAME],
    timeoutSeconds: 30,
    memory: "256MiB",
  },
  async (request) => {
    const { role, uid } = await assertAdminOrManager(request);

    const {
      trackingId,
      phone,
      status,
      delayReason = null,
      delayCleared = false,
      suppressSame = true,     // ✅ smart suppression default ON
      force = false,           // ✅ admin can override suppression
      reason = "manual_send",  // audit meta
    } = request.data || {};

    if (!trackingId || !phone || !status) {
      throw new HttpsError("invalid-argument", "Missing required fields");
    }

    const normalized = normalizePhone(phone);
    if (!normalized) throw new HttpsError("invalid-argument", "Invalid phone number");

    const message = buildStatusSMS({ trackingId, status, delayReason, delayCleared });
    const { credits } = calculateSmsCost(message);
    if (credits > 5) throw new HttpsError("failed-precondition", "SMS too long");

    // ✅ suppression check (per trackingId+phone)
    const signature = buildSmsSignature({
      trackingId,
      phone: normalized,
      status,
      delayReason,
      delayCleared,
      message,
    });

    const stateRef = admin.firestore().doc(`sms_state/${trackingId}__${normalized}`);
    const stateSnap = await stateRef.get();
    const lastSig = stateSnap.exists ? stateSnap.data()?.lastSentSignature : null;

    if (suppressSame && !force && lastSig === signature) {
      await writeAuditEvent(admin.firestore(), {
        actorUid: uid,
        actorRole: role,
        action: "sms_suppressed_same_signature",
        entityType: "tracking_record",
        entityId: trackingId,
        meta: { phone: normalized, status, delayReason, delayCleared, reason },
      });
      return { success: true, suppressed: true, reason: "same_signature" };
    }

    const apiKey = SEMAPHORE_API_KEY.value();
    const sender = SEMAPHORE_SENDER_NAME.value();
    if (!apiKey) throw new HttpsError("failed-precondition", "SEMAPHORE_API_KEY not set");
    if (!sender) throw new HttpsError("failed-precondition", "SEMAPHORE_SENDER_NAME not set");

    const providerResult = await sendViaSemaphore({
      phone: normalized,
      message,
      apiKey,
      sender,
    });

    const logRef = await admin.firestore().collection("sms_logs").add({
      trackingId,
      phone: normalized,
      status,
      delayReason,
      delayCleared: !!delayCleared,
      message,
      credits,
      provider: "semaphore",
      sender,
      bulk: false,
      resendOf: null,
      requestedBy: uid,
      requestedRole: role,
      requestReason: reason,
      result: providerResult,
      at: admin.firestore.FieldValue.serverTimestamp(),
    });

    await stateRef.set(
      {
        trackingId,
        phone: normalized,
        lastSentSignature: signature,
        lastSentAt: admin.firestore.FieldValue.serverTimestamp(),
        lastSmsLogId: logRef.id,
        lastStatus: status,
        lastDelayReason: delayReason,
        lastDelayCleared: !!delayCleared,
      },
      { merge: true }
    );

    await writeAuditEvent(admin.firestore(), {
      actorUid: uid,
      actorRole: role,
      action: "sms_sent_single",
      entityType: "tracking_record",
      entityId: trackingId,
      meta: { phone: normalized, status, delayReason, delayCleared, credits, reason, smsLogId: logRef.id },
    });

    return { success: true, suppressed: false, smsLogId: logRef.id };
  }
);
