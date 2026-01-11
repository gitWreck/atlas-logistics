import "server-only";
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth"; // <--- ADD THIS

const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_KEY
  ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY)
  : {};

if (getApps().length === 0) {
  initializeApp({
    credential: cert(serviceAccount),
  });
}

export const adminDb = getFirestore();
export const adminAuth = getAuth(); // <--- ADD THIS to export the Auth service
