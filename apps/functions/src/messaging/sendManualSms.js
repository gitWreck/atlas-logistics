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
// const { defineSecret } = require("firebase-functions/params");
const admin = require("firebase-admin");

const { calculateSmsCost } = require("../../shared/sms-cost");
const { buildSmsSignature } = require("../../shared/sms-suppression");
const { writeAuditEvent } = require("../../shared/audit");
const { assertAdminOrManager } = require("../system/authGuards");
const { writeMessagingActionLog } = require("../utilities/messagingLogger");
const { requireNormalizedPhone } = require("../utilities/phoneHelpers");
const crypto = require("crypto");
const {
  CUSTOMER_NOTIFICATION_TYPES,
  NO_TRIP_SCOPE,
  sendDirectCustomerNotification,
} = require("../notifications/customerNotificationService");

const {
  sendSmsViaProvider,
  SEMAPHORE_API_KEY,
  SEMAPHORE_SENDER_NAME,
} = require("../../shared/sms-service");

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;

const MAX_SMS_CREDITS = 5;

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
      phone = request.data?.phoneNumber,
      message,
      trackingId = request.data?.shipmentId || null,
      tripDocId = request.data?.tripId || null,
      reason = "manual_override",
      suppressSame = true,
      force = false,
    } = request.data || {};

    if (!phone || !message) {
      throw new HttpsError(
        "invalid-argument",
        "phone and message are required",
      );
    }

    const normalizedPhone = requireNormalizedPhone(phone);
    if (!normalizedPhone) {
      throw new HttpsError("invalid-argument", "Invalid PH phone number");
    }

    // 📏 Cost check
    const { credits, length } = calculateSmsCost(message);
    if (credits > MAX_SMS_CREDITS) {
      throw new HttpsError(
        "failed-precondition",
        `SMS too long (${credits} credits)`,
      );
    }

    // const apiKey = SEMAPHORE_API_KEY.value();
    // const sender = SEMAPHORE_SENDER_NAME.value();

    // if (!apiKey || !sender) {
    //   throw new HttpsError("failed-precondition", "Semaphore secrets missing");
    // }

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
    const notificationType = `${CUSTOMER_NOTIFICATION_TYPES.MANUAL_BROADCAST}_${crypto
      .createHash("sha1")
      .update(String(message))
      .digest("hex")
      .slice(0, 10)}`;

    try {
      if (force) {
        providerResult = await sendSmsViaProvider({
          phone: normalizedPhone,
          message,
        });
      } else {
        const dedupResult = await sendDirectCustomerNotification({
          db,
          phone: normalizedPhone,
          tripId: tripDocId || NO_TRIP_SCOPE,
          shipmentId: trackingId || null,
          notificationType,
          channels: { sms: true, email: false, push: false },
          customSmsMessage: String(message).trim(),
          actor: { uid, role },
          source: "MANUAL_SMS",
        });

        if ((dedupResult.sent || 0) < 1) {
          const duplicate = dedupResult.results?.some(
            (entry) => entry.skipped && entry.reason === "duplicate",
          );
          if (duplicate) {
            return {
              success: true,
              suppressed: true,
              phone: normalizedPhone,
              reason: "deduplicated",
            };
          }
          throw new Error(dedupResult.error || "SMS send skipped");
        }

        providerResult = dedupResult;
      }
    } catch (err) {
      await writeMessagingActionLog({
        db,
        phone: normalizedPhone,
        message,
        credits,
        length,
        type: "MANUAL",
        trackingId,
        tripDocId,
        actorId: uid,
        actorRole: role,
        requestedBy: uid,
        requestedRole: role,
        error: String(err.message || err),
        at: FieldValue.serverTimestamp(),
      });

      throw new HttpsError("internal", "SMS send failed");
    }

    // 🧾 Log success
    const logRef = await writeMessagingActionLog({
      db,
      phone: normalizedPhone,
      message,
      credits,
      length,
      type: "MANUAL",
      trackingId,
      tripDocId,
      actorId: uid,
      actorRole: role,
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
      { merge: true },
    );

    // 🧠 Audit
    await writeAuditEvent(db, {
      actorUid: uid,
      actorRole: role,
      // actorName: actor.name || null,
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
  },
);
