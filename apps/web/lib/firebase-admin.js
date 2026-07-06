import "server-only";
import fs from "fs";
import path from "path";
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { admin } from "firebase-admin";

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
      : path.resolve(process.cwd(), keyPath);
    if (fs.existsSync(resolved)) {
      return JSON.parse(fs.readFileSync(resolved, "utf8"));
    }
  }

  return null;
}

const serviceAccount = resolveServiceAccount();

if (getApps().length === 0) {
  if (!serviceAccount?.project_id) {
    throw new Error(
      "Firebase Admin credentials not configured. Set GOOGLE_APPLICATION_CREDENTIALS=./service-account.json in apps/web/.env.local",
    );
  }

  initializeApp({
    credential: cert(serviceAccount),
  });
}

const adminDb = getFirestore();
const adminAuth = getAuth();
export { admin, adminDb, adminAuth };
