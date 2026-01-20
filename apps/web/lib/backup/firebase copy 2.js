// lib/firebase.js
import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore, connectFirestoreEmulator } from "firebase/firestore";
import { getAuth, connectAuthEmulator } from "firebase/auth"; // FIX 1: Correct import source

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// FIX 2: Singleton Pattern (Prevents "App already initialized" errors on reload)
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

const db = getFirestore(app);
const auth = getAuth(app);

// FIX 3: Environment Check & Execution Order
// We check if we are on the client (window exists) AND on localhost
if (typeof window !== "undefined" && window.location.hostname === "localhost") {
  // Only connect if emulators haven't been connected yet to avoid duplicates
  // (Optional safe-guard, but usually safe in simple setups)
  try {
    console.log("Using Firebase emulators");

    // connectFirestoreEmulator takes host and port separately
    connectFirestoreEmulator(db, "localhost", 4000);

    // connectAuthEmulator takes the full URL string
    connectAuthEmulator(auth, "http://localhost:4000");
  } catch (e) {
    console.warn("Emulators already connected or failed to connect", e);
  }
}

// FIX 4: actually export the instances so your app can use them
export { app, db, auth };
