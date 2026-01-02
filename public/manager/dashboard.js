import { auth, db } from "../firebase.js";
import { onAuthStateChanged } from
  "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
  collection, getDocs, orderBy, query, limit
} from
  "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";


onAuthStateChanged(auth, async user => {
  if (!user) return location.replace("/login.html");

  const snap = await getDocs(collection(db, "tracking_records"));

  let delayed = 0, transit = 0;
  snap.forEach(d => {
    const r = d.data();
    if (r.delayReason && !r.delayCleared) delayed++;
    if (r.status === "In Transit") transit++;
  });
  

  document.getElementById("totalShipments").textContent = snap.size;
  document.getElementById("delayedShipments").textContent = delayed;
  document.getElementById("inTransit").textContent = transit;

  const recentQ = query(
    collection(db, "tracking_records"),
    orderBy("lastUpdatedAt", "desc"),
    limit(6)
  );

  const recent = await getDocs(recentQ);
  const tbody = document.getElementById("shipmentTable");
  tbody.innerHTML = "";

  recent.forEach(d => {
    const r = d.data();
    tbody.innerHTML += `
      <tr>
        <td>${d.id}</td>
        <td>${r.status}</td>
        <td>${r.origin} → ${r.destination}</td>
        <td>${r.lastUpdatedAt?.toDate?.().toLocaleString() || "—"}</td>
      </tr>
    `;
  });
});


