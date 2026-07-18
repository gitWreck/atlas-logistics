// Usage:
// FIREBASE_SERVICE_ACCOUNT_KEY='{"type":"..."}' node scripts/createDriverUser.js user@example.com P4ssw0rd "Driver Name"
// or set GOOGLE_APPLICATION_CREDENTIALS=/path/to/key.json

const admin = require("firebase-admin");

async function main() {
  const [,, email, password, displayName] = process.argv;

  if (!email || !password || !displayName) {
    console.error("Usage: node scripts/createDriverUser.js <email> <password> <displayName>");
    process.exit(2);
  }

  // Init admin SDK
  if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    const key = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
    admin.initializeApp({ credential: admin.credential.cert(key) });
  } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    admin.initializeApp();
  } else {
    console.error("FIREBASE_SERVICE_ACCOUNT_KEY or GOOGLE_APPLICATION_CREDENTIALS must be set.");
    process.exit(2);
  }

  const auth = admin.auth();
  const db = admin.firestore();

  try {
    const userRecord = await auth.createUser({
      email,
      password,
      displayName,
      disabled: false,
    });

    console.log("Created auth user:", userRecord.uid);

    // Set custom claim role=driver
    await auth.setCustomUserClaims(userRecord.uid, { role: "driver" });
    console.log("Set custom claims: role=driver");

    // Create Firestore profile
    const publicId = `DRV-${Date.now()}`;
    const profile = {
      uid: userRecord.uid,
      email,
      name: displayName,
      role: "driver",
      active: true,
      status: "active",
      provider: "password",
      publicId,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      lastAuthAt: null,
    };

    await db.collection("users").doc(userRecord.uid).set(profile);
    console.log("Created Firestore profile for driver, publicId:", publicId);

    console.log("Driver user created successfully. You can now sign in at http://localhost:8081 via the mobile app login.");
    process.exit(0);
  } catch (err) {
    console.error("Failed to create driver user:", err);
    process.exit(1);
  }
}

main();
