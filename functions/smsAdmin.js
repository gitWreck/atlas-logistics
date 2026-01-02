"use strict";

/*************************************************
 * ATLAS – SMS ADMIN CONTROLS (PROD)
 * Node 20 – Firebase Functions v2
 *
 * ✅ Admin + Manager
 * ✅ Per-TRUCK auto-SMS toggle
 * ✅ Audit logging
 * ✅ Manual resend (force)
 * ✅ Preview SMS
 * ✅ Cost dashboard
 *************************************************/

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");

const { assertAdminOrManager } = require("./authGuards");
const { buildStatusSMS } = require("./buildStatusSMS");
const { calculateSmsCost } = require("./shared/sms-cost");
const { writeAuditEvent } = require("./shared/audit");

// Safe init
if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;

/* ======================================================
   🔁 TOGGLE AUTO-SMS PER TRUCK
====================================================== */
exports.setTruckAutoSms = onCall(
  { region: "asia-southeast1" },
  async (request) => {
    const { uid, role } = await assertAdminOrManager(request);

    const { truckId, enabled } = request.data || {};
    if (!truckId || typeof enabled !== "boolean") {
      throw new HttpsError("invalid-argument", "truckId and enabled required");
    }

    const ref = db.collection("trucks").doc(truckId);

    await ref.set(
      {
        autoSmsEnabled: enabled,
        autoSmsUpdatedBy: uid,
        autoSmsUpdatedRole: role,
        autoSmsUpdatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    await writeAuditEvent(db, {
      actorUid: uid,
      actorRole: role,
      action: "truck_auto_sms_updated",
      entityType: "truck",
      entityId: truckId,
      meta: { enabled },
    });

    return { success: true, truckId, enabled };
  }
);

/* ======================================================
   👁 PREVIEW SMS (NO SEND)
====================================================== */
exports.previewStatusSMS = onCall(
  { region: "asia-southeast1" },
  async (request) => {
    await assertAdminOrManager(request);

    const { trackingId, status, delayReason, delayCleared } =
      request.data || {};

    if (!trackingId || !status) {
      throw new HttpsError("invalid-argument", "trackingId + status required");
    }

    const message = buildStatusSMS({
      trackingId,
      status,
      delayReason,
      delayCleared,
    });

    const cost = calculateSmsCost(message);

    return {
      message,
      ...cost,
    };
  }
);

/* ======================================================
   🔁 FORCE RESEND SMS (BYPASS SUPPRESSION)
====================================================== */
exports.forceResendSMS = onCall(
  { region: "asia-southeast1" },
  async (request) => {
    const { uid, role } = await assertAdminOrManager(request);

    const { smsLogId, reason = "manual_resend" } = request.data || {};
    if (!smsLogId) {
      throw new HttpsError("invalid-argument", "smsLogId required");
    }

    const snap = await db.collection("sms_logs").doc(smsLogId).get();
    if (!snap.exists) {
      throw new HttpsError("not-found", "SMS log not found");
    }

    const data = snap.data();

    await db.collection("sms_resend_queue").add({
      ...data,
      resendOf: smsLogId,
      forced: true,
      requestedBy: uid,
      requestedRole: role,
      reason,
      at: FieldValue.serverTimestamp(),
    });

    await writeAuditEvent(db, {
      actorUid: uid,
      actorRole: role,
      action: "sms_force_resend",
      entityType: "sms_log",
      entityId: smsLogId,
      meta: { reason },
    });

    return { success: true };
  }
);

/* ======================================================
   📊 SMS COST DASHBOARD
====================================================== */
exports.getSmsCostSummary = onCall(
  { region: "asia-southeast1" },
  async (request) => {
    await assertAdminOrManager(request);

    const since = FieldValue.serverTimestamp();
    const snap = await db.collection("sms_logs").get();

    let totalCredits = 0;
    let totalMessages = 0;

    snap.forEach((d) => {
      const c = d.data()?.credits || 0;
      totalCredits += c;
      totalMessages++;
    });

    return {
      totalMessages,
      totalCredits,
      estimatedCostPHP: totalCredits * 0.5, // adjust if needed
    };
  }
);
