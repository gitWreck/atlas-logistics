import "server-only";
import fs from "fs";
import {
  applicationDefault,
  cert,
  getApps,
  initializeApp,
} from "firebase-admin/app";
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
  if (serviceAccount && !serviceAccount.project_id) {
    throw new Error(
      "Firebase Admin credentials are invalid: the configured service account is missing project_id.",
    );
  }

  const projectId =
    serviceAccount?.project_id ||
    process.env.FIREBASE_PROJECT_ID ||
    process.env.GCLOUD_PROJECT ||
    process.env.GOOGLE_CLOUD_PROJECT ||
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ||
    "atlas-tracking";

  const isEmulator = Boolean(
    process.env.FIRESTORE_EMULATOR_HOST ||
    process.env.FIREBASE_AUTH_EMULATOR_HOST ||
    process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATOR === "true"
  );

  initializeApp({
    ...(serviceAccount
      ? { credential: cert(serviceAccount) }
      : isEmulator
      ? {}
      : { credential: applicationDefault() }),
    projectId,
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
