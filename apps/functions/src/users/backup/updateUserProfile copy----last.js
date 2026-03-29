const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const { FieldValue } = require("firebase-admin/firestore");
const { toE164 } = require("../../utilities/helpers");

// Ensure app is initialized
if (admin.apps.length === 0) {
  admin.initializeApp();
}

exports.updateUserProfile = onCall(
  { region: "asia-southeast1", maxInstances: 10 },
  async (request) => {
    // 1. Check Admin Permissions
    if (!request.auth || !request.auth.token.admin) {
      throw new HttpsError(
        "permission-denied",
        "Only admins can update users.",
      );
    }

    const {
      uid,
      displayName,
      role,
      phoneNumber,
      warehouseCode,
      warehouseName,
      status,
      // Destructure address fields
      province,
      city,
      barangay,
      street,
    } = request.data;

    if (!uid) {
      throw new HttpsError("invalid-argument", "User UID is required.");
    }

    try {
      // 2. Update Firebase Auth
      await admin.auth().updateUser(uid, {
        displayName: displayName,
        disabled: status === "inactive",
      });

      // 3. Update Custom Claims (Roles)
      if (role) {
        await admin.auth().setCustomUserClaims(uid, { role });
      }

      // 4. Update Firestore Document
      const updateData = {
        name: displayName,
        role: role,
        phoneNumber: phoneNumber ? toE164(phoneNumber) : null,
        warehouseName: warehouseName || null,
        warehouseCode: warehouseCode || null,
        status: status,
        active: status === "active",
        updatedAt: FieldValue.serverTimestamp(),
      };

      // Only include the nested address object if the user is a customer
      if (role === "customer") {
        updateData.address = {
          province: province || null,
          city: city || null,
          barangay: barangay || null,
          street: street || null,
        };
      }

      await admin.firestore().collection("users").doc(uid).update(updateData);

      return { success: true };
    } catch (err) {
      console.error("Update Error:", err);
      if (err.code === "auth/user-not-found") {
        throw new HttpsError("not-found", "User does not exist.");
      }
      throw new HttpsError("internal", "Failed to update user profile.");
    }
  },
);
