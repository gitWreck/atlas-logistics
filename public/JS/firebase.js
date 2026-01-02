// public/JS/firebase.js — Atlas Firebase v8 compat bootstrap

// IMPORTANT: This file is for v8-compat scripts that include
// https://www.gstatic.com/firebasejs/9.x.x/firebase-app-compat.js, etc.
// It must NOT use v9 modular imports.

const firebaseConfig = {
  apiKey: "AIzaSyD2-cgUlA9g4PyV9Zwrx17L5EFyQoTDkQo",
  authDomain: "atlas-tracking.firebaseapp.com",
  projectId: "atlas-tracking",
  storageBucket: "atlas-tracking.firebasestorage.app",
  messagingSenderId: "612887248700",
  appId: "1:612887248700:web:a23a4a713715ab48f92839",
  measurementId: "G-QN4MNX9YZY",
};

// Initialize the default app (v8 compat style)
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

// Expose common services on window for legacy scripts
window.auth = firebase.auth();
window.db = firebase.firestore();
window.storage = firebase.storage();

// ===== Cloud Functions (v8 compat) =====
// Bind Functions to asia-southeast1 using the v8 app-scoped API (no host hacks).
window.functions = firebase.app().functions("asia-southeast1");

console.log("🔥 Atlas Firebase v8 compat initialized (asia-southeast1)");
