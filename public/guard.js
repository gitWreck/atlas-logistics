"use strict";

/* ===============================
   ATLAS GUARD (Page Firewall)
================================ */

console.log("🛡️ Atlas Guard starting…");

(function waitForFirebase() {
  if (!window.firebase || !firebase.apps || !firebase.apps.length) {
    return setTimeout(waitForFirebase, 50);
  }

  firebase.auth().onAuthStateChanged(async (user) => {
    if (!user) {
      console.warn("❌ Guard: not logged in → /login.html");
      location.replace("/login.html");
      return;
    }

    try {
      const snap = await firebase.firestore()
        .collection("users")
        .doc(user.uid)
        .get();

      if (!snap.exists) {
        console.error("❌ Guard: no user profile");
        await firebase.auth().signOut();
        location.replace("/login.html");
        return;
      }

      const data = snap.data() || {};
      if (!data.active) {
        console.error("❌ Guard: account disabled");
        await firebase.auth().signOut();
        location.replace("/login.html");
        return;
      }

      window.MY_ROLE = data.role;
      console.log("✅ Guard passed — role:", data.role);

    } catch (e) {
      console.error("❌ Guard crash", e);
      await firebase.auth().signOut();
      location.replace("/login.html");
    }
  });

})();
