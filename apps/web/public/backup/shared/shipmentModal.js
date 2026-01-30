import {
  getFunctions,
  httpsCallable,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-functions.js";

import {
  collection,
  getDocs,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

import { db } from "../firebase.js";

/* ======================================================
   ELEMENTS
====================================================== */
const modal = document.getElementById("shipmentModal");
const nameInput = document.getElementById("sm_customerName");
const phoneInput = document.getElementById("sm_customerPhone");
const originInput = document.getElementById("sm_origin");
const destInput = document.getElementById("sm_destination");
const itemInput = document.getElementById("sm_itemCount");

const saveBtn = document.getElementById("sm_saveBtn");
const cancelBtn = document.getElementById("sm_cancelBtn");
const hint = document.getElementById("sm_customerHint");

/* ======================================================
   HELPERS
====================================================== */
const toCode = (s = "") =>
  s
    .trim()
    .toUpperCase()
    .replace(/[^A-Z]/g, "")
    .slice(0, 4);

function openModal() {
  modal.classList.add("active");
  modal.setAttribute("aria-hidden", "false");
  nameInput.focus();
}

function closeModal() {
  modal.classList.remove("active");
  modal.setAttribute("aria-hidden", "true");
  clearForm();
}

function clearForm() {
  nameInput.value = "";
  phoneInput.value = "";
  originInput.value = "";
  destInput.value = "";
  itemInput.value = 1;
  hint.textContent = "";
}

/* ======================================================
   CUSTOMER MEMORY (AUTOCOMPLETE)
====================================================== */
let cachedCustomers = [];

async function loadCustomers() {
  const snap = await getDocs(collection(db, "tracking_records"));
  const map = new Map();

  snap.forEach((d) => {
    const r = d.data();
    if (r.customerName && r.customerPhone) {
      map.set(r.customerName.toLowerCase(), {
        name: r.customerName,
        phone: r.customerPhone,
      });
    }
  });

  cachedCustomers = [...map.values()];
}

nameInput.addEventListener("input", () => {
  const v = nameInput.value.toLowerCase();
  const match = cachedCustomers.find((c) => c.name.toLowerCase().startsWith(v));

  if (match) {
    hint.textContent = `↳ ${match.phone}`;
    hint.className = "hint ok";
    phoneInput.value = match.phone;
  } else {
    hint.textContent = "";
  }
});

/* ======================================================
   INIT (PUBLIC)
====================================================== */
export function initShipmentModal({ onCreated }) {
  const functions = getFunctions(undefined, "asia-southeast1");
  const createShipment = httpsCallable(functions, "createShipment");

  loadCustomers().catch(console.warn);

  document
    .getElementById("addShipmentBtn")
    ?.addEventListener("click", openModal);

  cancelBtn.onclick = closeModal;

  saveBtn.onclick = async () => {
    if (saveBtn.disabled) return;

    const customerName = nameInput.value.trim();
    const customerPhone = phoneInput.value.trim();
    const originLabel = originInput.value.trim();
    const destinationLabel = destInput.value.trim();
    const itemCount = Number(itemInput.value || 1);

    if (
      !customerName ||
      !customerPhone ||
      !originLabel ||
      !destinationLabel ||
      itemCount < 1
    ) {
      alert("Please complete all fields.");
      return;
    }

    saveBtn.disabled = true;
    saveBtn.textContent = "Creating…";

    try {
      const res = await createShipment({
        customerName,
        customerPhone,
        originCode: toCode(originLabel),
        destinationCode: toCode(destinationLabel),
        originLabel,
        destinationLabel,
        extra: {
          itemCount,
          receivedCount: itemCount,
          loadedCount: 0,
          pendingCount: itemCount,
        },
      });

      closeModal();
      await loadCustomers(); // refresh memory
      onCreated && onCreated();

      alert(`✅ Shipment Created\n${res.data.trackingId}`);
    } catch (err) {
      console.error(err);
      alert(err.message || "Failed to create shipment");
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = "Create Shipment";
    }
  };

  // ESC to close
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeModal();
  });
}
