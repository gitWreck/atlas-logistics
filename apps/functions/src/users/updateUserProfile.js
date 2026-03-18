"use strict";

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const { FieldValue } = require("firebase-admin/firestore");
const { toE164 } = require("../utilities/helpers");

if (admin.apps.length === 0) admin.initializeApp();
const db = admin.firestore();

exports.updateUserProfile = onCall(
  { region: "asia-southeast1", maxInstances: 10 },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Auth required.");

    const callerUid = request.auth.uid;
    const isAdmin = !!request.auth.token.admin;
    
    const {
      uid, // The user being updated
      displayName,
      password, // ✅ NEW: Password update
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
      unit, // ✅ Added unit
    } = request.data;

    if (!uid) throw new HttpsError("invalid-argument", "User UID is required.");

    // 🔒 SECURITY: Only admins can update others. Regular users can only update themselves.
    if (!isAdmin && callerUid !== uid) {
      throw new HttpsError("permission-denied", "You can only update your own profile.");
    }

    try {
      // 1. Prepare Auth Updates
      const authUpdates = {};
      if (displayName) authUpdates.displayName = displayName;
      if (status) authUpdates.disabled = status === "inactive";
      if (password && password.length >= 6) authUpdates.password = password; // ✅ Handle Password

      // 2. Update Firebase Auth
      if (Object.keys(authUpdates).length > 0) {
        await admin.auth().updateUser(uid, authUpdates);
      }

      // 3. Update Custom Claims (RESTRICTED TO ADMINS)
      if (role && isAdmin) {
        await admin.auth().setCustomUserClaims(uid, { role });
      }

      // 4. Prepare Firestore Document
      const updateData = {
        updatedAt: FieldValue.serverTimestamp(),
      };

      if (displayName) updateData.name = displayName;
      if (phoneNumber) updateData.phoneNumber = toE164(phoneNumber);
      
      // Admin-only fields
      if (isAdmin) {
        if (role) updateData.role = role;
        if (warehouseName) updateData.warehouseName = warehouseName;
        if (warehouseCode) updateData.warehouseCode = warehouseCode;
        if (status) {
          updateData.status = status;
          updateData.active = status === "active";
        }
      }

      // 5. Handle Address (Nested Object)
      // Allow update if admin OR if caller is a customer updating themselves
      if (province || city || barangay || street || unit) {
        updateData.address = {
          province: province || null,
          city: city || null,
          barangay: barangay || null,
          street: street || null,
          unit: unit || null,
        };
      }

      await db.collection("users").doc(uid).update(updateData);

      // 6. Optional: Audit Log for Password/Name changes
      await db.collection("admin_logs").doc().set({
        action: "PROFILE_UPDATE",
        targetUid: uid,
        actorId: callerUid,
        timestamp: FieldValue.serverTimestamp(),
        isSelfUpdate: callerUid === uid
      });

      return { success: true };
    } catch (err) {
      console.error("Update Error:", err);
      throw new HttpsError("internal", err.message || "Failed to update profile.");
    }
  }
);