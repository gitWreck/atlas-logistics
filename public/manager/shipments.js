/* =========================================================
   FIREBASE IMPORTS
========================================================= */
import {
  collection,
  getDocs,
  doc,
  setDoc,
  updateDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

import {
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

import { auth, db } from "../firebase.js";
import { updateShipmentStatus } from "../../src/services/updateShipmentStatus.js";
import { normalizePHPhone } from "../shared/phone-utils.js";
import { buildStatusSMS } from "../shared/sms-templates.js";

/* =========================================================
   STATUS FLOW (LOCKED)
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
   BADGE HELPER
========================================================= */
function getBadge(status = "") {
  const s = status.toLowerCase();
  if (s.includes("received")) return "received";
  if (s.includes("loaded") || s.includes("transit")) return "in-transit";
  if (s.includes("delivered")) return "delivered";
  return "received";
}

/* =========================================================
   DOM REFERENCES
========================================================= */
const table = document.getElementById("shipmentTable");

const modal = document.getElementById("shipmentModal");
const addBtn = document.getElementById("addShipmentBtn");

const trackingInput = document.getElementById("trackingInput");
const customerInput = document.getElementById("customerInput");
const phoneInput = document.getElementById("customerPhone");
const destinationInput = document.getElementById("destinationInput");

const saveBtn = document.getElementById("saveShipmentBtn");
const cancelBtn = document.getElementById("cancelBtn");

/* ===== SMS MODAL ===== */
const smsModal = document.getElementById("smsModal");
const smsPhoneEl = document.getElementById("smsPhone");
const smsTrackingEl = document.getElementById("smsTracking");
const smsMessageEl = document.getElementById("smsMessage");
const sendSmsBtn = document.getElementById("sendSmsBtn");
const closeSmsBtn = document.getElementById("closeSmsBtn");

/* =========================================================
   STATE
========================================================= */
let editingId = null;
let currentUser = null;
let smsContext = null;

/* =========================================================
   AUTH GUARD
========================================================= */
onAuthStateChanged(auth, user => {
  if (!user) {
    location.href = "../login.html";
    return;
  }

  currentUser = {
    uid: user.uid,
    role: "admin"
  };

  loadShipments();
});

/* =========================================================
   LOAD SHIPMENTS
========================================================= */
async function loadShipments() {
  table.innerHTML = "";

  const snap = await getDocs(collection(db, "tracking_records"));

  if (snap.empty) {
    table.innerHTML = `
      <tr>
        <td colspan="5" style="text-align:center;color:#64748b;padding:24px;">
          No shipments found
        </td>
      </tr>
    `;
    return;
  }

  snap.forEach(docSnap => {
    const d = docSnap.data();
    const idx = d.statusIndex ?? 0;
    const nextIdx = idx + 1;

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${docSnap.id}</td>
      <td>
        ${d.customerName || "—"}<br/>
        <small style="color:#64748b">${d.customerPhone || ""}</small>
      </td>
      <td>${d.destination || "—"}</td>
      <td>
        <span class="badge ${getBadge(d.status)}">
          ${d.status}
        </span>
      </td>
      <td class="actions">
        <button class="secondary">Edit</button>
        <button class="sms">📩 SMS</button>
        <button ${nextIdx >= STATUS_FLOW.length ? "disabled" : ""}>
          ${nextIdx < STATUS_FLOW.length
            ? "→ " + STATUS_FLOW[nextIdx]
            : "Done"}
        </button>
      </td>
    `;

    const [editBtn, smsBtn, statusBtn] = tr.querySelectorAll("button");

    /* ===== EDIT ===== */
    editBtn.onclick = () => openModal(docSnap.id, d);

    /* ===== SMS PREVIEW ===== */
    smsBtn.onclick = () => {
      if (!d.customerPhone) {
        alert("❌ No customer phone number on record.");
        return;
      }

      smsContext = {
        phone: d.customerPhone,
        trackingId: docSnap.id,
        status: d.status
      };

      smsPhoneEl.textContent = d.customerPhone;
      smsTrackingEl.textContent = docSnap.id;
      smsMessageEl.value = buildStatusSMS(smsContext);

      smsModal.classList.add("active");
    };

    /* ===== STATUS UPDATE ===== */
    if (nextIdx < STATUS_FLOW.length) {
      statusBtn.onclick = async () => {
        await updateShipmentStatus({
          trackingId: docSnap.id,
          nextStatus: STATUS_FLOW[nextIdx],
          nextStatusIndex: nextIdx,
          user: currentUser
        });
        loadShipments();
      };
    }

    table.appendChild(tr);
  });
}

/* =========================================================
   MODAL HANDLING
========================================================= */
addBtn.onclick = () => openModal();

cancelBtn.onclick = () => modal.classList.remove("active");

function openModal(id = null, data = {}) {
  editingId = id;
  modal.classList.add("active");

  trackingInput.value = id ?? "";
  trackingInput.disabled = !!id;

  customerInput.value = data.customerName ?? "";
  phoneInput.value = data.customerPhone ?? "";
  destinationInput.value = data.destination ?? "";
}

/* =========================================================
   SAVE SHIPMENT (WITH PHONE VALIDATION)
========================================================= */
saveBtn.onclick = async () => {
  const id = trackingInput.value.trim();
  if (!id) return alert("Tracking ID required");

  const phoneRaw = phoneInput.value.trim();
  const phone = normalizePHPhone(phoneRaw);

  if (!phone) {
    alert(
      "❌ Invalid Phone Number\n\n" +
      "Accepted formats:\n" +
      "• 09125453219\n" +
      "• 9125453219\n" +
      "• 639125453219\n\n" +
      "Saved format: 09XXXXXXXXX"
    );
    return;
  }

  const payload = {
    customerName: customerInput.value.trim(),
    customerPhone: phone,
    destination: destinationInput.value.trim(),
    lastUpdatedAt: serverTimestamp(),
    lastUpdatedBy: currentUser.uid,
    lastUpdatedRole: "admin"
  };

  if (editingId) {
    await updateDoc(
      doc(db, "tracking_records", id),
      payload
    );
  } else {
    await setDoc(
      doc(db, "tracking_records", id),
      {
        ...payload,
        status: "Received",
        statusIndex: 0,
        createdAt: serverTimestamp(),
        createdBy: currentUser.uid
      }
    );
  }

  modal.classList.remove("active");
  loadShipments();
};

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

    alert("✅ SMS sent successfully");
    smsModal.classList.remove("active");
  } catch (err) {
    alert("❌ Failed to send SMS");
  } finally {
    sendSmsBtn.disabled = false;
    sendSmsBtn.textContent = "Send SMS";
  }
};
