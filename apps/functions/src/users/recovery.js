"use strict";

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const admin = require("firebase-admin");
const crypto = require("crypto");
const nodemailer = require("nodemailer");

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

// Secrets
const SEMAPHORE_API_KEY = defineSecret("SEMAPHORE_API_KEY");
const SEMAPHORE_SENDER_NAME = defineSecret("SEMAPHORE_SENDER_NAME");
// const SMTP_EMAIL = defineSecret("SMTP_EMAIL"); // e.g., your generic support@atlas.com
// const SMTP_PASSWORD = defineSecret("SMTP_PASSWORD"); // App password for your email

// --- HELPER: Secure Hashing ---
const hashOTP = (otp) => crypto.createHash("sha256").update(otp).digest("hex");

/* ======================================================
   1. REQUEST RECOVERY OTP
====================================================== */
exports.requestRecoveryOTP = onCall(
  {
    region: "asia-southeast1",
    maxInstances: 10,
    secrets: [
      SEMAPHORE_API_KEY,
      SEMAPHORE_SENDER_NAME,
      //   SMTP_EMAIL,
      //   SMTP_PASSWORD,
    ],
  },
  async (req) => {
    const { deliveryMethod, target } = req.data || {};

    if (!deliveryMethod || !target) {
      throw new HttpsError(
        "invalid-argument",
        "Delivery method and target required.",
      );
    }

    // 1. Find the User
    let userQuery;
    if (deliveryMethod === "email") {
      userQuery = db
        .collection("users")
        .where("email", "==", target.trim().toLowerCase());
    } else if (deliveryMethod === "phone") {
      // Assuming phone comes in normalized (e.g., 639XXXXXXXXX)
      userQuery = db
        .collection("users")
        .where("phoneNumber", "==", target.trim());
    } else {
      throw new HttpsError("invalid-argument", "Invalid delivery method.");
    }

    const userSnap = await userQuery.limit(1).get();

    // Security Best Practice: Don't reveal if a user exists or not to prevent enumeration attacks.
    // However, for mobile apps, it's often better UX to tell them. We'll tell them here.
    if (userSnap.empty) {
      throw new HttpsError(
        "not-found",
        "No account found with this information.",
      );
    }

    const userDoc = userSnap.docs[0];
    const uid = userDoc.id;
    const userData = userDoc.data();

    // 2. Generate a cryptographically secure 6-digit OTP
    const rawOTP = crypto.randomInt(100000, 999999).toString();
    const hashedOTP = hashOTP(rawOTP);

    // 3. Save to Firestore with Expiration (10 mins)
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes from now

    await db.collection("recovery_otps").doc(uid).set({
      hashedOTP: hashedOTP,
      expiresAt: expiresAt,
      attempts: 0,
      target: target,
      deliveryMethod: deliveryMethod,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // 4. Send the OTP
    const messageText = `Your Atlas Transport recovery code is ${rawOTP}. It expires in 10 minutes. Do not share this code with anyone.`;

    if (deliveryMethod === "phone") {
      // 📱 Send via Semaphore
      try {
        const response = await fetch(
          "https://api.semaphore.co/api/v4/messages",
          {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
              apikey: SEMAPHORE_API_KEY.value(),
              number: target,
              message: messageText,
              sendername: SEMAPHORE_SENDER_NAME.value() || "ATLAS RECOVERY",
            }),
          },
        );
        if (!response.ok) throw new Error("Semaphore API failed");
      } catch (err) {
        console.error("SMS Failed:", err);
        throw new HttpsError("internal", "Failed to send SMS.");
      }
    } else if (deliveryMethod === "email") {
      // 📧 Send via Nodemailer
      try {
        const transporter = nodemailer.createTransport({
          service: "gmail", // Or your provider (SendGrid, Outlook, etc.)
          auth: {
            // user: SMTP_EMAIL.value(),
            // pass: SMTP_PASSWORD.value(),
          },
        });

        await transporter.sendMail({
          //   from: `"Atlas Transport" <${SMTP_EMAIL.value()}>`,
          to: target,
          subject: "Your Password Recovery Code",
          text: messageText,
          html: `<p>Your Atlas Transport recovery code is <strong>${rawOTP}</strong>.</p><p>It expires in 10 minutes. Do not share this code with anyone.</p>`,
        });
      } catch (err) {
        console.error("Email Failed:", err);
        throw new HttpsError("internal", "Failed to send email.");
      }
    }

    return { success: true };
  },
);

/* ======================================================
   2. VERIFY OTP & RESET PASSWORD
====================================================== */
exports.verifyRecoveryOTP = onCall(
  { region: "asia-southeast1", maxInstances: 10 },
  async (req) => {
    const { target, otp, newPassword } = req.data || {};

    if (!target || !otp || !newPassword) {
      throw new HttpsError("invalid-argument", "Missing required fields.");
    }

    if (newPassword.length < 6) {
      throw new HttpsError(
        "invalid-argument",
        "Password must be at least 6 characters.",
      );
    }

    // 1. Find the OTP record by the target (email or phone)
    const otpQuery = await db
      .collection("recovery_otps")
      .where("target", "==", target)
      .limit(1)
      .get();

    if (otpQuery.empty) {
      throw new HttpsError("not-found", "No pending recovery request found.");
    }

    const otpDoc = otpQuery.docs[0];
    const otpData = otpDoc.data();
    const uid = otpDoc.id;

    // 2. Check Expiration
    if (otpData.expiresAt.toDate() < new Date()) {
      await otpDoc.ref.delete(); // Cleanup
      throw new HttpsError(
        "failed-precondition",
        "This code has expired. Please request a new one.",
      );
    }

    // 3. Brute Force Protection (Max 3 attempts)
    if (otpData.attempts >= 3) {
      await otpDoc.ref.delete(); // Lock them out of this OTP
      throw new HttpsError(
        "permission-denied",
        "Too many failed attempts. Request a new code.",
      );
    }

    // 4. Verify the Hash
    const hashedInput = hashOTP(otp.trim());
    if (hashedInput !== otpData.hashedOTP) {
      await otpDoc.ref.update({
        attempts: admin.firestore.FieldValue.increment(1),
      });
      throw new HttpsError("invalid-argument", "Incorrect code.");
    }

    // 5. Success! Update the Password in Firebase Auth
    try {
      await admin.auth().updateUser(uid, {
        password: newPassword,
      });

      // 6. Cleanup & Audit Log
      await db.runTransaction(async (tx) => {
        tx.delete(otpDoc.ref); // Delete the used OTP

        tx.set(db.collection("audit_logs").doc(), {
          action: "PASSWORD_RECOVERED",
          targetId: uid,
          targetCollection: "users",
          at: admin.firestore.FieldValue.serverTimestamp(),
          by: "SYSTEM",
          note: `User recovered password via ${otpData.deliveryMethod}.`,
        });
      });

      return { success: true };
    } catch (error) {
      console.error("Auth Update Failed:", error);
      throw new HttpsError("internal", "Failed to update password.");
    }
  },
);
