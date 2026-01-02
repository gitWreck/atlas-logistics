"use strict";

/*************************************************
 * ATLAS — Preview Manual SMS (Option B)
 * Node 20 – Firebase Functions v2
 *
 * ✅ Admin / Manager only
 * ✅ Uses SAME payload as sendSMS
 * ✅ No Firestore reads
 * ✅ No side effects
 * ✅ Guaranteed preview = actual SMS
 *************************************************/

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { assertAdminOrManager } = require("./_shared");
const { buildStatusSMS } = require("./buildStatusSMS");

/* ======================================================
   FUNCTION
====================================================== */
exports.previewManualSms = onCall(
  { region: "asia-southeast1" },
  async (req) => {
    // 🔐 Auth
    await assertAdminOrManager(req);

    const {
      trackingId,
      status,
      delayReason = null,
      delayCleared = false,
    } = req.data || {};

    if (!trackingId || !status) {
      throw new HttpsError(
        "invalid-argument",
        "trackingId and status are required"
      );
    }

    const normalizedDelayReason =
      typeof delayReason === "string" && delayReason.trim()
        ? delayReason.trim().toUpperCase()
        : null;

    const message = buildStatusSMS({
      trackingId,
      status,
      delayReason: normalizedDelayReason,
      delayCleared: !!delayCleared,
    });

    if (!message || typeof message !== "string") {
      throw new HttpsError(
        "internal",
        "Failed to generate SMS preview"
      );
    }

    return {
      success: true,
      preview: message,
      meta: {
        trackingId,
        status,
        delayReason: normalizedDelayReason,
        delayCleared: !!delayCleared,
        length: message.length,
      },
    };
  }
);
