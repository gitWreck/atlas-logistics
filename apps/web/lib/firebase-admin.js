import "server-only";
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { admin } from "firebase-admin";

const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_KEY
  ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY)
  : {};

if (getApps().length === 0) {
  initializeApp({
    credential: cert(serviceAccount),
  });
}

const adminDb = getFirestore();
const adminAuth = getAuth();
export { admin, adminDb, adminAuth };
