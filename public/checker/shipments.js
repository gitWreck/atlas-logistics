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

/* =====================================================
   STATUS FLOW (INTERNAL)
===================================================== */
const STATUS_FLOW = [
  "Received",
  "Loaded",
  "In Transit",
  "Arrived at Port",
  "Boarded RORO Vessel",
  "Out for Delivery",
  "Delivered"
];

/* =====================================================
   MAP INTERNAL STATUS → PUBLIC STATUS
===================================================== */
function mapToPublicStatus(rawStatus = "") {
  const s = rawStatus.toLowerCase();

  if (s.includes("received")) return "Received";
  if (s.includes("loaded") || s.includes("transit")) return "In Transit";
  if (s.includes("out for delivery")) return "Out for Delivery";
  if (s.includes("delivered")) return "Delivered";

  return "Received"; // safe fallback
}

/* =====================================================
   MAP PUBLIC STATUS → BADGE CLASS
===================================================== */
function getStatusBadgeClass(publicStatus = "") {
  const s = publicStatus.toLowerCase();

  if (s === "received") return "received";
  if (s === "in transit") return "in-transit";
  if (s === "out for delivery") return "in-transit";
  if (s === "delivered") return "delivered";

  return "received";
}

/* =====================================================
   STATE
===================================================== */
const table = document.getElementById("shipmentTable");
let currentUser = null;

/* =====================================================
   AUTH GUARD
===================================================== */
onAuthStateChanged(auth, user => {
  if (!user) {
    location.href = "../login.html";
    return;
  }

  currentUser = {
    uid: user.uid,
    role: "checker" // Firestore rules enforce authority
  };

  loadShipments();
});

/* =====================================================
   LOAD SHIPMENTS
===================================================== */
async function loadShipments() {
  table.innerHTML = "";

  const snap = await getDocs(collection(db, "tracking_records"));

  if (snap.empty) {
    table.innerHTML = `
      <tr>
        <td colspan="4" style="text-align:center; padding:24px; color:#64748b;">
          No shipments found
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

    let internalStatus = record.status || "Received";
    let statusIndex = record.statusIndex ?? 0;

    if (!eventsSnap.empty) {
      const latest = eventsSnap.docs[0].data();
      internalStatus = latest.status;
      statusIndex = latest.statusIndex;
    }

    /* 🔄 INTERNAL → PUBLIC */
    const publicStatus = mapToPublicStatus(internalStatus);
    const badgeClass = getStatusBadgeClass(publicStatus);

    /* ➡ NEXT STATUS */
    const nextIndex = statusIndex + 1;
    const canAdvance = nextIndex < STATUS_FLOW.length;
    const nextStatus = STATUS_FLOW[nextIndex];

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${docSnap.id}</td>
      <td>${record.customerName ?? "—"}</td>
      <td>
        <span class="badge ${badgeClass}">
          ${publicStatus}
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
