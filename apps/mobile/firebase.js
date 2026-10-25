import { initializeApp, getApp, getApps } from "firebase/app";
import {
  initializeAuth,
  getAuth,
  getReactNativePersistence,
  connectAuthEmulator,
} from "firebase/auth";
import { getFirestore, connectFirestoreEmulator } from "firebase/firestore";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getStorage } from "firebase/storage";
import { Platform } from "react-native";

// Your Firebase config. Expo web may not inject EXPO_PUBLIC_* env vars at runtime,
// so fall back to the expected values for local development.
const firebaseConfig = {
  apiKey:
    process.env.EXPO_PUBLIC_FIREBASE_API_KEY ||
    "AIzaSyD2-cgUlA9g4PyV9Zwrx17L5EFyQoTDkQo",
  authDomain:
    process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN ||
    "atlas-tracking.firebaseapp.com",
  projectId:
    process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID ||
    "atlas-tracking",
  storageBucket:
    process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET ||
    "atlas-tracking.firebasestorage.app",
  messagingSenderId:
    process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ||
    "612887248700",
  appId:
    process.env.EXPO_PUBLIC_FIREBASE_APP_ID ||
    "web:a23a4a713715ab48f92839",
};

// 1. Initialize App
let app;
if (getApps().length === 0) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApp();
}

// 2. Initialize Auth with Persistence (Crucial for Mobile!)
// If we don't do this, the user will be logged out every time they close the app.
let auth;
try {
  auth = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage),
  });
} catch (e) {
  // If auth is already initialized, just get the instance
  auth = getAuth(app);
}

// 3. Initialize Firestore
const db = getFirestore(app);
const storage = getStorage(app);

if (process.env.EXPO_PUBLIC_USE_FIREBASE_EMULATOR === "true") {
  if (!global.__firebase_emulator_connected) {
    global.__firebase_emulator_connected = true;
    const host = Platform.OS === "android" ? "10.0.2.2" : "localhost";
    connectAuthEmulator(auth, `http://${host}:9099`, { disableWarnings: true });
    connectFirestoreEmulator(db, host, 8080);
  }
}

export { auth, db, app, storage };
