"use strict";

/*************************************************
 * ATLAS — Preview Next SMS (Safe / Side-Effect Free)
 * Node 20 – Firebase Functions v2
 *
 * ✅ Admin / Manager only
 * ✅ Same message builder as sendSMS / autoSms
 * ✅ Delay-aware (WEATHER / RORO)
 * ✅ No Firestore writes
 *************************************************/

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { requireRole } = require("../../_shared");
const { buildStatusSMS } = require("./buildStatusSMS");

/* ======================================================
   FUNCTION
====================================================== */
exports.previewNextSms = onCall({ region: "asia-southeast1" }, async (req) => {
  await requireRole(req, ["admin", "manager"]);

  const {
    trackingId,
    status,
    delayReason = null,
    delayCleared = false,
  } = req.data || {};

  if (!trackingId || !status) {
    throw new HttpsError(
      "invalid-argument",
      "trackingId and status are required",
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
    throw new HttpsError("internal", "Failed to build SMS preview");
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
});
