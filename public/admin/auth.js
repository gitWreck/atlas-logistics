import { auth, db } from "./firebase.js";
import {
  signInWithEmailAndPassword,
  signOut
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
  doc,
  getDoc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

console.log("✅ auth.js loaded");

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("loginForm");
  const emailInput = document.getElementById("emailInput");
  const passwordInput = document.getElementById("passwordInput");

  if (!form) {
    console.error("❌ loginForm not found");
    return;
  }

  console.log("✅ loginForm found");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    console.log("🚀 Login submitted");

    try {
      const email = emailInput.value.trim();
      const password = passwordInput.value;

      const cred = await signInWithEmailAndPassword(auth, email, password);
      const uid = cred.user.uid;

      const ref = doc(db, "users", uid);
      const snap = await getDoc(ref);

      if (!snap.exists() || snap.data().role !== "admin" || !snap.data().active) {
        alert("Access denied");
        await signOut(auth);
        return;
      }

      // ✅ SUCCESS
      window.location.href = "/admin/dashboard.html";

    } catch (err) {
      console.error(err);
      alert(err.message);
    }
  });
});
