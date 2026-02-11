"use strict";

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const { FieldValue } = require("firebase-admin/firestore");

// Initialize Admin SDK
if (!admin.apps.length) admin.initializeApp();

const db = admin.firestore();

/**
 * toggleUserStatus (Gen 2)
 * Region: asia-southeast1
 */
exports.toggleUserStatus = onCall(
  {
    region: "asia-southeast1",
    maxInstances: 10, // Optional: keeps costs down for low-traffic admin tasks
  },
  async (request) => {
    // 1. Check Auth & Admin Claim
    // In Gen 2, auth context is in request.auth
    if (!request.auth) {
      throw new HttpsError(
        "unauthenticated",
        "The function must be called while authenticated.",
      );
    }

    if (request.auth.token.admin !== true) {
      throw new HttpsError(
        "permission-denied",
        "Only admins can manage user status.",
      );
    }

    // 2. Validate Arguments
    const { uid, shouldDisable } = request.data;
    if (typeof uid !== "string" || typeof shouldDisable !== "boolean") {
      throw new HttpsError(
        "invalid-argument",
        "Must provide uid (string) and shouldDisable (boolean).",
      );
    }

    try {
      // 3. Toggle Auth Status (Firebase Authentication)
      await admin.auth().updateUser(uid, {
        disabled: shouldDisable,
      });

      // 4. Update Firestore Profile
      const userRef = db.collection("users").doc(uid);
      await userRef.update({
        active: !shouldDisable,
        status: shouldDisable ? "suspended" : "active",
        updatedAt: FieldValue.serverTimestamp(),
      });

      // 5. Create Audit Log
      const auditRef = db.collection("audit_logs").doc();
      await auditRef.set({
        action: shouldDisable ? "USER_DISABLED" : "USER_ACTIVATED",
        actorId: request.auth.uid,
        targetUserId: uid,
        timestamp: FieldValue.serverTimestamp(),
        details: {
          uid,
          shouldDisable,
        },
      });

      return {
        success: true,
        message: `User ${uid} has been ${shouldDisable ? "disabled" : "activated"}.`,
      };
    } catch (err) {
      console.error("Error in toggleUserStatus:", err);

      // If the error is already a Firebase HttpsError, re-throw it
      if (err instanceof HttpsError) throw err;

      // Otherwise, wrap in a generic internal error
      throw new HttpsError(
        "internal",
        err.message || "Failed to update user status.",
      );
    }
  },
);
