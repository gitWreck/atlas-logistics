const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const { FieldValue } = require("firebase-admin/firestore");
const { toE164 } = require("./../utilities/helpers");

// Ensure app is initialized
if (admin.apps.length === 0) {
  admin.initializeApp();
}

exports.createUserProfile = onCall(
  { region: "asia-southeast1", maxInstances: 10 },
  async (request) => {
    // 1. Check Admin Permissions
    // Note: request.auth.token.admin must be set via Custom Claims beforehand
    if (!request.auth || !request.auth.token.admin) {
      throw new HttpsError(
        "permission-denied",
        "Only admins can create users."
      );
    }

    const { email, password, displayName, role, phoneNumber, warehouseId } =
      request.data;

    // 2. Validation
    if (!email || !password || !displayName) {
      throw new HttpsError("invalid-argument", "Missing required fields.");
    }

    try {
      // 3. Create Auth User (Fixing the null phone number issue)
      const userProps = {
        email,
        password,
        displayName,
        disabled: false,
      };

      // Only add phoneNumber property if it actually exists
      if (phoneNumber) {
        userProps.phoneNumber = toE164(phoneNumber);
      }

      const userRecord = await admin.auth().createUser(userProps);

      // 4. Set Custom Claims (Role)
      await admin.auth().setCustomUserClaims(userRecord.uid, { role });

      // 5. Create Firestore Document
      await admin
        .firestore()
        .collection("users")
        .doc(userRecord.uid)
        .set({
          uid: userRecord.uid,
          email,
          name: displayName,
          role,
          phoneNumber: phoneNumber ? toE164(phoneNumber) : null, // Allowed in Firestore
          warehouseId: warehouseId || null,
          active: true,
          status: "active",
          provider: "password",
          createdAt: FieldValue.serverTimestamp(),
          lastAuthAt: null,
        });

      return { success: true, uid: userRecord.uid };
    } catch (err) {
      console.error(err);

      // Handle "Email Already Exists" specifically
      if (err.code === "auth/email-already-exists") {
        throw new HttpsError("already-exists", "Email already in use.");
      }

      // Handle "Invalid Phone" specifically
      if (err.code === "auth/invalid-phone-number") {
        throw new HttpsError(
          "invalid-argument",
          "Invalid phone number format."
        );
      }

      throw new HttpsError("internal", "Failed to create user.");
    }
  }
);
