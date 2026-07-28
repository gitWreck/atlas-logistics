"use strict";

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const { FieldValue } = admin.firestore;
const { normalizePhone } = require("../utilities/phoneHelpers");

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();
const auth = admin.auth();

exports.updateUserProfileMobile = onCall(
  { region: "asia-southeast1", maxInstances: 10 },
  async (req) => {
    if (!req.auth) throw new HttpsError("unauthenticated", "Auth required.");

    const uid = req.auth.uid;
    // ✅ Added phoneNumber to destructured data
    const {
      targetUid,
      name,
      email,
      password,
      address,
      phoneNumber,
      photoURL,
      status,
    } = req.data;

    if (!targetUid)
      throw new HttpsError("invalid-argument", "Target UID required.");

    const isSelf = uid === targetUid;
    const callerSnap = await db.collection("users").doc(uid).get();
    const callerData = callerSnap.data();
    const callerRole = String(callerData?.role || "").toLowerCase();
    const isAdmin = ["admin", "administrator"].includes(callerRole);

    // Get Target User Data to check role
    const targetSnap = await db.collection("users").doc(targetUid).get();
    if (!targetSnap.exists)
      throw new HttpsError("not-found", "User not found.");
    const targetData = targetSnap.data();
    const targetRole = String(targetData.role || "").toLowerCase();

    // Manager role cannot edit customer profiles. Only the user themselves or admins may update.
    if (!isSelf && !isAdmin) {
      throw new HttpsError(
        "permission-denied",
        "You cannot update this profile.",
      );
    }

    const authUpdates = {};
    const firestoreUpdates = { updatedAt: FieldValue.serverTimestamp() };

    if (photoURL !== undefined) {
      const normalizedPhotoURL = String(photoURL || "").trim();
      if (normalizedPhotoURL && !/^https:\/\//i.test(normalizedPhotoURL)) {
        throw new HttpsError("invalid-argument", "Profile photo URL must use HTTPS.");
      }
      authUpdates.photoURL = normalizedPhotoURL || null;
      firestoreUpdates.photoURL = normalizedPhotoURL || null;
    }

    if (email !== undefined) {
      const normalizedEmail = String(email || "").trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
        throw new HttpsError("invalid-argument", "A valid email is required.");
      }
      authUpdates.email = normalizedEmail;
      firestoreUpdates.email = normalizedEmail;
    }

    // 1. HANDLE NAME UPDATE (Staff names are locked for self-update, usually)
    if (name && name.trim().length > 0) {
      // Logic: Admins can change any name. Customers can change their own.
      // Staff (Checkers/Drivers) can usually only change password.
      if (isAdmin || targetRole === "customer") {
        authUpdates.displayName = name;
        firestoreUpdates.name = name;
      }
    }

    // 2. HANDLE PHONE & ADDRESS (Only for Customers or by Admins)
    if (isAdmin || targetRole === "customer") {
      if (phoneNumber !== undefined) {
        const normalizedPhone = normalizePhone(phoneNumber);
        if (normalizedPhone && !/^63[89]\d{9}$/.test(normalizedPhone)) {
          throw new HttpsError(
            "invalid-argument",
            "Invalid Philippine mobile number.",
          );
        }
        firestoreUpdates.phoneNumber = normalizedPhone;
      }

      if (address && typeof address === "object") {
        firestoreUpdates.address = {
          unit: address.unit || "",
          street: address.street || "",
          barangay: address.barangay || "",
          city: address.city || "",
          province: address.province || "",
        };
      }
    }

    if (status !== undefined && isAdmin) {
      const normalizedStatus = String(status || "").trim().toLowerCase();
      if (!["active", "inactive"].includes(normalizedStatus)) {
        throw new HttpsError(
          "invalid-argument",
          "Status must be active or inactive.",
        );
      }
      authUpdates.disabled = normalizedStatus === "inactive";
      firestoreUpdates.status = normalizedStatus;
      firestoreUpdates.active = normalizedStatus === "active";
    }

    try {
      // 3. HANDLE PASSWORD UPDATE
      if (password && password.length >= 6) {
        authUpdates.password = password;
      }

      if (Object.keys(authUpdates).length > 0) {
        await auth.updateUser(targetUid, authUpdates);
      }

      // 4. UPDATE FIRESTORE
      await db.collection("users").doc(targetUid).update(firestoreUpdates);

      // 5. AUDIT LOGGING
      await db
        .collection("admin_logs")
        .doc()
        .set({
          action: "UPDATE_USER_PROFILE_MOBILE",
          targetUid,
          actorId: uid,
          timestamp: FieldValue.serverTimestamp(),
          fieldsChanged: Object.keys(firestoreUpdates).filter(
            (k) => k !== "updatedAt",
          ),
        });

      return { success: true, message: "Profile updated successfully." };
    } catch (error) {
      console.error("Update Error:", error);
      if (error instanceof HttpsError) throw error;
      if (error?.code === "auth/email-already-exists") {
        throw new HttpsError(
          "already-exists",
          "That email address is already in use.",
        );
      }
      throw new HttpsError("internal", error.message);
    }
  },
);
