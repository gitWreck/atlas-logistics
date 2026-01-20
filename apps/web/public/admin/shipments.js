/* ======================================================
   public/admin/shipments.js (PRODUCTION — Callable First)
   Requires:
   - /shared/firebase.js
   - /shared/ui.js
   - /shared/dragDrop.js
   - /shared/callables.js
====================================================== */

import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  where,
  limit
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

import { auth, db } from "/shared/firebase.js";
import { $, byId, setText, show, hide, fmtDate, toast, escapeHtml, bindEscToClose } from "/shared/ui.js";
import { setDragPayload, bindDropzone } from "/shared/dragDrop.js";
import { FN, callFn } from "/shared/callables.js";

/* ======================================================
   CONSTANTS
====================================================== */
const SHIPMENTS_LIMIT = 120;
const TRUCKS_LIMIT = 40;
const DRIVERS_LIMIT = 200;
const SMS_USAGE_REFRESH_MS = 2500;

const DEFAULT_DELAY_REASONS = [
  { value: "WEATHER", label: "WEATHER – Bad weather / PAGASA" },
  { value: "RORO_FULL", label: "RORO_FULL – No space on vessel" },
  { value: "PORT_CONGESTION", label: "PORT_CONGESTION – Port traffic" },
  { value: "MECHANICAL", label: "MECHANICAL – Truck issue" },
  { value: "TRAFFIC", label: "TRAFFIC – Road congestion" },
  { value: "ACCIDENT", label: "ACCIDENT – Road incident" },
  { value: "HOLIDAY", label: "HOLIDAY – Holiday closure" },
  { value: "OTHER", label: "OTHER – Other reason" }
];

function badgeClassForStatus(status = "") {
  const s = String(status || "").toLowerCase();
  if (s.includes("received")) return "received";
  if (s.includes("loaded")) return "loaded";
  if (s.includes("transit")) return "in-transit";
  if (s.includes("delivered")) return "delivered";
  if (s.includes("returned")) return "returned";
  if (s.includes("cancel")) return "cancelled";
  return "received";
}

/* ======================================================
   DOM
====================================================== */
// Header buttons
const newShipmentBtn = byId("newShipmentBtn");
const createTruckTripBtn = byId("createTruckTripBtn");
const refreshTruckViewBtn = byId("refreshTruckViewBtn");
const openTruckDrawerBtn = byId("openTruckDrawerBtn");

// Bulk upload
const bulkFile = byId("bulkFile");
const bulkFileName = byId("bulkFileName");
const bulkUploadBtn = byId("bulkUploadBtn");
const bulkResults = byId("bulkResults");
const downloadCsvTemplate = byId("downloadCsvTemplate");

// Analytics
const stuckCount = byId("stuckCount");
const delayedCount = byId("delayedCount");
const inTransitCount = byId("inTransitCount");

// Breadcrumb
const breadcrumb = byId("breadcrumb");

// Table
const shipmentTable = byId("shipmentTable");

// Drag zones
const unassignedDropzone = byId("unassignedDropzone");
const unassignedCountBadge = byId("unassignedCountBadge");
const truckList = byId("truckList");

// Drawer
const truckDrawerBackdrop = byId("truckDrawerBackdrop");
const truckDrawer = byId("truckDrawer");
const closeTruckDrawerBtn = byId("closeTruckDrawerBtn");

const drawerTitle = byId("drawerTitle");
const drawerSub = byId("drawerSub");

const drawerTruckTripId = byId("drawerTruckTripId");
const drawerDriverName = byId("drawerDriverName");
const drawerAutoSmsState = byId("drawerAutoSmsState");
const drawerWeatherPauseState = byId("drawerWeatherPauseState");

const drawerCreateTruckBtn = byId("drawerCreateTruckBtn");

// Drawer Delay
const drawerDelayReasonSelect = byId("drawerDelayReasonSelect");
const drawerApplyDelayBtn = byId("drawerApplyDelayBtn");
const drawerClearDelayBtn = byId("drawerClearDelayBtn");
const drawerDelayHint = byId("drawerDelayHint");

// Drawer Driver
const drawerDriverSelect = byId("drawerDriverSelect");
const drawerAssignDriverBtn = byId("drawerAssignDriverBtn");
const drawerUnassignDriverBtn = byId("drawerUnassignDriverBtn");

// Drawer Auto SMS
const drawerAutoSmsToggle = byId("drawerAutoSmsToggle");
const drawerAutoSmsHint = byId("drawerAutoSmsHint");
const drawerPauseWeatherToggle = byId("drawerPauseWeatherToggle");

// Drawer preview next SMS
const drawerNextSmsPreview = byId("drawerNextSmsPreview");
const drawerPreviewNextSmsBtn = byId("drawerPreviewNextSmsBtn");

// Drawer usage bars
const drawerAutoFill = byId("drawerAutoFill");
const drawerManualFill = byId("drawerManualFill");
const drawerAutoPct = byId("drawerAutoPct");
const drawerManualPct = byId("drawerManualPct");
const drawerSmsUsageHint = byId("drawerSmsUsageHint");

// Drawer shipments list
const drawerTruckShipments = byId("drawerTruckShipments");

// Partial delivery panel
const partialDeliveryPanel = byId("partialDeliveryPanel");
const partialDeliveredItems = byId("partialDeliveredItems");
const partialTotalItems = byId("partialTotalItems");
const partialItemsHint = byId("partialItemsHint");
const partialReasonSelect = byId("partialReasonSelect");
const partialReassignRemainder = byId("partialReassignRemainder");
const savePartialDeliveryBtn = byId("savePartialDeliveryBtn");
const cancelPartialDeliveryBtn = byId("cancelPartialDeliveryBtn");
const partialSaveOk = byId("partialSaveOk");
const partialSaveWarn = byId("partialSaveWarn");

// SMS modal
const smsModal = byId("smsModal");
const smsPhone = byId("smsPhone");
const smsTracking = byId("smsTracking");
const smsMessage = byId("smsMessage");
const sendSmsBtn = byId("sendSmsBtn");
const closeSmsBtn = byId("closeSmsBtn");

// Create Truck Trip modal
const createTruckTripModal = byId("createTruckTripModal");
const truckTripLabel = byId("truckTripLabel");
const truckTripDriverSelect = byId("truckTripDriverSelect");
const truckTripAutoSmsDefault = byId("truckTripAutoSmsDefault");
const truckTripPauseWeatherDefault = byId("truckTripPauseWeatherDefault");
const confirmCreateTruckTripBtn = byId("confirmCreateTruckTripBtn");
const cancelCreateTruckTripBtn = byId("cancelCreateTruckTripBtn");
const createTruckTripOk = byId("createTruckTripOk");
const createTruckTripWarn = byId("createTruckTripWarn");

// Assign to truck modal
const assignTruckModal = byId("assignTruckModal");
const assignTrackingId = byId("assignTrackingId");
const assignTruckSelect = byId("assignTruckSelect");
const confirmAssignTruckBtn = byId("confirmAssignTruckBtn");
const cancelAssignTruckBtn = byId("cancelAssignTruckBtn");
const assignTruckOk = byId("assignTruckOk");
const assignTruckWarn = byId("assignTruckWarn");

/* ======================================================
   STATE
====================================================== */
let currentUser = null;
let currentUserRole = null;

let unsubShipments = null;
let unsubTrucks = null;

const trucksIndex = new Map();
const driversIndex = new Map();
const shipmentsIndex = new Map();

let tableRows = [];
let unassignedRows = [];

let selectedTruckTripId = null;
let drawerOpen = false;

let smsUsageTimer = null;
let smsContext = null; // { shipmentId, phone, tracking }
let assignContext = null; // { shipmentId, tracking }
let partialShipmentContext = null; // { shipmentId, totalItems }

/* ======================================================
   ROLE GATE
====================================================== */
async function loadRole(uid) {
  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);
  return snap.exists() ? (snap.data()?.role || null) : null;
}

function requireAdminOrManager(role) {
  return role === "admin" || role === "manager";
}

/* ======================================================
   INIT
====================================================== */
boot();

function boot() {
  bindEscToClose({
    modals: [smsModal, assignTruckModal, createTruckTripModal],
    onEsc: () => {
      if (drawerOpen) closeDrawer();
    }
  });

  onAuthStateChanged(auth, async (u) => {
    if (!u) {
      window.location.href = "/admin/login.html";
      return;
    }
    currentUser = u;

    currentUserRole = await loadRole(u.uid);
    if (!requireAdminOrManager(currentUserRole)) {
      alert("Access denied. Admin/Manager only.");
      window.location.href = "/admin/login.html";
      return;
    }

    await preloadDrivers();
    initDelayReasons();
    wireButtons();
    wireBulkUpload();
    wireCsvTemplate();
    wireDrawer();
    wireAssignTruckModal();
    wireSmsModal();
    wireCreateTruckTripModal();
    wirePartialDelivery();
    startRealtime();

    toast("Shipments loaded.", "ok");
  });
}

/* ======================================================
   REALTIME
====================================================== */
function startRealtime() {
  const trucksQ = query(
    collection(db, "truck_trips"),
    orderBy("createdAt", "desc"),
    limit(TRUCKS_LIMIT)
  );

  unsubTrucks = onSnapshot(trucksQ, (snap) => {
    trucksIndex.clear();
    snap.forEach((d) => trucksIndex.set(d.id, { id: d.id, ...d.data() }));
    renderTrucks();
    populateSelects();
    if (selectedTruckTripId) syncDrawerFromState();
  }, (err) => {
    console.error(err);
    setTruckListState("Failed loading trucks.");
  });

  const shipsQ = query(
    collection(db, "tracking_records"),
    orderBy("updatedAt", "desc"),
    limit(SHIPMENTS_LIMIT)
  );

  unsubShipments = onSnapshot(shipsQ, (snap) => {
    shipmentsIndex.clear();
    tableRows = [];
    unassignedRows = [];

    snap.forEach((d) => {
      const row = { id: d.id, ...d.data() };
      shipmentsIndex.set(d.id, row);
      tableRows.push(row);

      const truckTripId = row.truckTripId || row.truckTrip?.id || null;
      if (!truckTripId) unassignedRows.push(row);
    });

    renderShipmentsTable();
    renderUnassigned();
    renderAnalytics();
    if (selectedTruckTripId) renderDrawerShipments(selectedTruckTripId);
  }, (err) => {
    console.error(err);
    setShipmentsTableState("Failed loading shipments.");
  });
}

/* ======================================================
   DRIVERS
====================================================== */
async function preloadDrivers() {
  driversIndex.clear();

  // load driver users (simple; can be upgraded to realtime)
  const qDrivers = query(
    collection(db, "users"),
    where("role", "==", "driver"),
    limit(DRIVERS_LIMIT)
  );

  try {
    const snap = await getDocs(qDrivers);
    snap.forEach((d) => driversIndex.set(d.id, { id: d.id, ...d.data() }));
  } catch (e) {
    console.warn("Driver preload failed:", e);
  }
}

/* ======================================================
   DELAY REASONS
====================================================== */
function initDelayReasons() {
  if (drawerDelayReasonSelect) {
    while (drawerDelayReasonSelect.options.length > 1) drawerDelayReasonSelect.remove(1);
    DEFAULT_DELAY_REASONS.forEach((r) => {
      const opt = document.createElement("option");
      opt.value = r.value;
      opt.textContent = r.label;
      drawerDelayReasonSelect.appendChild(opt);
    });
  }
}

/* ======================================================
   WIRES
====================================================== */
function wireButtons() {
  newShipmentBtn?.addEventListener("click", () => {
    document.dispatchEvent(new CustomEvent("atlas:newShipment"));
  });

  const openCreateTrip = () => openCreateTruckTripModal();
  createTruckTripBtn?.addEventListener("click", openCreateTrip);
  drawerCreateTruckBtn?.addEventListener("click", openCreateTrip);

  refreshTruckViewBtn?.addEventListener("click", () => {
    renderTrucks();
    renderUnassigned();
    renderShipmentsTable();
    if (selectedTruckTripId) syncDrawerFromState();
  });

  openTruckDrawerBtn?.addEventListener("click", () => {
    openDrawer();
    if (!selectedTruckTripId) setDrawerEmpty();
  });

  drawerDelayReasonSelect?.addEventListener("change", () => {
    const ok = !!drawerDelayReasonSelect.value && !!selectedTruckTripId;
    if (drawerApplyDelayBtn) drawerApplyDelayBtn.disabled = !ok;
  });

  drawerApplyDelayBtn?.addEventListener("click", applyDrawerDelay);
  drawerClearDelayBtn?.addEventListener("click", clearDrawerDelay);

  drawerDriverSelect?.addEventListener("change", () => {
    drawerAssignDriverBtn.disabled = !drawerDriverSelect.value || !selectedTruckTripId;
  });

  drawerAssignDriverBtn?.addEventListener("click", assignDrawerDriver);
  drawerUnassignDriverBtn?.addEventListener("click", unassignDrawerDriver);

  drawerAutoSmsToggle?.addEventListener("change", saveDrawerAutoSmsSettings);
  drawerPauseWeatherToggle?.addEventListener("change", saveDrawerAutoSmsSettings);

  drawerPreviewNextSmsBtn?.addEventListener("click", refreshDrawerNextSmsPreview);
}

/* ======================================================
   BULK UPLOAD + TEMPLATE
====================================================== */
function wireCsvTemplate() {
  downloadCsvTemplate?.addEventListener("click", () => {
    const csv =
      "customerName,customerPhone,originCode,destinationCode,originLabel,destinationLabel\n" +
      "Juan Dela Cruz,09171234567,DIVI,TABLAS,Divisoria Warehouse,Odiongan Tablas\n";
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "atlas-shipments-template.csv";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  });
}

function parseCsv(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const cols = line.split(",").map((c) => c.trim());
    const row = {};
    headers.forEach((h, i) => (row[h] = cols[i] ?? ""));
    return row;
  });
}

function wireBulkUpload() {
  bulkFile?.addEventListener("change", () => {
    const f = bulkFile.files?.[0];
    setText(bulkFileName, f ? f.name : "No file selected");
  });

  bulkUploadBtn?.addEventListener("click", async () => {
    const f = bulkFile?.files?.[0];
    if (!f) return alert("Select a CSV file first.");

    bulkUploadBtn.disabled = true;
    setText(bulkResults, "Uploading…");

    try {
      const text = await f.text();
      const rows = parseCsv(text);
      if (!rows.length) throw new Error("No rows found in CSV.");

      const res = await callFn(FN.bulkCreateShipments, { rows });

      setText(
        bulkResults,
        `✅ Uploaded. Created: ${res?.created ?? 0}, Failed: ${res?.failed ?? 0}`
      );
      toast("Bulk upload done.", "ok");
    } catch (e) {
      console.error(e);
      setText(bulkResults, `❌ Upload failed: ${e.message}`);
      alert(e.message);
    } finally {
      bulkUploadBtn.disabled = false;
    }
  });
}

/* ======================================================
   RENDER: TRUCKS + DROP TARGETS
====================================================== */
function setTruckListState(msg) {
  if (!truckList) return;
  truckList.innerHTML = `<div class="state">${escapeHtml(msg)}</div>`;
}

function renderTrucks() {
  if (!truckList) return;

  const trucks = Array.from(trucksIndex.values());
  if (!trucks.length) return setTruckListState("No truck trips yet. Create one.");

  truckList.innerHTML = "";

  trucks.forEach((t) => {
    const isSelected = t.id === selectedTruckTripId;
    const delayActive = !!t.delayReason && !t.delayCleared;

    const driverLabel =
      t.driverName ||
      driversIndex.get(t.driverId || "")?.displayName ||
      "—";

    const card = document.createElement("div");
    card.className = "ship-chip";
    card.style.cursor = "pointer";
    card.style.border = isSelected ? "2px solid #2563eb" : "1px solid var(--border)";
    card.tabIndex = 0;

    card.innerHTML = `
      <div class="top">
        <div class="id">🚚 ${escapeHtml(t.label || "Truck Trip")}</div>
        <div>
          ${
            delayActive
              ? `<span class="badge delayed">⏱ ${escapeHtml(t.delayReason)}</span>`
              : `<span class="badge loaded">✅ Ready</span>`
          }
        </div>
      </div>
      <div class="meta">
        <div><b>ID:</b> ${escapeHtml(t.id)}</div>
        <div><b>Driver:</b> ${escapeHtml(driverLabel)}</div>
        <div><b>Auto-SMS:</b> ${t.autoSmsEnabled ? "ON" : "OFF"} • <b>Weather Pause:</b> ${
          t.pauseDuringWeather ? "ON" : "OFF"
        }</div>
      </div>
    `;

    card.addEventListener("click", () => {
      selectTruck(t.id);
      openDrawer();
    });

    // Drop target: assign shipment to this truck
    bindDropzone(card, {
      outline: "2px dashed #2563eb",
      onDrop: async (payload) => {
        if (!payload?.shipmentId) return;
        if (payload.fromTruckTripId === t.id) return;
        await assignShipmentToTruck(payload.shipmentId, t.id);
      }
    });

    truckList.appendChild(card);
  });
}

/* ======================================================
   RENDER: UNASSIGNED + DROPZONE (unassign)
====================================================== */
function renderUnassigned() {
  if (!unassignedDropzone) return;

  setText(unassignedCountBadge, String(unassignedRows.length || 0));

  if (!unassignedRows.length) {
    unassignedDropzone.innerHTML = `<div class="state">No unassigned shipments.</div>`;
    return;
  }

  unassignedDropzone.innerHTML = "";
  unassignedRows.forEach((s) => {
    const chip = renderShipmentChip(s, { fromTruckTripId: null });
    unassignedDropzone.appendChild(chip);
  });

  bindDropzone(unassignedDropzone, {
    outline: "2px dashed #f59e0b",
    onDrop: async (payload) => {
      if (!payload?.shipmentId) return;
      await unassignShipment(payload.shipmentId);
    }
  });
}

function renderShipmentChip(s, { fromTruckTripId }) {
  const chip = document.createElement("div");
  chip.className = "ship-chip";
  chip.draggable = true;
  chip.tabIndex = 0;

  const tracking = s.trackingNumber || s.trackingId || s.tracking || s.id;
  const customer = s.customerName || "—";
  const status = s.status || "RECEIVED";

  chip.innerHTML = `
    <div class="top">
      <div class="id">${escapeHtml(tracking)}</div>
      <span class="badge ${badgeClassForStatus(status)}">${escapeHtml(status)}</span>
    </div>
    <div class="meta">${escapeHtml(customer)} • ${escapeHtml(s.destinationLabel || s.destinationCode || "")}</div>
  `;

  chip.addEventListener("dragstart", (e) => {
    setDragPayload(e, { shipmentId: s.id, fromTruckTripId: fromTruckTripId || null });
  });

  chip.addEventListener("dblclick", () => {
    openSmsPreviewForShipment(s.id);
  });

  return chip;
}

/* ======================================================
   TABLE
====================================================== */
function setShipmentsTableState(msg) {
  if (!shipmentTable) return;
  shipmentTable.innerHTML = `<tr><td colspan="5" class="state">${escapeHtml(msg)}</td></tr>`;
}

function renderShipmentsTable() {
  if (!shipmentTable) return;

  if (!tableRows.length) return setShipmentsTableState("No shipments found.");

  shipmentTable.innerHTML = "";

  tableRows.forEach((s) => {
    const tracking = s.trackingNumber || s.trackingId || s.tracking || s.id;
    const customer = s.customerName || "—";
    const status = s.status || "RECEIVED";
    const last = fmtDate(s.updatedAt || s.lastUpdatedAt || s.createdAt);

    const truckTripId = s.truckTripId || s.truckTrip?.id || null;
    const isAssigned = !!truckTripId;

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>
        <div style="font-weight:900;">${escapeHtml(tracking)}</div>
        <div style="margin-top:6px;">
          ${
            isAssigned
              ? `<span class="badge loaded">🚚 Assigned</span>`
              : `<span class="badge unassigned">UNASSIGNED</span>`
          }
        </div>
      </td>
      <td>
        <div style="font-weight:700;">${escapeHtml(customer)}</div>
        <div style="color:var(--gray);font-size:12px;margin-top:3px;">${escapeHtml(s.customerPhone || "")}</div>
      </td>
      <td><span class="badge ${badgeClassForStatus(status)}">${escapeHtml(status)}</span></td>
      <td>${escapeHtml(last)}</td>
      <td>
        <div class="row-actions">
          <button class="action-btn primary" data-act="assign" data-id="${s.id}" data-tracking="${escapeHtml(tracking)}">Assign</button>
          <button class="action-btn" data-act="sms" data-id="${s.id}" ${isAssigned ? "" : "disabled"}>SMS</button>
          <button class="action-btn" data-act="truck" data-truck="${truckTripId || ""}" ${isAssigned ? "" : "disabled"}>Truck</button>
        </div>
      </td>
    `;
    shipmentTable.appendChild(tr);
  });

  shipmentTable.querySelectorAll("button[data-act]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const act = btn.dataset.act;
      const shipmentId = btn.dataset.id;

      if (act === "assign") {
        openAssignTruckModal({ shipmentId, tracking: btn.dataset.tracking || shipmentId });
      } else if (act === "sms") {
        await openSmsPreviewForShipment(shipmentId);
      } else if (act === "truck") {
        const tid = btn.dataset.truck || "";
        if (!tid) return;
        selectTruck(tid);
        openDrawer();
      }
    });
  });
}

/* ======================================================
   ANALYTICS
====================================================== */
function renderAnalytics() {
  let stuck = 0;
  let delayed = 0;
  let inTransit = 0;

  tableRows.forEach((s) => {
    const status = String(s.status || "").toUpperCase();

    if (s.stuck === true || s.isStuck === true) stuck++;
    if (status.includes("TRANSIT")) inTransit++;

    const tid = s.truckTripId || s.truckTrip?.id;
    if (tid) {
      const t = trucksIndex.get(tid);
      if (t?.delayReason && !t?.delayCleared) delayed++;
    }
  });

  setText(stuckCount, stuck);
  setText(delayedCount, delayed);
  setText(inTransitCount, inTransit);
}

/* ======================================================
   SELECTS + BREADCRUMB
====================================================== */
function populateSelects() {
  const trucks = Array.from(trucksIndex.values());

  // Assign modal: trucks
  if (assignTruckSelect) {
    assignTruckSelect.innerHTML = `<option value="">Select truck…</option>`;
    trucks.forEach((t) => {
      const opt = document.createElement("option");
      opt.value = t.id;
      opt.textContent = t.label || t.id;
      assignTruckSelect.appendChild(opt);
    });
  }

  // Create modal + drawer: drivers
  const drivers = Array.from(driversIndex.values()).sort((a, b) =>
    String(a.displayName || a.name || "").localeCompare(String(b.displayName || b.name || ""))
  );

  if (truckTripDriverSelect) {
    truckTripDriverSelect.innerHTML = `<option value="">Select driver…</option>`;
    drivers.forEach((d) => {
      const opt = document.createElement("option");
      opt.value = d.id;
      opt.textContent = d.displayName || d.name || d.phone || d.id;
      truckTripDriverSelect.appendChild(opt);
    });
  }

  if (drawerDriverSelect) {
    drawerDriverSelect.innerHTML = `<option value="">Select driver…</option>`;
    drivers.forEach((d) => {
      const opt = document.createElement("option");
      opt.value = d.id;
      opt.textContent = d.displayName || d.name || d.phone || d.id;
      drawerDriverSelect.appendChild(opt);
    });
  }
}

function updateBreadcrumb() {
  if (!breadcrumb) return;

  if (!selectedTruckTripId) {
    breadcrumb.innerHTML = `
      <a href="/admin/dashboard.html">Admin</a>
      <span class="sep">→</span>
      <span class="here">Shipments</span>
    `;
    return;
  }

  const t = trucksIndex.get(selectedTruckTripId);
  const label = t?.label || selectedTruckTripId;

  breadcrumb.innerHTML = `
    <a href="/admin/dashboard.html">Admin</a>
    <span class="sep">→</span>
    <a href="/admin/shipments.html">Shipments</a>
    <span class="sep">→</span>
    <span class="here">${escapeHtml(label)}</span>
  `;
}

function selectTruck(truckTripId) {
  selectedTruckTripId = truckTripId || null;
  renderTrucks();
  updateBreadcrumb();
  if (drawerOpen) syncDrawerFromState();
}

/* ======================================================
   DRAWER
====================================================== */
function wireDrawer() {
  truckDrawerBackdrop?.addEventListener("click", closeDrawer);
  closeTruckDrawerBtn?.addEventListener("click", closeDrawer);
  truckDrawer?.addEventListener("click", (e) => e.stopPropagation());
}

function openDrawer() {
  if (!truckDrawer || !truckDrawerBackdrop) return;
  drawerOpen = true;
  show(truckDrawerBackdrop);
  show(truckDrawer);
  truckDrawer.setAttribute("aria-hidden", "false");
  syncDrawerFromState();
}

function closeDrawer() {
  if (!truckDrawer || !truckDrawerBackdrop) return;
  drawerOpen = false;
  hide(truckDrawerBackdrop);
  hide(truckDrawer);
  truckDrawer.setAttribute("aria-hidden", "true");
  stopSmsUsageAutoRefresh();
}

function setDrawerEmpty() {
  setText(drawerTitle, "📦 Truck");
  setText(drawerSub, "Select a truck to manage shipments and controls.");
  setText(drawerTruckTripId, "—");
  setText(drawerDriverName, "—");
  setText(drawerAutoSmsState, "—");
  setText(drawerWeatherPauseState, "—");

  if (drawerDelayReasonSelect) drawerDelayReasonSelect.value = "";
  if (drawerApplyDelayBtn) drawerApplyDelayBtn.disabled = true;

  if (drawerDriverSelect) drawerDriverSelect.value = "";
  if (drawerAssignDriverBtn) drawerAssignDriverBtn.disabled = true;

  if (drawerAutoSmsToggle) drawerAutoSmsToggle.checked = false;
  if (drawerPauseWeatherToggle) drawerPauseWeatherToggle.checked = false;

  if (drawerNextSmsPreview) drawerNextSmsPreview.value = "";

  if (drawerTruckShipments) {
    drawerTruckShipments.innerHTML = `<div class="state">Select a truck to load shipments…</div>`;
  }

  stopSmsUsageAutoRefresh();
}

function syncDrawerFromState() {
  if (!drawerOpen) return;
  if (!selectedTruckTripId) return setDrawerEmpty();

  const t = trucksIndex.get(selectedTruckTripId);
  if (!t) return setDrawerEmpty();

  setText(drawerTitle, `📦 ${t.label || "Truck Trip"}`);
  setText(drawerSub, t.delayReason && !t.delayCleared ? `⏱ Delayed: ${t.delayReason}` : "Ready");

  setText(drawerTruckTripId, t.id);
  setText(drawerDriverName, t.driverName || driversIndex.get(t.driverId || "")?.displayName || "—");
  setText(drawerAutoSmsState, t.autoSmsEnabled ? "ON" : "OFF");
  setText(drawerWeatherPauseState, t.pauseDuringWeather ? "ON" : "OFF");

  if (drawerDelayReasonSelect) drawerDelayReasonSelect.value = t.delayReason || "";
  if (drawerApplyDelayBtn) drawerApplyDelayBtn.disabled = !(drawerDelayReasonSelect?.value);

  if (drawerDriverSelect) drawerDriverSelect.value = t.driverId || "";
  if (drawerAssignDriverBtn) drawerAssignDriverBtn.disabled = !drawerDriverSelect?.value;

  if (drawerAutoSmsToggle) drawerAutoSmsToggle.checked = !!t.autoSmsEnabled;
  if (drawerPauseWeatherToggle) drawerPauseWeatherToggle.checked = !!t.pauseDuringWeather;

  setText(
    drawerAutoSmsHint,
    t.autoSmsEnabled
      ? "Auto-SMS is enabled. Status updates may trigger customer messages."
      : "Auto-SMS is OFF. Only manual SMS will send."
  );

  renderDrawerShipments(selectedTruckTripId);
  startSmsUsageAutoRefresh();
}

function renderDrawerShipments(truckTripId) {
  if (!drawerTruckShipments) return;

  const ships = tableRows.filter((s) => (s.truckTripId || s.truckTrip?.id || null) === truckTripId);

  if (!ships.length) {
    drawerTruckShipments.innerHTML = `<div class="state">No shipments assigned to this truck yet.</div>`;
    return;
  }

  drawerTruckShipments.innerHTML = "";

  ships.forEach((s) => {
    const chip = renderShipmentChip(s, { fromTruckTripId: truckTripId });

    const actions = document.createElement("div");
    actions.style.display = "flex";
    actions.style.gap = "8px";
    actions.style.marginTop = "8px";
    actions.style.flexWrap = "wrap";

    const btnSms = document.createElement("button");
    btnSms.className = "action-btn";
    btnSms.textContent = "SMS";
    btnSms.addEventListener("click", async (e) => {
      e.stopPropagation();
      await openSmsPreviewForShipment(s.id);
    });

    const btnPartial = document.createElement("button");
    btnPartial.className = "action-btn";
    btnPartial.textContent = "Partial";
    btnPartial.addEventListener("click", (e) => {
      e.stopPropagation();
      openPartialDelivery(s);
    });

    actions.appendChild(btnSms);
    actions.appendChild(btnPartial);
    chip.appendChild(actions);
    drawerTruckShipments.appendChild(chip);
  });
}

/* ======================================================
   DRAWER ACTIONS
====================================================== */
function showHint(el, msg, type = "warn") {
  if (!el) return;
  el.style.display = "block";
  el.classList.remove("warn", "ok");
  el.classList.add(type);
  el.textContent = msg;
}

async function applyDrawerDelay() {
  if (!selectedTruckTripId) return alert("Select a truck first.");
  const reason = drawerDelayReasonSelect?.value || "";
  if (!reason) return;

  drawerApplyDelayBtn.disabled = true;
  showHint(drawerDelayHint, "Applying delay…", "warn");

  try {
    await callFn(FN.setTruckDelay, { truckTripId: selectedTruckTripId, delayReason: reason });
    showHint(drawerDelayHint, "✅ Delay applied.", "ok");
    await refreshDrawerNextSmsPreview();
  } catch (e) {
    showHint(drawerDelayHint, `❌ ${e.message}`, "warn");
    alert(e.message);
  } finally {
    drawerApplyDelayBtn.disabled = false;
  }
}

async function clearDrawerDelay() {
  if (!selectedTruckTripId) return alert("Select a truck first.");

  drawerClearDelayBtn.disabled = true;
  showHint(drawerDelayHint, "Clearing delay…", "warn");

  try {
    await callFn(FN.clearTruckDelay, { truckTripId: selectedTruckTripId });
    showHint(drawerDelayHint, "✅ Delay cleared.", "ok");
    await refreshDrawerNextSmsPreview();
  } catch (e) {
    showHint(drawerDelayHint, `❌ ${e.message}`, "warn");
    alert(e.message);
  } finally {
    drawerClearDelayBtn.disabled = false;
  }
}

async function assignDrawerDriver() {
  if (!selectedTruckTripId) return alert("Select a truck first.");
  const driverId = drawerDriverSelect?.value || "";
  if (!driverId) return;

  drawerAssignDriverBtn.disabled = true;
  try {
    await callFn(FN.assignDriverToTruckTrip, { truckTripId: selectedTruckTripId, driverId });
    toast("Driver assigned.", "ok");
  } catch (e) {
    alert(e.message);
  } finally {
    drawerAssignDriverBtn.disabled = false;
  }
}

async function unassignDrawerDriver() {
  if (!selectedTruckTripId) return alert("Select a truck first.");

  drawerUnassignDriverBtn.disabled = true;
  try {
    await callFn(FN.unassignDriverFromTruckTrip, { truckTripId: selectedTruckTripId });
    toast("Driver unassigned.", "ok");
  } catch (e) {
    alert(e.message);
  } finally {
    drawerUnassignDriverBtn.disabled = false;
  }
}

async function saveDrawerAutoSmsSettings() {
  if (!selectedTruckTripId) return;

  const enabled = !!drawerAutoSmsToggle?.checked;
  const pauseDuringWeather = !!drawerPauseWeatherToggle?.checked;

  setText(
    drawerAutoSmsHint,
    enabled
      ? "Auto-SMS is enabled. Status updates may trigger customer messages."
      : "Auto-SMS is OFF. Only manual SMS will send."
  );

  try {
    await callFn(FN.setTruckAutoSmsSettings, {
      truckTripId: selectedTruckTripId,
      autoSmsEnabled: enabled,
      pauseDuringWeather
    });
    toast("Auto-SMS settings saved.", "ok");
  } catch (e) {
    alert(e.message);
  }
}

async function refreshDrawerNextSmsPreview() {
  if (!selectedTruckTripId || !drawerNextSmsPreview) return;
  drawerNextSmsPreview.value = "Loading preview…";
  try {
    const res = await callFn(FN.previewNextSms, { truckTripId: selectedTruckTripId });
    drawerNextSmsPreview.value = res?.message || "No preview returned.";
  } catch (e) {
    drawerNextSmsPreview.value = `Preview unavailable: ${e.message}`;
  }
}

/* ======================================================
   SMS USAGE REFRESH
====================================================== */
function startSmsUsageAutoRefresh() {
  if (!drawerOpen || !selectedTruckTripId) return;
  stopSmsUsageAutoRefresh();

  const tick = async () => {
    if (!drawerOpen || !selectedTruckTripId) return;

    try {
      const res = await callFn(FN.getTruckSmsUsage, { truckTripId: selectedTruckTripId });

      const autoCount = Number(res?.autoCount ?? 0);
      const manualCount = Number(res?.manualCount ?? 0);
      const total = autoCount + manualCount;

      const autoPctVal = total ? Math.round((autoCount / total) * 100) : 0;
      const manualPctVal = total ? Math.round((manualCount / total) * 100) : 0;

      if (drawerAutoFill) drawerAutoFill.style.width = `${autoPctVal}%`;
      if (drawerManualFill) drawerManualFill.style.width = `${manualPctVal}%`;
      setText(drawerAutoPct, `${autoPctVal}%`);
      setText(drawerManualPct, `${manualPctVal}%`);
      setText(drawerSmsUsageHint, `Auto: ${autoCount} • Manual: ${manualCount} • Total: ${total}`);
    } catch (e) {
      setText(drawerSmsUsageHint, `Usage unavailable: ${e.message}`);
    }
  };

  tick();
  smsUsageTimer = setInterval(tick, SMS_USAGE_REFRESH_MS);
}

function stopSmsUsageAutoRefresh() {
  if (smsUsageTimer) clearInterval(smsUsageTimer);
  smsUsageTimer = null;
}

/* ======================================================
   ASSIGN / UNASSIGN
====================================================== */
async function assignShipmentToTruck(shipmentId, truckTripId) {
  try {
    await callFn(FN.assignShipmentToTruckTrip, { shipmentId, truckTripId });
    toast("Shipment assigned.", "ok");
  } catch (e) {
    alert(e.message);
  }
}

async function unassignShipment(shipmentId) {
  try {
    await callFn(FN.unassignShipmentFromTruckTrip, { shipmentId });
    toast("Shipment unassigned.", "ok");
  } catch (e) {
    alert(e.message);
  }
}

/* ======================================================
   ASSIGN MODAL
====================================================== */
function wireAssignTruckModal() {
  cancelAssignTruckBtn?.addEventListener("click", closeAssignTruckModal);

  confirmAssignTruckBtn?.addEventListener("click", async () => {
    if (!assignContext) return;

    const truckTripId = assignTruckSelect?.value || "";
    if (!truckTripId) return;

    confirmAssignTruckBtn.disabled = true;
    showInline(assignTruckWarn, "");
    showInline(assignTruckOk, "Assigning…");

    try {
      await assignShipmentToTruck(assignContext.shipmentId, truckTripId);
      showInline(assignTruckOk, "✅ Assigned.");
      setTimeout(closeAssignTruckModal, 450);
    } catch (e) {
      showInline(assignTruckOk, "");
      showInline(assignTruckWarn, `❌ ${e.message}`);
    } finally {
      confirmAssignTruckBtn.disabled = false;
    }
  });

  assignTruckSelect?.addEventListener("change", () => {
    confirmAssignTruckBtn.disabled = !assignTruckSelect.value;
  });

  assignTruckModal?.addEventListener("click", (e) => {
    if (e.target === assignTruckModal) closeAssignTruckModal();
  });
}

function openAssignTruckModal({ shipmentId, tracking }) {
  assignContext = { shipmentId, tracking };
  showInline(assignTruckOk, "");
  showInline(assignTruckWarn, "");

  if (assignTrackingId) assignTrackingId.value = tracking || shipmentId;
  populateSelects();
  if (assignTruckSelect) assignTruckSelect.value = "";
  confirmAssignTruckBtn.disabled = true;

  show(assignTruckModal);
}

function closeAssignTruckModal() {
  hide(assignTruckModal);
  assignContext = null;
}

function showInline(el, msg) {
  if (!el) return;
  el.style.display = msg ? "block" : "none";
  el.textContent = msg || "";
}

/* ======================================================
   CREATE TRUCK TRIP MODAL
====================================================== */
function wireCreateTruckTripModal() {
  cancelCreateTruckTripBtn?.addEventListener("click", closeCreateTruckTripModal);

  confirmCreateTruckTripBtn?.addEventListener("click", async () => {
    const label = truckTripLabel?.value?.trim() || "";
    if (!label) return showInline(createTruckTripWarn, "Enter a truck label/name.");

    confirmCreateTruckTripBtn.disabled = true;
    showInline(createTruckTripWarn, "");
    showInline(createTruckTripOk, "Creating…");

    try {
      const driverId = truckTripDriverSelect?.value || null;
      const autoSmsEnabled = !!truckTripAutoSmsDefault?.checked;
      const pauseDuringWeather = !!truckTripPauseWeatherDefault?.checked;

      const res = await callFn(FN.createTruckTrip, { label, driverId, autoSmsEnabled, pauseDuringWeather });

      showInline(createTruckTripOk, "✅ Created truck trip.");
      if (res?.truckTripId) {
        selectTruck(res.truckTripId);
        openDrawer();
      }

      setTimeout(closeCreateTruckTripModal, 450);
    } catch (e) {
      showInline(createTruckTripOk, "");
      showInline(createTruckTripWarn, `❌ ${e.message}`);
    } finally {
      confirmCreateTruckTripBtn.disabled = false;
    }
  });

  createTruckTripModal?.addEventListener("click", (e) => {
    if (e.target === createTruckTripModal) closeCreateTruckTripModal();
  });
}

function openCreateTruckTripModal() {
  showInline(createTruckTripOk, "");
  showInline(createTruckTripWarn, "");
  if (truckTripLabel) truckTripLabel.value = "";
  populateSelects();
  show(createTruckTripModal);
}

function closeCreateTruckTripModal() {
  hide(createTruckTripModal);
}

/* ======================================================
   SMS MODAL
====================================================== */
function wireSmsModal() {
  closeSmsBtn?.addEventListener("click", closeSmsModal);

  smsModal?.addEventListener("click", (e) => {
    if (e.target === smsModal) closeSmsModal();
  });

  sendSmsBtn?.addEventListener("click", async () => {
    if (!smsContext) return;
    sendSmsBtn.disabled = true;

    try {
      await callFn(FN.sendManualSms, { shipmentId: smsContext.shipmentId });
      alert("✅ SMS sent.");
      closeSmsModal();
    } catch (e) {
      alert(`❌ SMS failed: ${e.message}`);
    } finally {
      sendSmsBtn.disabled = false;
    }
  });
}

async function openSmsPreviewForShipment(shipmentId) {
  const s = shipmentsIndex.get(shipmentId);
  if (!s) return alert("Shipment not found.");

  const phone = s.customerPhone || s.phone || "";
  const tracking = s.trackingNumber || s.trackingId || s.tracking || shipmentId;

  smsContext = { shipmentId, phone, tracking };

  setText(smsPhone, phone || "—");
  setText(smsTracking, tracking || "—");
  if (smsMessage) smsMessage.value = "Loading preview…";

  show(smsModal);

  try {
    const res = await callFn(FN.previewManualSms, { shipmentId });
    if (smsMessage) smsMessage.value = res?.message || "No preview returned.";
  } catch (e) {
    if (smsMessage) smsMessage.value = `Preview unavailable: ${e.message}`;
  }
}

function closeSmsModal() {
  hide(smsModal);
  smsContext = null;
  if (smsMessage) smsMessage.value = "";
}

/* ======================================================
   PARTIAL DELIVERY
====================================================== */
function wirePartialDelivery() {
  cancelPartialDeliveryBtn?.addEventListener("click", closePartialDelivery);

  savePartialDeliveryBtn?.addEventListener("click", async () => {
    if (!partialShipmentContext) return;

    const delivered = Number(partialDeliveredItems?.value ?? 0);
    const total = Number(partialShipmentContext.totalItems ?? 0);

    partialSaveOk.style.display = "none";
    partialSaveWarn.style.display = "none";

    if (!Number.isFinite(delivered) || delivered < 0) return showPartialWarn("Invalid delivered items.");
    if (!Number.isFinite(total) || total <= 0) return showPartialWarn("Total items missing. Set itemsCount on shipment.");
    if (delivered > total) return showPartialWarn("Delivered items cannot exceed total items.");

    const reason = partialReasonSelect?.value || "";
    if (!reason) return showPartialWarn("Select a reason.");

    savePartialDeliveryBtn.disabled = true;

    try {
      await callFn(FN.recordPartialDelivery, {
        shipmentId: partialShipmentContext.shipmentId,
        deliveredItems: delivered,
        totalItems: total,
        reason,
        reassignRemainder: !!partialReassignRemainder?.checked
      });

      showPartialOk("✅ Partial delivery saved.");
      setTimeout(closePartialDelivery, 800);
    } catch (e) {
      showPartialWarn(`❌ ${e.message}`);
    } finally {
      savePartialDeliveryBtn.disabled = false;
    }
  });
}

function openPartialDelivery(shipment) {
  const total = Number(shipment.itemsCount ?? shipment.totalItems ?? shipment.packageCount ?? 0);
  partialShipmentContext = { shipmentId: shipment.id, totalItems: total };

  if (partialTotalItems) partialTotalItems.value = total ? String(total) : "";
  if (partialDeliveredItems) partialDeliveredItems.value = "";
  if (partialReasonSelect) partialReasonSelect.value = "";
  if (partialReassignRemainder) partialReassignRemainder.checked = true;

  setText(partialItemsHint, total ? "Enter how many items delivered now." : "⚠️ This shipment has no itemsCount set.");
  partialDeliveryPanel.style.display = "block";
}

function closePartialDelivery() {
  partialDeliveryPanel.style.display = "none";
  partialShipmentContext = null;
}

function showPartialOk(msg) {
  partialSaveOk.style.display = "block";
  partialSaveOk.textContent = msg;
  partialSaveWarn.style.display = "none";
}

function showPartialWarn(msg) {
  partialSaveWarn.style.display = "block";
  partialSaveWarn.textContent = msg;
  partialSaveOk.style.display = "none";
}
