"use strict";

const { defineSecret } = require("firebase-functions/params");

/**
 * Tencent RTC credentials are stored server-side in Firebase Secret Manager.
 * Paste the values manually after deployment:
 *   firebase functions:secrets:set TRTC_SDK_APP_ID
 *   firebase functions:secrets:set TRTC_SECRET_KEY
 *
 * Do not expose these values to the React Native client.
 */
const TRTC_SDK_APP_ID = defineSecret("TRTC_SDK_APP_ID");
const TRTC_SECRET_KEY = defineSecret("TRTC_SECRET_KEY");
const PLACEHOLDER_VALUE = "<TO_BE_FILLED_MANUALLY>";

function getRtcSecretConfig() {
  const sdkAppId = TRTC_SDK_APP_ID.value();
  const secretKey = TRTC_SECRET_KEY.value();

  return {
    sdkAppId: sdkAppId || PLACEHOLDER_VALUE,
    secretKey: secretKey || PLACEHOLDER_VALUE,
    isConfigured: Boolean(sdkAppId && secretKey),
  };
}

module.exports = {
  TRTC_SDK_APP_ID,
  TRTC_SECRET_KEY,
  PLACEHOLDER_VALUE,
  getRtcSecretConfig,
};
