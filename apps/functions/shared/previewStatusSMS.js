"use strict";

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");

const { buildStatusSMS } = require("./buildStatusSMS");
const { calculateSmsCost } = require("./shared/sms-cost");
const { DELAY_REASONS } = require("./shared/delay-reasons");
const { assertAdminOrManager } = require("./authGuards");

if (!admin.apps.length) admin.initializeApp();

exports.previewStatusSMS = onCall(
  { region: "asia-southeast1" },
  async (request) => {
    await assertAdminOrManager(request);

    const {
      trackingId,
      status,
      delayReason = null,
      delayCleared = false,
      recipientCount = 1,
    } = request.data || {};

    if (!trackingId || !status) {
      throw new HttpsError("invalid-argument", "Missing preview parameters");
    }

    if (delayReason && !DELAY_REASONS[delayReason]) {
      throw new HttpsError("invalid-argument", "Invalid delay reason");
    }

    const message = buildStatusSMS({
      trackingId,
      status,
      delayReason,
      delayCleared,
    });

    const { length, credits } = calculateSmsCost(message);

    return {
      message,
      length,
      creditsPerRecipient: credits,
      estimatedTotalCredits: credits * Math.max(1, recipientCount),
      warning:
        credits > 1
          ? "Message exceeds 1 SMS credit"
          : null,
    };
  }
);
