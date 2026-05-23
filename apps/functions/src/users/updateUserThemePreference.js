"use strict";

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const { FieldValue } = require("firebase-admin/firestore");

if (!admin.apps.length) admin.initializeApp();

const db = admin.firestore();
const VALID_THEME_PREFERENCES = new Set(["light", "dark", "system"]);

exports.updateUserThemePreference = onCall(
  { region: "asia-southeast1", maxInstances: 10 },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Auth required.");
    }

    const themePreference = String(
      request.data?.themePreference || "",
    ).toLowerCase();

    if (!VALID_THEME_PREFERENCES.has(themePreference)) {
      throw new HttpsError("invalid-argument", "Invalid theme preference.");
    }

    const userRef = db.collection("users").doc(request.auth.uid);
    const userSnap = await userRef.get();

    if (!userSnap.exists) {
      throw new HttpsError("not-found", "User profile not found.");
    }

    await userRef.update({
      themePreference,
      updatedAt: FieldValue.serverTimestamp(),
    });

    return { success: true, themePreference };
  },
);
