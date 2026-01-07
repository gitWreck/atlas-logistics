import "server-only";
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

// You will need to set this environment variable later
const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_KEY
  ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY)
  : {};

if (getApps().length === 0) {
  initializeApp({
    credential: cert(serviceAccount),
  });
}

export const adminDb = getFirestore();
