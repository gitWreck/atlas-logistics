"use strict";

/* ======================================================================
 🚚 TRUCK TRIP ITEM EDITOR (CANONICAL)
 ----------------------------------------------------------------------
 - Edits loadedItems
 - Syncs shipment counts
 - Controls PER-TRUCK Auto-SMS
 - 🌧 Pause Auto-SMS During Weather
 - 📊 Per-truck SMS usage (Auto vs Manual)
 - Admin / Manager only
 - Fully audited
 ====================================================================== */

import {
  doc,
  updateDoc,
  getDoc,
  serverTimestamp,
  collection,
  query,
  where,
  getCountFromServer,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

import {
  getFunctions,
  httpsCallable,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-functions.js";

import { db } from "../firebase.js";

/* ======================================================
   CLOUD FUNCTIONS
====================================================== */
const functions = getFunctions(undefined, "asia-southeast1");
const syncShipmentItems = httpsCallable(functions, "syncShipmentItems");

/* ======================================================
   INIT EDITOR
====================================================== */
export function initTruckTripItemEditor({
  trackingId,
  truckTripId,
  inputEl,
  saveBtn,
  currUser,
  onSuccess,
}) {
  if (!trackingId || !truckTripId) return;
  if (!inputEl || !saveBtn) return;
  if (!currUser || !["admin", "manager"].includes(currUser.role)) return;

  const truckTripRef = doc(
    db,
    "tracking_records",
    trackingId,
    "truck_trips",
    truckTripId,
  );

  /* ======================================================
     🔢 LOADED ITEMS
  ====================================================== */
  saveBtn.onclick = async () => {
    const newValue = Number(inputEl.value);
    if (!Number.isInteger(newValue) || newValue < 0) {
      alert("Invalid loaded items count");
      return;
    }

    saveBtn.disabled = true;
    try {
      await updateDoc(truckTripRef, {
        loadedItems: newValue,
        updatedAt: serverTimestamp(),
        updatedBy: currUser.uid,
        updatedRole: currUser.role,
      });

      await syncShipmentItems({
        trackingId,
        truckTripId,
        loadedItems: newValue,
      });
      onSuccess?.();
    } finally {
      saveBtn.disabled = false;
    }
  };

  /* ======================================================
     📲 AUTO-SMS + WEATHER PAUSE
  ====================================================== */
  const autoWrap = document.createElement("div");
  autoWrap.style = `
    margin-top:16px;
    padding:14px;
    border-radius:12px;
    background:#f8fafc;
    border:1px solid #e5e7eb;
    font-size:13px;
  `;

  autoWrap.innerHTML = `
    <label style="display:flex;gap:10px;cursor:pointer;">
      <input type="checkbox" id="autoSmsToggle"/>
      <span>
        📲 <b>Auto SMS for this truck</b><br>
        <span id="autoSmsHint" style="font-size:12px;color:#64748b;"></span>
      </span>
    </label>

    <label style="display:flex;gap:10px;cursor:pointer;margin-top:10px;">
      <input type="checkbox" id="pauseWeatherToggle"/>
      <span>
        🌧 <b>Pause during weather delays</b><br>
        <span style="font-size:12px;color:#64748b;">
          Auto-SMS pauses while delayReason = WEATHER
        </span>
      </span>
    </label>
  `;

  inputEl.parentNode?.appendChild(autoWrap);

  const autoSmsToggle = autoWrap.querySelector("#autoSmsToggle");
  const pauseWeatherToggle = autoWrap.querySelector("#pauseWeatherToggle");
  const autoSmsHint = autoWrap.querySelector("#autoSmsHint");

  /* --------------------------------------------------
     LOAD STATE
  -------------------------------------------------- */
  (async () => {
    const snap = await getDoc(truckTripRef);
    const d = snap.exists() ? snap.data() : {};

    const enabled = d.autoSmsEnabled !== false;
    autoSmsToggle.checked = enabled;
    pauseWeatherToggle.checked = d.pauseAutoSmsDuringWeather === true;

    autoSmsHint.textContent = enabled
      ? "Auto-SMS is ENABLED for this truck."
      : "Auto-SMS is DISABLED for this truck.";
  })();

  /* --------------------------------------------------
     SAVE TOGGLES
  -------------------------------------------------- */
  async function saveToggle(update) {
    await updateDoc(truckTripRef, {
      ...update,
      autoSmsUpdatedBy: currUser.uid,
      autoSmsUpdatedRole: currUser.role,
      autoSmsUpdatedAt: serverTimestamp(),
    });
  }

  autoSmsToggle.onchange = async () => {
    autoSmsToggle.disabled = true;
    try {
      await saveToggle({ autoSmsEnabled: autoSmsToggle.checked });
      autoSmsHint.textContent = autoSmsToggle.checked
        ? "Auto-SMS is ENABLED for this truck."
        : "Auto-SMS is DISABLED for this truck.";
    } finally {
      autoSmsToggle.disabled = false;
    }
  };

  pauseWeatherToggle.onchange = async () => {
    pauseWeatherToggle.disabled = true;
    try {
      await saveToggle({
        pauseAutoSmsDuringWeather: pauseWeatherToggle.checked,
      });
    } finally {
      pauseWeatherToggle.disabled = false;
    }
  };

  /* ======================================================
     📊 PER-TRUCK SMS USAGE BAR
  ====================================================== */
  const bar = document.createElement("div");
  bar.className = "sms-bar-card";
  bar.style = `
    margin-top:16px;
    padding:14px;
    border-radius:12px;
    border:1px solid #e5e7eb;
    font-size:13px;
    background:#fff;
  `;
  bar.innerHTML = `<h4>📊 SMS Usage</h4><div id="smsBars">Loading…</div>`;
  autoWrap.appendChild(bar);

  (async () => {
    const base = collection(db, "sms_logs");

    const autoQ = query(
      base,
      where("truckTripId", "==", truckTripId),
      where("source", "==", "auto"),
    );

    const manualQ = query(
      base,
      where("truckTripId", "==", truckTripId),
      where("source", "==", "manual"),
    );

    const autoCount = (await getCountFromServer(autoQ)).data().count;
    const manualCount = (await getCountFromServer(manualQ)).data().count;
    const total = autoCount + manualCount || 1;

    const autoPct = Math.round((autoCount / total) * 100);
    const manualPct = 100 - autoPct;

    bar.querySelector("#smsBars").innerHTML = `
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
        <span>Auto</span>
        <div style="flex:1;height:10px;background:#e5e7eb;border-radius:6px;">
          <div style="width:${autoPct}%;height:100%;background:#2563eb;"></div>
        </div>
        <span>${autoPct}%</span>
      </div>
      <div style="display:flex;align-items:center;gap:8px;">
        <span>Manual</span>
        <div style="flex:1;height:10px;background:#e5e7eb;border-radius:6px;">
          <div style="width:${manualPct}%;height:100%;background:#7c3aed;"></div>
        </div>
        <span>${manualPct}%</span>
      </div>
    `;
  })();
}
