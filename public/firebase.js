// public/firebase.js — ATLAS PROD SAFE

const firebaseConfig = {
  apiKey: "AIzaSyD2-cgUlA9g4PyV9Zwrx17L5EFyQoTDkQo",
  authDomain: "atlas-tracking.firebaseapp.com",
  projectId: "atlas-tracking",
  storageBucket: "atlas-tracking.appspot.com",
  messagingSenderId: "612887248700",
  appId: "1:612887248700:web:a23a4a713715ab48f92839",
  measurementId: "G-QN4MNX9YZY"
};


// Prevent double init
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

// Core services
window.auth = firebase.auth();
window.db = firebase.firestore();

// 🚨 THIS IS WHAT WAS MISSING
window.functions = firebase.app().functions("asia-southeast1");

// Optional debug
console.log("🔥 Firebase ready", firebase.app().name);
