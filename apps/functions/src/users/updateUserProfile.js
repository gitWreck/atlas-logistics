"use strict";

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const { FieldValue } = require("firebase-admin/firestore");
const { toE164 } = require("../utilities/helpers");

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
      email, // ✅ Add this
      password, // ✅ New
      role,
      phoneNumber,
      warehouseCode,
      warehouseName,
      status,
      province,
      city,
      barangay,
      street,
    } = request.data;

    if (!uid) {
      throw new HttpsError("invalid-argument", "User UID is required.");
    }

    try {
      // 2. Prepare Auth Updates
      const authUpdates = {
        displayName: displayName,
        email: email, // ✅ Add this to update the login identifier
        disabled: status === "inactive",
      };

      // ✅ Only update password if provided and valid length
      if (password && password.length >= 6) {
        authUpdates.password = password;
      }

      await admin.auth().updateUser(uid, authUpdates);

      // 3. Update Custom Claims (Roles)
      if (role) {
        await admin.auth().setCustomUserClaims(uid, { role });
      }

      // 4. Prepare Firestore Document
      const updateData = {
        name: displayName,
        role: role,
        email: email, // ✅ Keep Firestore in sync with Auth
        phoneNumber: phoneNumber ? toE164(phoneNumber) : null,
        // ✅ Suggestion: If role is customer, clear warehouse data
        warehouseName: role === "customer" ? null : warehouseName || null,
        warehouseCode: role === "customer" ? null : warehouseCode || null,
        status: status,
        active: status === "active",
        updatedAt: FieldValue.serverTimestamp(),
      };

      if (role === "customer") {
        updateData.address = {
          province: province || null,
          city: city || null,
          barangay: barangay || null,
          street: street || null,
        };
      }

      await admin.firestore().collection("users").doc(uid).update(updateData);

      // 5. ✅ Suggestion: Dedicated Audit Log for Password/Security changes
      if (password) {
        await admin.firestore().collection("admin_logs").add({
          action: "ADMIN_PASSWORD_RESET",
          targetUid: uid,
          actorId: request.auth.uid,
          createdAt: FieldValue.serverTimestamp(),
          details: "Password manually updated by admin via dashboard.",
        });
      }

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
