const functions = require("firebase-functions");
const admin = require("firebase-admin");

exports.createUserProfile = functions.auth.user().onCreate(async (user) => {
  if (!user?.uid) return;

  const userRef = admin.firestore().collection("users").doc(user.uid);
  const doc = await userRef.get();

  // SAFETY CHECK: If the document already exists (because our createUser function made it),
  // DO NOT overwrite it. This preserves the "DRIVER" role we just set.
  if (doc.exists) {
    console.log(
      `User ${user.uid} already exists in Firestore. Skipping auto-creation.`
    );
    return;
  }

  // Otherwise, create standard default profile (for self-signups)
  await userRef.set(
    {
      uid: user.uid,
      email: user.email || "",
      name: user.displayName || "",
      role: "user", // Default role for public signups
      active: true,
      photoURL: user.photoURL || null,
      provider: user.providerData?.[0]?.providerId || "password",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
});
