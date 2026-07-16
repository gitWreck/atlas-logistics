import "server-only";
import fs from "fs";
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { admin } from "firebase-admin";

function normalizePrivateKey(serviceAccount) {
  if (!serviceAccount?.private_key) return serviceAccount;

  return {
    ...serviceAccount,
    private_key: serviceAccount.private_key
      .replace(/-----BEGINPRIVATEKEY-----/g, "-----BEGIN PRIVATE KEY-----")
      .replace(/-----ENDPRIVATEKEY-----/g, "-----END PRIVATE KEY-----"),
  };
}

function resolveServiceAccount() {
  const rawKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY?.trim();
  if (rawKey) {
    return normalizePrivateKey(JSON.parse(rawKey));
  }

  const keyPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (keyPath && fs.existsSync(keyPath)) {
    return normalizePrivateKey(
      JSON.parse(fs.readFileSync(keyPath, "utf8")),
    );
  }

  return null;
}

function ensureAdminApp() {
  if (getApps().length > 0) return;

  const serviceAccount = resolveServiceAccount();
  if (!serviceAccount?.project_id) {
    throw new Error(
      "Firebase Admin credentials are missing or invalid. Set FIREBASE_SERVICE_ACCOUNT_KEY (single-line JSON) or GOOGLE_APPLICATION_CREDENTIALS (path to service account JSON) in your environment.",
    );
  }

  initializeApp({
    credential: cert(serviceAccount),
  });
} else if (getApps().length === 0) {
  // For development without service account, initialize without credentials
  // This allows the app to run but API calls that need admin privileges will fail gracefully
  console.warn("⚠️  Firebase Admin SDK not initialized - service account credentials missing");
  initializeApp({
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "atlas-tracking",
  });
}

function createLazyAdminProxy(getInstance) {
  return new Proxy(
    {},
    {
      get(_target, prop) {
        ensureAdminApp();
        const instance = getInstance();
        const value = instance[prop];
        return typeof value === "function" ? value.bind(instance) : value;
      },
    },
  );
}

const adminDb = createLazyAdminProxy(() => getFirestore());
const adminAuth = createLazyAdminProxy(() => getAuth());

export { admin, adminDb, adminAuth };
