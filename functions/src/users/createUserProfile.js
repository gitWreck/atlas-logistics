const functions = require("firebase-functions/v1");
const admin = require("firebase-admin");
const { FieldValue } = require("firebase-admin/firestore");

const createUserProfile = functions
  .region("us-central1")
  .https.onCall(async (data, context) => {
    // if (!context.auth?.token?.admin) {
    //   throw new functions.https.HttpsError(
    //     "permission-denied",
    //     "Only admins can create users."
    //   );
    // }

    const { email, password, displayName, role } = data;

    if (!email || !password || !displayName) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "Missing required fields."
      );
    }

    try {
      const userRecord = await admin.auth().createUser({
        email,
        password,
        displayName,
      });

      await admin.auth().setCustomUserClaims(userRecord.uid, { role });

      await admin.firestore().collection("users").doc(userRecord.uid).set({
        uid: userRecord.uid,
        email,
        name: displayName,
        role,
        // active: true,
        provider: "password",
        createdAt: FieldValue.serverTimestamp(),
        lastAuthAt: FieldValue.serverTimestamp(),
      });

      return { success: true, uid: userRecord.uid };
    } catch (err) {
      console.error(err);

      if (err.code === "auth/email-already-exists") {
        throw new functions.https.HttpsError(
          "already-exists",
          "Email already in use."
        );
      }

      throw new functions.https.HttpsError(
        "internal",
        "Failed to create user."
      );
    }
  });

module.exports = createUserProfile;
