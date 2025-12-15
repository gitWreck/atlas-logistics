// public/admin/firebase.js

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getFunctions } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-functions.js";

const firebaseConfig = {
  apiKey: "AIzaSyD2-cgUlA9g4PyV9Zwrx17L5EFyQoTDkQo",
  authDomain: "atlas-tracking.firebaseapp.com",
  projectId: "atlas-tracking",
  storageBucket: "atlas-tracking.appspot.com",
  messagingSenderId: "612887248700",
  appId: "1:612887248700:web:a23a4a713715ab48f92839",
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const functions = getFunctions(app, "asia-southeast1");


console.log("✅ Firebase initialized (admin)");
