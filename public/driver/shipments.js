import {
  collection,
  getDocs,
  query,
  orderBy,
  limit
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

import {
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

import { auth, db } from "../firebase.js";
import { updateShipmentStatus } from "../../src/services/updateShipmentStatus.js";

/* ================= STATUS FLOW (FORWARD ONLY) ================= */
const STATUS_FLOW = [
  "Received",
  "Loaded",
  "In Transit",
  "Arrived at Port",
  "Boarded RORO Vessel",
  "Out for Delivery",
  "Delivered"
];

/* ================= BADGE CLASS ================= */
function getStatusBadgeClass(status = "") {
  const s = status.toLowerCase();

  if (s.includes("received")) return "received";
  if (s.includes("loaded") || s.includes("transit")) return "in-transit";
  if (s.includes("delayed") || s.includes("weather")) return "delayed";
  if (s.includes("delivered")) return "delivered";

  return "received";
}

/* ================= STATE ================= */
const table = document.getElementById("shipmentTable");
let currentUser = null;

/* ================= AUTH ================= */
onAuthStateChanged(auth, user => {
  if (!user) {
    location.href = "../login.html";
    return;
  }

  currentUser = {
    uid: user.uid,
    role: "driver"
  };

  loadShipments();
});

/* ================= LOAD SHIPMENTS ================= */
async function loadShipments() {
  table.innerHTML = "";

  const snap = await getDocs(collection(db, "tracking_records"));

  if (snap.empty) {
    table.innerHTML = `
      <tr>
        <td colspan="4" style="text-align:center; padding:24px; color:#64748b;">
          No shipments assigned
        </td>
      </tr>
    `;
    return;
  }

  for (const docSnap of snap.docs) {
    const record = docSnap.data();

    /* 🔑 GET LATEST STATUS EVENT */
    const eventsRef = collection(
      db,
      "tracking_records",
      docSnap.id,
      "status_events"
    );

    const eventsSnap = await getDocs(
      query(eventsRef, orderBy("statusIndex", "desc"), limit(1))
    );

    let status = record.status || "Received";
    let statusIndex = record.statusIndex ?? 0;

    if (!eventsSnap.empty) {
      const latest = eventsSnap.docs[0].data();
      status = latest.status;
      statusIndex = latest.statusIndex;
    }

    /* 🔒 PREVENT BACKWARD STATUS */
    const nextIndex = statusIndex + 1;
    const canAdvance = nextIndex < STATUS_FLOW.length;
    const nextStatus = STATUS_FLOW[nextIndex];

    const badgeClass = getStatusBadgeClass(status);

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${docSnap.id}</td>
      <td>${record.customerName ?? "—"}</td>
      <td>
        <span class="badge ${badgeClass}">
          ${status}
        </span>
      </td>
      <td>
        <button ${canAdvance ? "" : "disabled"}>
          ${canAdvance ? "→ " + nextStatus : "Completed"}
        </button>
      </td>
    `;

    const btn = tr.querySelector("button");

    if (canAdvance) {
      btn.onclick = async () => {
        btn.disabled = true;
        btn.textContent = "Updating…";

        try {
          await updateShipmentStatus({
            trackingId: docSnap.id,
            nextStatus,
            nextStatusIndex: nextIndex,
            user: currentUser
          });

          loadShipments();
        } catch (err) {
          alert(err.message || "Update failed");
          loadShipments();
        }
      };
    }

    table.appendChild(tr);
  }
}
