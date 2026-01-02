"use strict";

const { HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");

if (!admin.apps.length) {
  admin.initializeApp();
}

const ALLOWED_ROLES = ["admin", "manager"];

async function assertAdminOrManager(request) {
  if (!request.auth?.uid) {
    throw new HttpsError("unauthenticated", "Login required");
  }

  const uid = request.auth.uid;
  const ref = admin.firestore().collection("users").doc(uid);
  const snap = await ref.get();

  if (!snap.exists) {
    throw new HttpsError("permission-denied", "User profile missing");
  }

  const user = snap.data();

  if (user.active !== true) {
    throw new HttpsError("permission-denied", "Account disabled");
  }

  if (!ALLOWED_ROLES.includes(user.role)) {
    throw new HttpsError(
      "permission-denied",
      "Admins or managers only"
    );
  }

  return {
    uid,
    role: user.role,
    user,
  };
}

module.exports = {
  assertAdminOrManager,
};
