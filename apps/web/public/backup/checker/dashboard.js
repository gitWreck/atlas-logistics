import { auth, db } from "../firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
  collection,
  getDocs,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

onAuthStateChanged(auth, async (user) => {
  if (!user) return location.replace("/login.html");

  const snap = await getDocs(collection(db, "tracking_records"));

  let received = 0,
    loaded = 0;
  snap.forEach((d) => {
    const r = d.data();
    if (r.status === "Received") received++;
    if (r.status === "Loaded") loaded++;
  });

  document.getElementById("received").textContent = received;
  document.getElementById("loaded").textContent = loaded;
});
