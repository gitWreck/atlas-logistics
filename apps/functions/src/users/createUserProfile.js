const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const { FieldValue } = require("firebase-admin/firestore");
const { toE164 } = require("../utilities/helpers");

// Ensure app is initialized
if (admin.apps.length === 0) {
  admin.initializeApp();
}

exports.createUserProfile = onCall(
  { region: "asia-southeast1", maxInstances: 10 },
  async (request) => {
    // 1. Check Admin Permissions
    if (!request.auth || !request.auth.token.admin) {
      throw new HttpsError(
        "permission-denied",
        "Only admins can create users.",
      );
    }

    const {
      email,
      password,
      displayName,
      role,
      phoneNumber,
      warehouseCode,
      warehouseName,
      // Add address fields
      province,
      city,
      barangay,
      street,
    } = request.data;

    // 2. Validation
    if (!email || !password || !displayName) {
      throw new HttpsError("invalid-argument", "Missing required fields.");
    }

    try {
      // 3. Create Auth User
      const userProps = {
        email,
        password,
        displayName,
        disabled: false,
      };

      const userRecord = await admin.auth().createUser(userProps);

      // 4. Set Custom Claims (Role)
      await admin.auth().setCustomUserClaims(userRecord.uid, { role });

      // 5. Create Firestore Document
      const userData = {
        uid: userRecord.uid,
        email,
        name: displayName,
        role,
        phoneNumber: phoneNumber ? toE164(phoneNumber) : null,
        warehouseName: warehouseName || null,
        warehouseCode: warehouseCode || null,
        active: true,
        status: "active",
        provider: "password",
        createdAt: FieldValue.serverTimestamp(),
        lastAuthAt: null,
      };

      // Add nested address object only if the role is customer
      if (role === "customer") {
        userData.address = {
          province: province || null,
          city: city || null,
          barangay: barangay || null,
          street: street || null,
        };
      }

      await admin
        .firestore()
        .collection("users")
        .doc(userRecord.uid)
        .set(userData);

      return { success: true, uid: userRecord.uid };
    } catch (err) {
      console.error(err);

      if (err.code === "auth/email-already-exists") {
        throw new HttpsError("already-exists", "Email already in use.");
      }

      if (err.code === "auth/invalid-phone-number") {
        throw new HttpsError(
          "invalid-argument",
          "Invalid phone number format.",
        );
      }

      throw new HttpsError("internal", "Failed to create user.");
    }
  },
);
