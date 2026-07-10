"use strict";

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { Api } = require("tls-sig-api-v2");
const { requireAuth } = require("../utilities/helpers");
const {
  TRTC_SDK_APP_ID,
  TRTC_SECRET_KEY,
  getRtcSecretConfig,
} = require("./trtcConfig");

const USER_SIG_TTL_SECONDS = 86400;

function normalizeUserId(value) {
  const userId = String(value || "").trim();

  if (!userId) {
    throw new HttpsError("invalid-argument", "User ID is required.");
  }

  if (userId.length > 32) {
    throw new HttpsError("invalid-argument", "User ID is too long.");
  }

  if (!/^[A-Za-z0-9_-]+$/.test(userId)) {
    throw new HttpsError(
      "invalid-argument",
      "User ID contains unsupported characters.",
    );
  }

  return userId;
}

/**
 * Generates a Tencent TRTC UserSig for the authenticated Firebase user.
 *
 * @param {object} request The callable request context.
 * @returns {{sdkAppId: number, userId: string, userSig: string, expiresIn: number}}
 */
exports.generateTencentUserSig = onCall(
  {
    region: "asia-southeast1",
    maxInstances: 10,
    memory: "512MiB",
    secrets: [TRTC_SDK_APP_ID, TRTC_SECRET_KEY],
  },
  async (request) => {
    try {
      await Promise.resolve();
      const uid = requireAuth(request);
      const userId = normalizeUserId(uid);
      const rtcConfig = getRtcSecretConfig();

      if (!rtcConfig?.isConfigured) {
        throw new HttpsError(
          "failed-precondition",
          "Tencent RTC is not configured.",
        );
      }

      const sdkAppId = Number(rtcConfig.sdkAppId);
      const secretKey = String(rtcConfig.secretKey || "").trim();

      if (!Number.isFinite(sdkAppId) || sdkAppId <= 0) {
        throw new HttpsError(
          "failed-precondition",
          "Tencent RTC has an invalid SDK app ID.",
        );
      }

      if (!secretKey || secretKey === "<TO_BE_FILLED_MANUALLY>") {
        throw new HttpsError(
          "failed-precondition",
          "Tencent RTC secret key is missing.",
        );
      }

      const signer = new Api(sdkAppId, secretKey);
      const userSig = signer.genUserSig(userId, USER_SIG_TTL_SECONDS);

      return {
        sdkAppId,
        userId,
        userSig,
        expiresIn: USER_SIG_TTL_SECONDS,
      };
    } catch (error) {
      if (error instanceof HttpsError) {
        throw error;
      }

      console.error("Tencent UserSig generation failed:", error);
      throw new HttpsError("internal", "Failed to generate Tencent UserSig.");
    }
  },
);
