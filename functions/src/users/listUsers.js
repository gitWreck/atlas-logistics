// ✅ Change import to the standard v1 sdk
const functions = require("firebase-functions/v1");
const admin = require("firebase-admin");

// Safe init
if (admin.apps.length === 0) {
  admin.initializeApp();
}

// ✅ Gen 1 Syntax: .region(...).https.onCall((data, context) => {})
exports.listUsers = functions
  .region("asia-southeast1")
  .https.onCall(async (data, context) => {
    // Optional: Block unauthenticated users immediately
    if (!context.auth) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "User must be logged in."
      );
    }

    try {
      const authResult = await admin.auth().listUsers(1000);
      const db = admin.firestore();

      // Fetch all user profiles in parallel
      const profiles = await db.getAll(
        ...authResult.users.map((u) => db.doc(`users/${u.uid}`))
      );

      // Merge Auth Data + Firestore Data
      return authResult.users.map((user, i) => {
        const profile = profiles[i].exists ? profiles[i].data() : {};

        return {
          uid: user.uid,
          email: user.email,
          name: profile.name || user.displayName || "No Name",
          role: profile.role || user.customClaims?.role || "USER",

          // 🔐 Auth truth
          authDisabled: user.disabled,

          // 📄 App state
          active: profile.active ?? true,
          disabledAt: profile.disabledAt || null,
          lastAuthAt: profile.lastAuthAt || null,

          provider: profile.provider || user.providerData[0]?.providerId,
          photoURL: profile.photoURL || user.photoURL,
          createdAt: profile.createdAt || user.metadata.creationTime,
        };
      });
    } catch (err) {
      console.error("listUsers Error:", err);
      // Gen 1 Error syntax is slightly different (functions.https.HttpsError)
      throw new functions.https.HttpsError("internal", "Failed to list users");
    }
  });
