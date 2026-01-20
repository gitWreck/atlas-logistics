const functions = require("firebase-functions/v1");
const admin = require("firebase-admin");
const { FieldValue } = require("firebase-admin/firestore");

// Ensure Admin SDK is initialized
if (!admin.apps.length) admin.initializeApp();

const toggleUserStatus = functions
  .region("asia-southeast1")
  .https.onCall(async (data, context) => {
    if (!context.auth?.token?.admin) {
      throw new functions.https.HttpsError(
        "permission-denied",
        "Only admins can manage user status."
      );
    }

    const { uid, shouldDisable } = data; // Expecting { uid: "...", shouldDisable: true/false }
    if (typeof uid !== "string" || typeof shouldDisable !== "boolean") {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "Must provide uid (string) and shouldDisable (boolean)."
      );
    }

    try {
      // 2. Toggle Auth Status (Stops them from logging in)
      await admin.auth().updateUser(uid, {
        disabled: shouldDisable,
      });

      // 3. Toggle Firestore Status (Updates your Dashboard UI)
      await admin
        .firestore()
        .collection("users")
        .doc(uid)
        .update({
          active: !shouldDisable, // if disabling, active = false
          status: shouldDisable ? "suspended" : "active",
        });

      // 4. Create Audit Log
      await admin
        .firestore()
        .collection("audit_logs")
        .add({
          action: shouldDisable ? "USER_DISABLED" : "USER_ACTIVATED",
          actorId: context.auth.uid,
          targetUserId: uid,
          timestamp: FieldValue.serverTimestamp(),
        });

      return { success: true };
    } catch (err) {
      console.error(err);
      throw new functions.https.HttpsError(
        "internal",
        "Failed to update user status."
      );
    }
  });

module.exports = toggleUserStatus;
