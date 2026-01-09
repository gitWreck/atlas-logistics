"use strict";

/**
 * ======================================================
 * ATLAS — sendManualSms (FINAL 15/10)
 *
 * Purpose:
 * - One-off human-triggered SMS
 * - Admin / Manager override
 * - Fully audited & cost-tracked
 * - Optional suppression bypass
 * ======================================================
 */

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const admin = require("firebase-admin");

const { calculateSmsCost } = require("../../shared/sms-cost");
const { buildSmsSignature } = require("../../shared/sms-suppression");
const { writeAuditEvent } = require("../../shared/audit");
const { assertAdminOrManager } = require("./../system/authGuards");

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;

const SEMAPHORE_API_KEY = defineSecret("SEMAPHORE_API_KEY");
const SEMAPHORE_SENDER_NAME = defineSecret("SEMAPHORE_SENDER_NAME");

const MAX_SMS_CREDITS = 5;

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

async function sendViaSemaphore({ phone, message, apiKey, sender }) {
  const res = await fetch("https://api.semaphore.co/api/v4/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      apikey: apiKey,
      number: phone,
      message,
      sendername: sender || undefined,
    }),
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Semaphore ${res.status}: ${txt}`);
  }

  return await res.json().catch(() => ({}));
}

/* ======================================================
   FUNCTION
====================================================== */
exports.sendManualSms = onCall(
  {
    region: "asia-southeast1",
    secrets: [SEMAPHORE_API_KEY, SEMAPHORE_SENDER_NAME],
  },
  async (request) => {
    // 🔐 Auth
    const actor = await assertAdminOrManager(request);
    const uid = actor.uid;
    const role = actor.role;

    const {
      phone,
      message,
      trackingId = null,
      tripDocId = null,
      reason = "manual_override",
      suppressSame = true,
      force = false,
    } = request.data || {};

    if (!phone || !message) {
      throw new HttpsError(
        "invalid-argument",
        "phone and message are required"
      );
    }

    const normalizedPhone = normalizePhonePH(phone);
    if (!normalizedPhone) {
      throw new HttpsError("invalid-argument", "Invalid PH phone number");
    }

    // 📏 Cost check
    const { credits, length } = calculateSmsCost(message);
    if (credits > MAX_SMS_CREDITS) {
      throw new HttpsError(
        "failed-precondition",
        `SMS too long (${credits} credits)`
      );
    }

    const apiKey = SEMAPHORE_API_KEY.value();
    const sender = SEMAPHORE_SENDER_NAME.value();

    if (!apiKey || !sender) {
      throw new HttpsError("failed-precondition", "Semaphore secrets missing");
    }

    // 🔁 Suppression
    const signature = buildSmsSignature({
      trackingId,
      phone: normalizedPhone,
      message,
      source: "manual",
    });

    const stateId = `${trackingId || "manual"}__${normalizedPhone}`;
    const stateRef = db.collection("sms_state").doc(stateId);

    if (suppressSame && !force) {
      const stateSnap = await stateRef.get();
      if (
        stateSnap.exists &&
        stateSnap.data()?.lastSentSignature === signature
      ) {
        return {
          success: true,
          suppressed: true,
          phone: normalizedPhone,
        };
      }
    }

    // 📤 Send
    let providerResult;
    try {
      providerResult = await sendViaSemaphore({
        phone: normalizedPhone,
        message,
        apiKey,
        sender,
      });
    } catch (err) {
      await db.collection("sms_logs").add({
        phone: normalizedPhone,
        message,
        credits,
        length,
        type: "MANUAL",
        trackingId,
        tripDocId,
        requestedBy: uid,
        requestedRole: role,
        error: String(err.message || err),
        at: FieldValue.serverTimestamp(),
      });

      throw new HttpsError("internal", "SMS send failed");
    }

    // 🧾 Log success
    const logRef = await db.collection("sms_logs").add({
      phone: normalizedPhone,
      message,
      credits,
      length,
      type: "MANUAL",
      trackingId,
      tripDocId,
      requestedBy: uid,
      requestedRole: role,
      reason,
      provider: "semaphore",
      result: providerResult,
      at: FieldValue.serverTimestamp(),
    });

    await stateRef.set(
      {
        lastSentSignature: signature,
        lastSentAt: FieldValue.serverTimestamp(),
        lastSmsLogId: logRef.id,
      },
      { merge: true }
    );

    // 🧠 Audit
    await writeAuditEvent(db, {
      actorUid: uid,
      actorRole: role,
      action: "sms_manual_sent",
      entityType: trackingId ? "tracking_record" : "manual",
      entityId: trackingId || normalizedPhone,
      meta: {
        phone: normalizedPhone,
        credits,
        reason,
      },
    });

    return {
      success: true,
      phone: normalizedPhone,
      credits,
      length,
    };
  }
);
