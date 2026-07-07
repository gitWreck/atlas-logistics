import "server-only";
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { admin } from "firebase-admin";

const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_KEY
  ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY)
  : null;

// Only initialize if we have a valid service account
if (getApps().length === 0 && serviceAccount && serviceAccount.project_id) {
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

const adminDb = getFirestore();
const adminAuth = getAuth();
export { admin, adminDb, adminAuth };
