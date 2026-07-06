import "server-only";
import fs from "fs";
import path from "path";
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { admin } from "firebase-admin";

let adminDbInstance = null;
let adminAuthInstance = null;

function resolveServiceAccount() {
  const rawKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY?.trim();
  if (rawKey && rawKey !== "{") {
    return JSON.parse(rawKey);
  }

  const keyPath =
    process.env.GOOGLE_APPLICATION_CREDENTIALS ||
    process.env.FIREBASE_SERVICE_ACCOUNT_KEY_PATH;
  if (keyPath) {
    const resolved = path.isAbsolute(keyPath)
      ? keyPath
      : path.join(/* turbopackIgnore: true */ process.cwd(), keyPath);
    if (fs.existsSync(resolved)) {
      return JSON.parse(fs.readFileSync(resolved, "utf8"));
    }
  }

  return null;
}

function ensureInitialized() {
  if (getApps().length > 0) return;

  const serviceAccount = resolveServiceAccount();
  if (!serviceAccount?.project_id) {
    throw new Error(
      "Firebase Admin credentials not configured. For Vercel, set FIREBASE_SERVICE_ACCOUNT_KEY to the full service-account JSON. For local dev, use GOOGLE_APPLICATION_CREDENTIALS=./service-account.json.",
    );
  }

  initializeApp({
    credential: cert(serviceAccount),
  });
}

function getAdminDb() {
  ensureInitialized();
  if (!adminDbInstance) {
    adminDbInstance = getFirestore();
  }
  return adminDbInstance;
}

function getAdminAuth() {
  ensureInitialized();
  if (!adminAuthInstance) {
    adminAuthInstance = getAuth();
  }
  return adminAuthInstance;
}

function bindTarget(target, prop) {
  const value = target[prop];
  return typeof value === "function" ? value.bind(target) : value;
}

export const adminDb = new Proxy(
  {},
  {
    get(_target, prop) {
      return bindTarget(getAdminDb(), prop);
    },
  },
);

export const adminAuth = new Proxy(
  {},
  {
    get(_target, prop) {
      return bindTarget(getAdminAuth(), prop);
    },
  },
);

export { admin };
