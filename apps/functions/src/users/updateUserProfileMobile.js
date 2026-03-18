"use strict";

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const { FieldValue } = admin.firestore;
const { toE164 } = require("../utilities/helpers"); // ✅ Added helper for phone formatting

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();
const auth = admin.auth();

exports.updateUserProfileMobile = onCall(
  { region: "asia-southeast1", maxInstances: 10 },
  async (req) => {
    if (!req.auth) throw new HttpsError("unauthenticated", "Auth required.");

    const uid = req.auth.uid;
    // ✅ Added phoneNumber to destructured data
    const { targetUid, name, password, address, phoneNumber } = req.data;

    if (!targetUid)
      throw new HttpsError("invalid-argument", "Target UID required.");

    const isSelf = uid === targetUid;
    const callerSnap = await db.collection("users").doc(uid).get();
    const callerData = callerSnap.data();
    const isAdmin = ["admin", "manager"].includes(callerData?.role);

    if (!isSelf && !isAdmin) {
      throw new HttpsError(
        "permission-denied",
        "You cannot update this profile.",
      );
    }

    // Get Target User Data to check role
    const targetSnap = await db.collection("users").doc(targetUid).get();
    if (!targetSnap.exists)
      throw new HttpsError("not-found", "User not found.");
    const targetData = targetSnap.data();

    const authUpdates = {};
    const firestoreUpdates = { updatedAt: FieldValue.serverTimestamp() };

    // 1. HANDLE NAME UPDATE (Staff names are locked for self-update, usually)
    if (name && name.trim().length > 0) {
      // Logic: Admins can change any name. Customers can change their own.
      // Staff (Checkers/Drivers) can usually only change password.
      if (isAdmin || targetData.role === "customer") {
        authUpdates.displayName = name;
        firestoreUpdates.name = name;
      }
    }

    // 2. HANDLE PHONE & ADDRESS (Only for Customers or by Admins)
    if (isAdmin || targetData.role === "customer") {
      if (phoneNumber) {
        firestoreUpdates.phoneNumber = toE164(phoneNumber);
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
      throw new HttpsError("internal", error.message);
    }
  },
);
