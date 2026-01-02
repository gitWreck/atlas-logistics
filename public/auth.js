"use strict";

/* ===============================
   ATLAS AUTH ENGINE
================================ */

(function waitForFirebaseAndDOM() {
  if (
    document.readyState !== "complete" ||
    !window.firebase ||
    !firebase.apps ||
    !firebase.apps.length
  ) {
    return setTimeout(waitForFirebaseAndDOM, 50);
  }

  console.log("🔥 Atlas Auth loaded");

  const form = document.getElementById("loginForm");
  const btn = document.getElementById("loginBtn");
  const errorBox = document.getElementById("loginError");

  if (!form) {
    console.error("❌ loginForm not found");
    return;
  }

  function showError(msg) {
    errorBox.textContent = msg;
    errorBox.classList.add("active");
    btn.disabled = false;
    btn.textContent = "Sign In";
  }

  function clearError() {
    errorBox.textContent = "";
    errorBox.classList.remove("active");
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    clearError();

    const email = document.getElementById("emailInput").value.trim();
    const password = document.getElementById("passwordInput").value;

    // Honeypot
    if (document.getElementById("username")?.value) {
      showError("Bot blocked.");
      return;
    }

    try {
      btn.disabled = true;
      btn.textContent = "Signing in…";

      console.log("🔐 Signing in…");

      const cred = await firebase.auth()
        .signInWithEmailAndPassword(email, password);

      const uid = cred.user.uid;
      console.log("✅ Authenticated:", uid);

      const snap = await firebase.firestore()
        .collection("users")
        .doc(uid)
        .get();

      if (!snap.exists) throw new Error("No user profile");

      const user = snap.data() || {};
      if (!user.active) throw new Error("Account disabled");

      console.log("🎯 ROLE:", user.role);

      let target;

      if (user.role === "admin" || user.role === "manager")
        target = "/mainshipment.html";
      else if (user.role === "driver")
        target = "/driver/dashboard.html";
      else if (user.role === "checker")
        target = "/checker/dashboard.html";
      else
        throw new Error("Invalid role");

      console.log("➡️ Redirecting to:", target);
      location.replace(target);

    } catch (err) {
      console.error("❌ Login failed:", err);
      showError(err.message || "Login failed");
    }
  });

})();
