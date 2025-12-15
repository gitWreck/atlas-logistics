/* =========================================================
   FIREBASE IMPORTS
========================================================= */
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
import { buildStatusSMS } from "../shared/sms-templates.js";

/* =========================================================
   STATUS FLOW (ADMIN = FULL CONTROL)
========================================================= */
const STATUS_FLOW = [
  "Received",
  "Loaded",
  "In Transit",
  "Arrived at Port",
  "Boarded RORO Vessel",
  "Out for Delivery",
  "Delivered"
];

/* =========================================================
   REALISTIC TIME THRESHOLDS (YOUR OPS)
========================================================= */
const STATUS_THRESHOLDS = {
  "Loaded": { warn: 36, stuck: 48 },
  "In Transit": { warn: 48, stuck: 72 },
  "Arrived at Port": { warn: 12, stuck: 24 },
  "Boarded RORO Vessel": { warn: 24, stuck: 48 },
  "Out for Delivery": { warn: 24, stuck: 72 }
};

/* =========================================================
   HELPERS
========================================================= */
function hoursAgo(ts) {
  if (!ts?.toMillis) return "—";
  const diffMs = Date.now() - ts.toMillis();
  const mins = diffMs / 60000;
  if (mins < 60) return `${Math.floor(mins)}m ago`;
  return `${(mins / 60).toFixed(1)}h ago`;
}

function isSunday(ts) {
  if (!ts?.toMillis) return false;
  return new Date(ts.toMillis()).getDay() === 0;
}

function getDelayLevel(status, ts) {
  if (!ts?.toMillis) return "normal";
  if (status === "Delivered") return "normal";

  const rule = STATUS_THRESHOLDS[status];
  if (!rule) return "normal";

  let { warn, stuck } = rule;

  if (
    isSunday(ts) &&
    ["Out for Delivery", "In Transit", "Loaded"].includes(status)
  ) {
    warn += 12;
    stuck += 12;
  }

  const hours = (Date.now() - ts.toMillis()) / 36e5;
  if (hours > stuck) return "stuck";
  if (hours > warn) return "warn";
  return "normal";
}

function getStatusBadgeClass(status = "") {
  const s = status.toLowerCase();
  if (s.includes("received")) return "received";
  if (s.includes("loaded")) return "loaded";
  if (s.includes("transit")) return "in-transit";
  if (s.includes("port") || s.includes("roro")) return "in-transit";
  if (s.includes("out for delivery")) return "in-transit";
  if (s.includes("delivered")) return "delivered";
  return "received";
}

/* =========================================================
   STATE & DOM
========================================================= */
const table = document.getElementById("shipmentTable");
const smsModal = document.getElementById("smsModal");
const smsPhoneEl = document.getElementById("smsPhone");
const smsTrackingEl = document.getElementById("smsTracking");
const smsMessageEl = document.getElementById("smsMessage");
const sendSmsBtn = document.getElementById("sendSmsBtn");
const closeSmsBtn = document.getElementById("closeSmsBtn");

let currentUser = null;
let activeFilter = "all";
let smsContext = null;

/* =========================================================
   AUTH GUARD
========================================================= */
onAuthStateChanged(auth, user => {
  if (!user) {
    location.href = "../login.html";
    return;
  }

  currentUser = { uid: user.uid, role: "admin" };

  wireAnalyticsClicks();
  loadAdminAnalytics();
  loadShipments();
});

/* =========================================================
   ANALYTICS CLICK FILTERS
========================================================= */
function wireAnalyticsClicks() {
  document.getElementById("stuckCount").onclick = () => toggleFilter("stuck");
  document.getElementById("delayedCount").onclick = () => toggleFilter("warn");
  document.getElementById("inTransitCount").onclick = () => toggleFilter("transit");
}

function toggleFilter(filter) {
  activeFilter = activeFilter === filter ? "all" : filter;

  document.querySelectorAll(".card").forEach(c => c.classList.remove("active"));

  if (activeFilter !== "all") {
    document.getElementById(
      filter === "warn"
        ? "delayedCount"
        : filter === "transit"
        ? "inTransitCount"
        : "stuckCount"
    ).classList.add("active");
  }

  loadShipments();
}

/* =========================================================
   ADMIN ANALYTICS
========================================================= */
async function loadAdminAnalytics() {
  const snap = await getDocs(collection(db, "tracking_records"));

  let stuck = 0, delayed = 0, inTransit = 0;

  snap.forEach(docSnap => {
    const d = docSnap.data();
    const delay = getDelayLevel(d.status, d.lastUpdated);

    if (delay === "stuck") stuck++;
    if (delay === "warn") delayed++;

    if (
      ["Loaded", "In Transit", "Arrived at Port", "Boarded RORO Vessel", "Out for Delivery"]
        .includes(d.status)
    ) inTransit++;
  });

  document.getElementById("stuckCount").innerHTML = `<strong>${stuck}</strong>Stuck`;
  document.getElementById("delayedCount").innerHTML = `<strong>${delayed}</strong>Delayed`;
  document.getElementById("inTransitCount").innerHTML = `<strong>${inTransit}</strong>In Transit`;
}

/* =========================================================
   LOAD SHIPMENTS TABLE
========================================================= */
async function loadShipments() {
  table.innerHTML = "";
  const snap = await getDocs(collection(db, "tracking_records"));

  for (const docSnap of snap.docs) {
    const record = docSnap.data();

    const eventsRef = collection(
      db,
      "tracking_records",
      docSnap.id,
      "status_events"
    );

    const eventsSnap = await getDocs(
      query(eventsRef, orderBy("statusIndex", "desc"), limit(1))
    );

    let status = "Received";
    let statusIndex = 0;
    let updatedAt = null;

    if (!eventsSnap.empty) {
      const latest = eventsSnap.docs[0].data();
      status = latest.status;
      statusIndex = latest.statusIndex;
      updatedAt = latest.at;
    }

    const delayLevel = getDelayLevel(status, updatedAt);

    if (activeFilter === "stuck" && delayLevel !== "stuck") continue;
    if (activeFilter === "warn" && delayLevel !== "warn") continue;
    if (
      activeFilter === "transit" &&
      !["Loaded", "In Transit", "Arrived at Port", "Boarded RORO Vessel", "Out for Delivery"]
        .includes(status)
    ) continue;

    const options = STATUS_FLOW.map((s, i) =>
      `<option value="${i}" ${i === statusIndex ? "selected" : ""}>${s}</option>`
    ).join("");

    const tr = document.createElement("tr");

    if (delayLevel === "stuck") tr.style.background = "#fff1f2";
    if (delayLevel === "warn") tr.style.background = "#fffbeb";

    tr.innerHTML = `
      <td>${docSnap.id}</td>
      <td>
        ${record.customerName ?? "—"}<br/>
        <small>${record.customerPhone ?? ""}</small>
      </td>
      <td><span class="badge ${getStatusBadgeClass(status)}">${status}</span></td>
      <td style="font-size:12px;color:#475569">
        ${hoursAgo(updatedAt)}
      </td>
      <td>
        <select>${options}</select>
        <button class="sms">📩 SMS</button>
        <button>Apply</button>
      </td>
    `;

    const select = tr.querySelector("select");
    const [smsBtn, applyBtn] = tr.querySelectorAll("button");

    /* ===== SMS PREVIEW ===== */
    smsBtn.onclick = () => {
      if (!record.customerPhone) {
        alert("❌ No customer phone number.");
        return;
      }

      smsContext = {
        phone: record.customerPhone,
        trackingId: docSnap.id,
        status
      };

      smsPhoneEl.textContent = record.customerPhone;
      smsTrackingEl.textContent = docSnap.id;
      smsMessageEl.value = buildStatusSMS(smsContext);

      smsModal.classList.add("active");
    };

    /* ===== STATUS APPLY ===== */
    applyBtn.onclick = async () => {
      const nextIndex = Number(select.value);
      const nextStatus = STATUS_FLOW[nextIndex];
      if (!nextStatus) return alert("Invalid status");

      applyBtn.disabled = true;
      applyBtn.textContent = "Updating…";

      try {
        await updateShipmentStatus({
          trackingId: docSnap.id,
          nextStatus,
          nextStatusIndex: nextIndex,
          user: currentUser
        });
        loadAdminAnalytics();
        loadShipments();
      } catch (err) {
        alert(err.message || "Update failed");
      }
    };

    table.appendChild(tr);
  }
}

/* =========================================================
   SMS MODAL CONTROLS
========================================================= */
closeSmsBtn.onclick = () => {
  smsModal.classList.remove("active");
  smsContext = null;
};

sendSmsBtn.onclick = async () => {
  if (!smsContext) return;

  sendSmsBtn.disabled = true;
  sendSmsBtn.textContent = "Sending…";

  try {
    await fetch("/sendSMS", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to: smsContext.phone,
        message: smsMessageEl.value,
        trackingId: smsContext.trackingId
      })
    });

    alert("✅ SMS sent");
    smsModal.classList.remove("active");
  } catch {
    alert("❌ Failed to send SMS");
  } finally {
    sendSmsBtn.disabled = false;
    sendSmsBtn.textContent = "Send SMS";
  }
};
