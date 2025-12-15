/*********************************************************
 * ATLAS TRACKING – CLOUD FUNCTIONS (PROD SAFE)
 * Node 18 – CommonJS – Firebase v2 + v1 Auth
 *********************************************************/

const functions = require("firebase-functions/v1");
const { onCall, onRequest, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");

admin.initializeApp();
const db = admin.firestore();

/* ======================================================
   🔐 ADMIN GUARD
====================================================== */
async function assertAdmin(request) {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Login required");
  }

  const uid = request.auth.uid;
  const snap = await db.collection("users").doc(uid).get();

  if (!snap.exists || snap.data().role !== "admin") {
    throw new HttpsError("permission-denied", "Admins only");
  }

  return uid;
}

/* ======================================================
   AUTH → USER PROFILE CREATION (v1 – SAFE)
====================================================== */
exports.createUserProfile = functions
  .region("asia-southeast1")
  .auth.user()
  .onCreate(async (user) => {
    const uid = user.uid;

    await db.collection("users").doc(uid).set({
      uid,
      email: user.email || "",
      name: user.displayName || "",
      photoURL: user.photoURL || "",
      role: "user",
      active: true,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  });

/* ======================================================
   ADMIN: SET USER ROLE (CALLABLE)
====================================================== */
exports.adminSetUserRole = onCall(
  { region: "asia-southeast1" },
  async (request) => {
    const adminUid = await assertAdmin(request);
    const { userId, role } = request.data;

    if (!userId || !["user", "admin"].includes(role)) {
      throw new HttpsError("invalid-argument", "Invalid payload");
    }

    if (userId === adminUid) {
      throw new HttpsError("failed-precondition", "Cannot change own role");
    }

    await db.collection("users").doc(userId).update({
      role,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    await db.collection("admin_logs").add({
      action: "SET_ROLE",
      targetUser: userId,
      role,
      by: adminUid,
      at: admin.firestore.FieldValue.serverTimestamp(),
    });

    return { success: true };
  }
);

/* ======================================================
   ADMIN: ACTIVATE / DEACTIVATE USER (CALLABLE)
====================================================== */
exports.adminSetUserActive = onCall(
  { region: "asia-southeast1" },
  async (request) => {
    const adminUid = await assertAdmin(request);
    const { userId, active } = request.data;

    if (!userId || typeof active !== "boolean") {
      throw new HttpsError("invalid-argument", "Invalid payload");
    }

    if (userId === adminUid) {
      throw new HttpsError("failed-precondition", "Cannot modify own account");
    }

    await db.collection("users").doc(userId).update({
      active,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    await db.collection("admin_logs").add({
      action: active ? "ACTIVATE_USER" : "DEACTIVATE_USER",
      targetUser: userId,
      by: adminUid,
      at: admin.firestore.FieldValue.serverTimestamp(),
    });

    return { success: true };
  }
);

/* ======================================================
   PUBLIC TRACKING API (HTTP – SAFE)
====================================================== */
exports.trackShipment = onRequest(
  { cors: true, region: "asia-southeast1" },
  async (req, res) => {
    const tracking = String(req.query.tracking || "").trim();
    if (!tracking) {
      return res.status(400).json({ error: "Missing tracking number" });
    }

    const snap = await db
      .collection("tracking_records")
      .doc(tracking)
      .get();

    if (!snap.exists) {
      return res.status(404).json({ error: "Not found" });
    }

    return res.json({ success: true, data: snap.data() });
  }
);
