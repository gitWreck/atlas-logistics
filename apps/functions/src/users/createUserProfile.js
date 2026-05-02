const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const { FieldValue } = require("firebase-admin/firestore");
const { toE164 } = require("../utilities/helpers");

// Ensure app is initialized
if (admin.apps.length === 0) {
  admin.initializeApp();
}

const PUBLIC_ID_TIME_ZONE = "Asia/Manila";

function getRoleCodeField(role) {
  return role === "driver" ? "driverCode" : "userCode";
}

function getPublicIdPeriod(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: PUBLIC_ID_TIME_ZONE,
    month: "2-digit",
    year: "numeric",
  }).formatToParts(date);
  const month = parts.find((part) => part.type === "month")?.value || "01";
  const year = parts.find((part) => part.type === "year")?.value || "2000";
  const prefix = `1${month}${year.slice(-1)}`;

  return {
    prefix,
    base: Number(`${prefix}00000`),
    counterDocId: `publicUserIds_${prefix}`,
  };
}

async function allocatePublicUserId(db, tx) {
  const { prefix, base, counterDocId } = getPublicIdPeriod();
  const counterRef = db.collection("system_counters").doc(counterDocId);
  const counterSnap = await tx.get(counterRef);
  const current = counterSnap.exists
    ? Number(counterSnap.data()?.last || base - 1)
    : base - 1;
  const next = Math.max(current + 1, base);

  tx.set(
    counterRef,
    {
      prefix,
      base,
      last: next,
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );

  return String(next);
}

async function generatePublicUserId(db) {
  return db.runTransaction((tx) => allocatePublicUserId(db, tx));
}

async function assignMissingPublicUserId(uid, role) {
  const db = admin.firestore();
  const userRef = db.collection("users").doc(uid);

  return db.runTransaction(async (tx) => {
    const userSnap = await tx.get(userRef);

    if (!userSnap.exists) {
      throw new HttpsError("not-found", "User profile not found.");
    }

    const userData = userSnap.data() || {};
    if (userData.publicId) {
      const codeField = getRoleCodeField(userData.role || role);
      if (!userData[codeField]) {
        tx.set(
          userRef,
          {
            [codeField]: userData.publicId,
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true },
        );
      }

      return {
        publicId: userData.publicId,
        codeField,
        created: false,
      };
    }

    const publicId = await allocatePublicUserId(db, tx);
    const resolvedRole = userData.role || role || "customer";
    const codeField = getRoleCodeField(resolvedRole);

    tx.set(
      userRef,
      {
        publicId,
        [codeField]: publicId,
        publicIdGeneratedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );

    return { publicId, codeField, created: true };
  });
}

exports.createUserProfile = onCall(
  { region: "asia-southeast1", maxInstances: 10 },
  async (request) => {
    // 1. Check Admin Permissions
    if (!request.auth || !request.auth.token.admin) {
      throw new HttpsError(
        "permission-denied",
        "Only admins can create users.",
      );
    }

    const {
      email,
      password,
      displayName,
      role,
      phoneNumber,
      warehouseCode,
      warehouseName,
      // Add address fields
      province,
      city,
      barangay,
      street,
    } = request.data;

    // 2. Validation
    const normalizedRole = (role || "").toString().toLowerCase();
    const allowedRoles = ["driver", "checker", "manager", "admin", "customer"];

    if (!email || !password || !displayName) {
      throw new HttpsError("invalid-argument", "Missing required fields.");
    }

    if (!allowedRoles.includes(normalizedRole)) {
      throw new HttpsError("invalid-argument", "Invalid user role.");
    }

    try {
      const db = admin.firestore();

      // 3. Create Auth User
      const userProps = {
        email,
        password,
        displayName,
        disabled: false,
      };

      const userRecord = await admin.auth().createUser(userProps);
      const publicId = await generatePublicUserId(db);
      const codeField = getRoleCodeField(normalizedRole);

      // 4. Set Custom Claims (Role)
      await admin.auth().setCustomUserClaims(userRecord.uid, {
        role: normalizedRole,
      });

      // 5. Create Firestore Document
      const userData = {
        uid: userRecord.uid,
        publicId,
        [codeField]: publicId,
        email,
        name: displayName,
        role: normalizedRole,
        phoneNumber: phoneNumber ? toE164(phoneNumber) : null,
        warehouseName: warehouseName || null,
        warehouseCode: warehouseCode || null,
        active: true,
        status: "active",
        provider: "password",
        createdAt: FieldValue.serverTimestamp(),
        publicIdGeneratedAt: FieldValue.serverTimestamp(),
        lastAuthAt: null,
      };

      // Add nested address object only if the role is customer
      if (normalizedRole === "customer") {
        userData.address = {
          province: province || null,
          city: city || null,
          barangay: barangay || null,
          street: street || null,
        };
      }

      await db.collection("users").doc(userRecord.uid).set(userData);

      return { success: true, uid: userRecord.uid, publicId, codeField };
    } catch (err) {
      console.error(err);

      if (err.code === "auth/email-already-exists") {
        throw new HttpsError("already-exists", "Email already in use.");
      }

      if (err.code === "auth/invalid-phone-number") {
        throw new HttpsError(
          "invalid-argument",
          "Invalid phone number format.",
        );
      }

      throw new HttpsError("internal", "Failed to create user.");
    }
  },
);

exports.ensureUserPublicId = onCall(
  { region: "asia-southeast1", maxInstances: 10 },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Login required.");
    }

    return assignMissingPublicUserId(
      request.auth.uid,
      request.auth.token.role,
    );
  },
);
