const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");

if (admin.apps.length === 0) {
  admin.initializeApp();
}

exports.listUsers = onCall({ cors: true }, async () => {
  try {
    const authResult = await admin.auth().listUsers(1000);
    const db = admin.firestore();

    const profiles = await db.getAll(
      ...authResult.users.map((u) => db.doc(`users/${u.uid}`))
    );

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
    console.error(err);
    throw new HttpsError("internal", "Failed to list users");
  }
});
