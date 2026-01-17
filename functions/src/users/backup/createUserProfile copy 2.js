const functions = require("firebase-functions/v1");
const admin = require("firebase-admin");
const { toE164, toLocal } = require("../../utilities/phoneUtilities");
const { FieldValue } = require("firebase-admin/firestore");

const createUserProfile = functions
  .region("asia-southeast1")
  .https.onCall(async (data, context) => {
    if (!context.auth?.token?.admin) {
      throw new functions.https.HttpsError(
        "permission-denied",
        "Only admins can create users."
      );
    }

    const { email, password, displayName, role, phoneNumber, warehouseId } =
      data;

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
        phoneNumber: phoneNumber ? toE164(phoneNumber) : null,
        disabled: false,
      });

      await admin.auth().setCustomUserClaims(userRecord.uid, { role });

      await admin
        .firestore()
        .collection("users")
        .doc(userRecord.uid)
        .set({
          uid: userRecord.uid,
          email,
          name: displayName,
          role,
          phoneNumber: phoneNumber ? toE164(phoneNumber) : null,
          warehouseId: warehouseId || null, // <--- NEW: Link to warehouse
          active: true, // <--- NEW: Default to active
          status: "active", // <--- NEW: String status for easy filtering
          provider: "password",
          createdAt: FieldValue.serverTimestamp(),
          lastAuthAt: null,
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
