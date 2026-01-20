const functions = require("firebase-functions/v1");
const admin = require("firebase-admin");
const { FieldValue } = require("firebase-admin/firestore");

// Ensure Admin SDK is initialized
if (!admin.apps.length) admin.initializeApp();

const toggleUserAccount = functions
  .region("asia-southeast1")
  .https.onCall(async (data, context) => {
    // ✅ Only admins allowed
    // if (!context.auth?.token?.admin) {
    //   throw new functions.https.HttpsError(
    //     "permission-denied",
    //     "Only admins can modify user accounts."
    //   );
    // }

    const { uid, active } = data;

    if (typeof uid !== "string" || typeof active !== "boolean") {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "Must provide uid (string) and active (boolean)."
      );
    }

    try {
      // 1️⃣ Update Firebase Auth account
      await admin.auth().updateUser(uid, { disabled: !active });

      // 2️⃣ Update Firestore user profile
      await admin
        .firestore()
        .collection("users")
        .doc(uid)
        .set(
          {
            active: active,
            disabledAt: active ? null : FieldValue.serverTimestamp(),
          },
          { merge: true }
        );

      return { success: true, uid, active };
    } catch (error) {
      console.error("Error toggling user account:", error);
      throw new functions.https.HttpsError(
        "internal",
        "Unable to toggle user account",
        error
      );
    }
  });

module.exports = toggleUserAccount;

// const functions = require("firebase-functions/v1");
// const admin = require("firebase-admin");

// // admin.initializeApp();
// const cleanupUserProfile = functions
//   .region("us-central1")
//   .https.onCall(async (data, context) => {
//     if (!context.auth?.token?.admin) {
//       throw new functions.https.HttpsError(
//         "permission-denied",
//         "Only admins can clean up user profiles."
//       );
//     }

//     const { uid } = data;
//     await admin.firestore().collection("users").doc(uid).set(
//       {
//         deleted: true,
//         deletedAt: admin.firestore.FieldValue.serverTimestamp(),
//       },
//       { merge: true }
//     );
//   });

// module.exports = cleanupUserProfile;
