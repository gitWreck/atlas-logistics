"use strict";

/**
 * 📏 SMS COST ESTIMATOR (CANONICAL – BACKEND)
 * Provider : Semaphore (PH)
 * Encoding : GSM-7 conservative
 */

const GSM_SINGLE_LIMIT = 160;
const GSM_MULTIPART_LIMIT = 153;
const MAX_SAFE_CREDITS = 5;

function normalizeMessage(message) {
  return String(message ?? "");
}

function calculateSmsCost(message = "") {
  const text = normalizeMessage(message);
  const length = text.length;

  const multipart = length > GSM_SINGLE_LIMIT;
  const credits = multipart
    ? Math.ceil(length / GSM_MULTIPART_LIMIT)
    : 1;

  return Object.freeze({
    length,
    credits,
    multipart,
  });
}

function assertSmsWithinLimit(message, maxCredits = MAX_SAFE_CREDITS) {
  const { credits } = calculateSmsCost(message);

  if (credits > maxCredits) {
    throw new Error(
      `SMS exceeds safe limit (${credits} > ${maxCredits} credits)`
    );
  }
}

module.exports = Object.freeze({
  calculateSmsCost,
  assertSmsWithinLimit,
  GSM_SINGLE_LIMIT,
  GSM_MULTIPART_LIMIT,
  MAX_SAFE_CREDITS,
});
