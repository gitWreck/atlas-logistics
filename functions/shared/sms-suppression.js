"use strict";

const crypto = require("crypto");

/**
 * Build a stable signature for "what we are about to send".
 * If signature matches lastSentSignature, we suppress.
 */
function buildSmsSignature({ trackingId, phone, status, delayReason, delayCleared, message }) {
  const payload = {
    trackingId: trackingId || null,
    phone: phone || null,
    status: status || null,
    delayReason: delayReason || null,
    delayCleared: !!delayCleared,
    message: message || null,
  };

  return crypto
    .createHash("sha256")
    .update(JSON.stringify(payload))
    .digest("hex");
}

module.exports = Object.freeze({ buildSmsSignature });
