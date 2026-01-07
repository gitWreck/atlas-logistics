const functions = require("firebase-functions");
const admin = require("firebase-admin");

// This function allows an Admin to create a new user with a specific role/password
exports.createUser = functions.https.onCall(async (data, context) => {
  // 1. SECURITY: Ensure the requester is an Admin
  // (We check if the user calling this function has the 'ADMIN' role in Firestore)
  if (!context.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "You must be logged in."
    );
  }

  const requesterUid = context.auth.uid;
  const requesterSnap = await admin
    .firestore()
    .collection("users")
    .doc(requesterUid)
    .get();
  const requesterRole = requesterSnap.data()?.role;

  if (requesterRole !== "ADMIN") {
    throw new functions.https.HttpsError(
      "permission-denied",
      "Only Admins can create new users."
    );
  }

  // 2. Extract Data from the Modal
  const { email, password, displayName, role } = data;

  if (!email || !password || !displayName) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "Missing required fields."
    );
  }

  try {
    // 3. Create the Authentication Record
    const userRecord = await admin.auth().createUser({
      email: email,
      password: password,
      displayName: displayName,
    });

    // 4. Create the Firestore Profile (Authoritative Write)
    // We write this immediately to ensure the correct ROLE is set.
    await admin
      .firestore()
      .collection("users")
      .doc(userRecord.uid)
      .set({
        uid: userRecord.uid,
        email: email,
        name: displayName,
        role: role || "user", // Default to 'user' if role is missing
        active: true,
        provider: "password",
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        createdBy: requesterUid, // Audit trail: who created this user?
      });

    return { success: true, uid: userRecord.uid };
  } catch (error) {
    console.error("Error creating user:", error);
    throw new functions.https.HttpsError("internal", error.message);
  }
});
