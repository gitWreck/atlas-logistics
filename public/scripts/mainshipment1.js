let liveLoader, liveLoaderText;

window.startMainShipment = async function () {
  console.log("🚚 Atlas Main Shipment system online");

  // Bind loader UI
  liveLoader = document.getElementById("liveLoader");
  liveLoaderText = document.getElementById("liveLoaderText");

  if (!window.db) {
    console.error("❌ Firestore not ready – aborting start");
    if (liveLoaderText) liveLoaderText.textContent = "firestore failed";
    return;
  }

  console.log("🔥 Firestore OK");

  startLiveShipments();
};



  // HARD RESET
  window.selectedTrip = null;
  window.selectedPackages = [];
  window.pendingUnload = false;
  window.pendingAction = null;

  sessionStorage.removeItem("selectedTrip");
  sessionStorage.removeItem("selectedPackages");
  sessionStorage.removeItem("pendingUnload");
  sessionStorage.removeItem("pendingAction");

  if (liveLoader) liveLoader.classList.add("hidden");

  console.log("✅ UI boot OK");

  // then ALL your existing code continues...

/** Status steps (mini timeline) */
const STEPS = [
  { key: "RECEIVED", label: "Received" },
  { key: "LOADED", label: "Loaded" },
  { key: "IN_TRANSIT", label: "In Transit" },
  { key: "ARRIVED_PORT", label: "Arrived Port" },
  { key: "BOARDED_RORO", label: "Boarded RORO" },
  { key: "OUT_FOR_DELIVERY", label: "Out for Delivery" },
  { key: "DELIVERED", label: "Delivered" }
];

const FILTERS = [
  { key: "ALL", label: "All", tone: "gray" },
  { key: "ACTIVE", label: "Active", tone: "blue" },
  { key: "DELAYED", label: "Delayed", tone: "yellow" },
  { key: "WEATHER", label: "🌦 Weather", tone: "yellow" },
  { key: "RORO", label: "🚢 RORO", tone: "yellow" },
  { key: "UNASSIGNED", label: "Unassigned", tone: "gray" },
  { key: "DELIVERED", label: "Delivered", tone: "green" }
];


function buildStatusSelect(current) {
  const sel = document.createElement("select");
  sel.id = "statusSelect";

  STEPS.forEach(s => {
    const opt = document.createElement("option");
    opt.value = s.key;
    opt.textContent = s.label;
    sel.appendChild(opt);
  });

  sel.value = current || "RECEIVED";
  return sel;
}


const $ = (id) => document.getElementById(id);

const tbody = document.querySelector("#shipmentsTable tbody");

const q = $("q");
const chips = $("chips");
const meta = $("meta");
const clock = $("clock");
const scrim = $("scrim");
const drawer = $("drawer");
const toast = $("toast");
const toastText = $("toastText");

function must(el, name){
  if(!el){
    console.error("❌ Missing DOM element:", name);
    return false;
  }
  return true;
}

must(tbody, "shipmentsTable tbody");
must(q, "q");
must(chips, "chips");
must(meta, "meta");
must(clock, "clock");
must(scrim, "scrim");
must(drawer, "drawer");
must(toast, "toast");
must(toastText, "toastText");



// Global board state used by live listener + renderers
let activeFilter = "ALL";
let selectedId = null;
let liveReady = false;
let liveError = null;
let SHIPMENTS = [];
const delayMemory = new Map();
let firstLiveLoad = true;
const roroMemory = new Map();      // tripId → boarded?
const weatherMemory = new Map();   // tripId → wasWeatherDelayed
const arrivalMemory = new Map();   // tripId → arrived?
const db = window.db;

// ==============================
// Cloud Functions (Phase 3 Wiring)
// ==============================

const loadItemsToTripCF = firebase.functions().httpsCallable("loadItemsToTrip");
const unloadItemsFromTripCF = firebase.functions().httpsCallable("unloadItemsFromTrip");
const recordPartialCF = firebase.functions().httpsCallable("recordPartial");
const markDeliveredCF = firebase.functions().httpsCallable("markDelivered");
const completeTripCF = firebase.functions().httpsCallable("completeTrip");


// ==============================
// MARK DELIVERED (UI Layer)
// ==============================
window.markDelivered = async function ({ tripDocId, pkgId, trackingDocId }) {
  if (!tripDocId || !pkgId || !trackingDocId) {
    throw new Error("Trip or Package not wired");
  }

  const tripRef = db.collection("truck_trips").doc(tripDocId);
  const pkgRef = tripRef.collection("trip_packages").doc(pkgId);
  const trackingRef = db.collection("tracking_records").doc(trackingDocId);

  const now = firebase.firestore.FieldValue.serverTimestamp();

  await pkgRef.collection("status_events").add({
    fromStatus: "IN_TRANSIT",
    toStatus: "DELIVERED",
    createdAt: now,
    byRole: window.MY_ROLE,
    byUid: auth.currentUser.uid
  });

  await pkgRef.update({
    active: false,
    deliveredAt: now,
    lastUpdatedAt: now
  });

  await trackingRef.update({
    status: "DELIVERED",
    updatedAt: now
  });

  showToast("📦 Package marked as delivered");
};



// Toast helper (shared across scripts)
let toastTimer = null;
function showToast(text){
  toastText.textContent = text;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 2400);
}

let MY_ROLE = null;

function waitForRole() {
  return new Promise(resolve => {
    const i = setInterval(() => {
      if (window.MY_ROLE) {
        clearInterval(i);
        MY_ROLE = window.MY_ROLE;
        resolve(MY_ROLE);
      }
    }, 50);
  });
}


/** Helpers */
function nowISO(){ return new Date().toISOString(); }
function fmtTime(ts){
  const d = new Date(ts);
  return d.toLocaleString(undefined, { month:"short", day:"2-digit", hour:"2-digit", minute:"2-digit" });
}
function minutesAgo(ts){
  const ms = Date.now() - new Date(ts).getTime();
  return Math.max(0, Math.round(ms/60000));
}
function ageLabel(ts){
  const m = minutesAgo(ts);
  if (m < 2) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m/60);
  const r = m % 60;
  if (h < 24) return `${h}h ${r}m ago`;
  const d = Math.floor(h/24);
  const hh = h % 24;
  return `${d}d ${hh}h ago`;
}
function toneForShipment(s){
  if (s.status === "DELIVERED") return "green";
  if (s.delayReason && !s.delayCleared) return "yellow";
  return "blue";
}
function statusPillClass(s){
  const tone = toneForShipment(s);
  if (tone === "green") return "pill green";
  if (tone === "yellow") return "pill yellow";
  return "pill blue";
}
function statusLabel(key){
  const step = STEPS.find(x => x.key === key);
  return step ? step.label : key;
}
function delayBadge(s){
  if (!s.delayReason || s.delayCleared) return { cls:"badge none", text:"—", icon:"" };
  const r = String(s.delayReason).toUpperCase();
  if (r.includes("WEATHER")) return { cls:"badge weather", text:"Weather", icon:"🌦", anim:"weather" };
  if (r.includes("RORO") || r.includes("VESSEL")) return { cls:"badge roro", text:"Waiting RORO", icon:"🚢", anim:"roro" };
  return { cls:"badge roro", text:"Delayed", icon:"⚠️", anim:"" };
}
function matchesQuery(s, query){
  if (!query) return true;
  const hay = [
    s.trackingNumber, s.route, s.routeCode, s.status,
    s.delayReason || "", s.trip || "", s.owner || "",
    s.sender || "", s.recipient || "", s.phone || ""
  ].join(" ").toLowerCase();
  return hay.includes(query.toLowerCase());
}
function passesFilter(s){
  const f = activeFilter;
  if (f === "ALL") return true;
  if (f === "ACTIVE") return s.status !== "DELIVERED";
  if (f === "DELIVERED") return s.status === "DELIVERED";
  if (f === "DELAYED") return !!(s.delayReason && !s.delayCleared);
  if (f === "WEATHER") return !!(s.delayReason && String(s.delayReason).toUpperCase().includes("WEATHER") && !s.delayCleared);
  if (f === "RORO") return !!(s.delayReason && (String(s.delayReason).toUpperCase().includes("RORO") || String(s.delayReason).toUpperCase().includes("VESSEL")) && !s.delayCleared);
  if (f === "UNASSIGNED") return !s.trip;
  return true;
}

function normalizeStatus(raw) {
  if (!raw) return "";

  const s = String(raw)
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "_");   // "In Transit" → "IN_TRANSIT"

  const MAP = {
    "RECEIVED": "RECEIVED",

    "LOADED": "LOADED",

    "IN_TRANSIT": "IN_TRANSIT",
    "IN-TRANSIT": "IN_TRANSIT",
    "INTRANSIT": "IN_TRANSIT",

    "AT_PORT": "ARRIVED_PORT",
    "ATPORT": "ARRIVED_PORT",
    "ARRIVED_PORT": "ARRIVED_PORT",
    "ARRIVEDPORT": "ARRIVED_PORT",

    "BOARDED_RORO": "BOARDED_RORO",
    "BOARDED_RORO_VESSEL": "BOARDED_RORO",
    "RORO": "BOARDED_RORO",

    "OUT_FOR_DELIVERY": "OUT_FOR_DELIVERY",
    "OUTFORDELIVERY": "OUT_FOR_DELIVERY",

    "DELIVERED": "DELIVERED"
  };

  return MAP[s] || s;
}

//buildMiniTimeline//
function buildMiniTimeline(s){
  const tone = toneForShipment(s);
  const stepsDone = new Set(s.stepsDone || []);
  const active = normalizeStatus(s.status);

  const idx = Math.max(0, STEPS.findIndex(x => x.key === active));
  const denom = Math.max(1, STEPS.length - 1);
  const pct = Math.min(100, Math.max(0, Math.round((idx / denom) * 100)));

  const el = document.createElement("div");
  el.className = "timeline";
  el.dataset.tone = tone;

 for (let i = 0; i < STEPS.length; i++){
  const step = STEPS[i];

  const node = document.createElement("div");
  node.className = "tNode";

  if (stepsDone.has(step.key)) node.classList.add("done");

  if (step.key === active) {
    node.classList.add("active","pulse");
  }

  // ⚠️ DELAY OVERRIDE
  if (step.key === active && s.delayReason && !s.delayCleared) {
    node.classList.add("delayed");

    const r = String(s.delayReason).toUpperCase();
    if (r.includes("WEATHER")) node.classList.add("weather");
    if (r.includes("RORO")) node.classList.add("roro");
  }

  node.title = step.label;
  el.appendChild(node);

    // connector
    if (i < STEPS.length - 1) {
      const bar = document.createElement("div");
      bar.className = "tBar";

      if (i < idx) bar.classList.add("done");
      if (i === idx - 1) bar.classList.add("active");

      el.appendChild(bar);
    }
  }

  return el;
}




/** Render chips */
function renderChips(){
  if (!chips) return;
  chips.innerHTML = "";
  for (const f of FILTERS){
    const c = document.createElement("div");
    c.className = `chip ${f.tone}`;
    c.dataset.key = f.key;
    c.dataset.active = (f.key === activeFilter) ? "true" : "false";
    c.innerHTML = `<span class="dot"></span><span>${f.label}</span>`;
    c.onclick = () => {
      activeFilter = f.key;
      renderChips();
      render();
    };
    chips.appendChild(c);
  }
}

/** Render table */
function render(){
  const query = q ? q.value.trim() : "";
  const list = SHIPMENTS
    .filter(s => passesFilter(s))
    .filter(s => matchesQuery(s, query))
    .sort((a,b) => new Date(b.lastUpdateAt) - new Date(a.lastUpdateAt)); // newest first

  meta.textContent = `${list.length} shown · ${SHIPMENTS.length} total`;

  tbody.innerHTML = "";
  for (const s of list){

  
    const tone = toneForShipment(s);
    const tr = document.createElement("tr");
    tr.dataset.id = s.id;

    // Row click opens drawer
    tr.addEventListener("click", (e) => {
      // ignore if click on action buttons
      if (e.target.closest(".iconBtn")) return;
      openDrawer(s.id);
    });

   // Cell 1: Trip Summary (PRIMARY ROW)
const td1 = document.createElement("td");
td1.className = "rowStripe";
td1.dataset.tone = tone;

// Format trip date (trip startedAt)
function fmtTripDate(ts){
  if (!ts) return "—";

  // Firestore Timestamp
  if (ts.seconds) ts = ts.seconds * 1000;

  const d = new Date(ts);
  if (isNaN(d)) return "—";

  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "2-digit",
    year: "numeric"
  });
}

const tripDate = fmtTripDate(
  s.startedAt || 
  s.createdAt || 
  s.updatedAt
);


const sig = document.createElement("div");
sig.className = "signal";
sig.innerHTML = `
  <div class="sigDot ${tone}"></div>

  <div class="trk">
    <div class="mini" style="opacity:.85;">
      ${escapeHtml(tripDate)}
    </div>

    <div class="id mono">
      ${escapeHtml(s.trip || "—")}
    </div>

    <div class="mini">
      Driver: <span class="mono">${escapeHtml(s.driverName || "—")}</span>
    </div>

    <div class="mini">
      📦 Total Loaded: <span class="mono">${escapeHtml(String(s.packageCount ?? "—"))}</span>
    </div>

    <div class="mini">
      <span class="${statusPillClass(s)}">${escapeHtml(statusLabel(s.status))}</span>
    </div>
  </div>
`;
td1.appendChild(sig);


    // Cell 2: Route
    const td2 = document.createElement("td");
    td2.innerHTML = `<div class="mono" style="opacity:.92;">${escapeHtml(s.route)}</div>
                     <div style="margin-top:6px; color: var(--muted); font-size:12px;">${escapeHtml(s.routeCode || "")}</div>`;

    // Cell 3: Timeline
    const td3 = document.createElement("td");
    td3.appendChild(buildMiniTimeline(s));

/* Cell 4: Delay */
const td4 = document.createElement("td");
const d = delayBadge(s);

let icon = "";
if (d.anim === "weather") icon = `<span class="animWeather">🌦</span>`;
if (d.anim === "roro") icon = `<span class="animRoro">🚢</span>`;

if (!s.delayReason || s.delayCleared) {
  td4.innerHTML = `
    <div class="delay">
      <div class="badge none">—</div>
    </div>
  `;
} else {
  td4.innerHTML = `
    <div class="delay">
      <div class="${d.cls}">
        ${icon}
        ${escapeHtml(d.text)}
      </div>
      <div class="since">
        Since ${fmtTime(s.delayStartedAt)}
      </div>
    </div>
  `;
}




    // Cell 6: Last
    const td6 = document.createElement("td");
    td6.className = "age";
    td6.innerHTML = `<div class="mono">${escapeHtml(ageLabel(s.lastUpdateAt))}</div>
                     <div class="small">${escapeHtml(fmtTime(s.lastUpdateAt))}</div>`;

    // Cell 7: Actions
    const td7 = document.createElement("td");
    td7.style.textAlign = "right";
    const actions = document.createElement("div");
    actions.className = "actions";
    actions.innerHTML = `
      <button class="iconBtn" title="Preview Next SMS" data-act="preview">📩</button>
      <button class="iconBtn" title="Manual SMS" data-act="manual">✉️</button>
      <button class="iconBtn" title="Details" data-act="open">⟡</button>
    `;
    actions.querySelector('[data-act="preview"]').onclick = (e) => { e.stopPropagation(); mockAction(`Preview Next SMS for ${s.trackingNumber}`); };
    actions.querySelector('[data-act="manual"]').onclick = (e) => { e.stopPropagation(); mockAction(`Manual SMS for ${s.trackingNumber}`); };
    actions.querySelector('[data-act="open"]').onclick = (e) => { e.stopPropagation(); openDrawer(s.id); };
    td7.appendChild(actions);

    tr.appendChild(td1); // Trip summary (LEFT)
    tr.appendChild(td2); // Route
    tr.appendChild(td3); // Status flow
    tr.appendChild(td4); // Delay
    tr.appendChild(td6); // Last
    tr.appendChild(td7); // Actions


    tbody.appendChild(tr);
  }

  // keep drawer in sync if open
  if (selectedId){
    const exists = SHIPMENTS.find(x => x.id === selectedId);
    if (!exists) closeDrawer();
  }
}

window.render = render;

/** Drawer */
// 🔌 Wire buttons for all actions
function openDrawer(id){
  const s = SHIPMENTS.find(x => x.id === id);
  if (!s) return;

  // 🔌 Wire buttons for all actions
  document.querySelectorAll("#drawer [data-act]").forEach(btn => {
   btn.dataset.trip = s.tripDocId || "";
btn.dataset.trk = (s.pkg && s.pkg.id) ? s.pkg.id : "";
btn.dataset.tracking = s.id;

// expose full state for debugging + actions
window._drawerState = {
  trackingId: s.id,
  tripDocId: s.tripDocId || null,
  pkgId: s.pkg ? s.pkg.id : null,
  status: s.status,
  stepsDone: s.stepsDone || []
};

console.log("📦 Drawer wired:", window._drawerState);
});


  selectedId = id;

  $("d_id").textContent = s.trackingNumber;
  $("d_route").textContent = s.route;
  $("d_status").textContent = statusLabel(s.status);
  $("d_status").className = statusPillClass(s);

  $("d_last").textContent = `${ageLabel(s.lastUpdateAt)} · ${fmtTime(s.lastUpdateAt)}`;
  $("d_trip").textContent = s.trip || "—";
  $("d_owner").textContent = s.owner || "—";

  const d = delayBadge(s);
  if (!s.delayReason || s.delayCleared){
    $("d_delay").textContent = "—";
  } else {
    $("d_delay").textContent = `${d.icon ? d.icon + " " : ""}${d.text} · since ${fmtTime(s.delayStartedAt)}`;
  }

  $("d_verified").textContent =
  s.verifiedBy
    ? `${s.verifiedBy.name} (${s.verifiedBy.role})`
    : "—";

  // Build expanded timeline (simple, readable)
  const dt = $("d_timeline");
  dt.innerHTML = "";
  const wrap = document.createElement("div");
  wrap.style.display = "grid";
  wrap.style.gap = "10px";

  const idx = Math.max(0, STEPS.findIndex(x => x.key === s.status));
  for (let i=0; i<STEPS.length; i++){
    const step = STEPS[i];
    const line = document.createElement("div");
    line.style.display = "flex";
    line.style.alignItems = "center";
    line.style.gap = "10px";

    const tone = toneForShipment(s);
    const dot = document.createElement("div");
    dot.style.width = "10px";
    dot.style.height = "10px";
    dot.style.borderRadius = "99px";
    dot.style.background = (i < idx) ? "rgba(255,255,255,.35)" : "rgba(255,255,255,.18)";
    dot.style.boxShadow = "inset 0 0 0 1px rgba(255,255,255,.12)";
    if (i === idx){
      dot.style.background = (tone === "yellow") ? "var(--yellow)" : (tone === "green" ? "var(--green)" : "var(--blue)");
      dot.style.boxShadow = (tone === "yellow") ? "var(--glow-yellow)" : (tone === "green" ? "var(--glow-green)" : "var(--glow-blue)");
    }

    const label = document.createElement("div");
    label.textContent = step.label;
    label.style.color = (i <= idx) ? "rgba(234,240,255,.92)" : "rgba(234,240,255,.62)";
    label.style.fontSize = "13px";

    line.appendChild(dot);
    line.appendChild(label);
    wrap.appendChild(line);
  }
  dt.appendChild(wrap);

  // Open
  scrim.classList.add("open");
  drawer.classList.add("open");
  drawer.setAttribute("aria-hidden","false");
}

/** Close drawer */
function closeDrawer(){
  selectedId = null;
  scrim.classList.remove("open");
  drawer.classList.remove("open");
  drawer.setAttribute("aria-hidden","true");
}

if (scrim) {
  scrim.addEventListener("click", closeDrawer);
}

const closeBtn = $("closeDrawer");
if (closeBtn) {
  closeBtn.addEventListener("click", closeDrawer);
}

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeDrawer();
  if (e.key === "/" && q && document.activeElement !== q) {
    e.preventDefault();
    q.focus();
  }
});


/** Mock actions */
function mockAction(text){
  showToast(text);
}

/** Drawer action buttons */

/** Search events */
let searchTimer = null;
if (q) {
  q.addEventListener("input", () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(render, 60);
  });
}

/** Clock */
function tickClock(){
  if (!clock) return;
  const d = new Date();
  clock.textContent = d.toLocaleString(undefined, { weekday:"short", hour:"2-digit", minute:"2-digit" });
}

tickClock();
setInterval(tickClock, 10000);


/** Escape HTML */
function escapeHtml(str){
  return String(str ?? "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

/** Init */
renderChips();
// startLiveShipments();  ❌ DO NOT auto-start here


/* =========================
   MODAL HELPERS (LOCK SAFE)
========================= */

const modal = document.getElementById("atlasModal");
const modalTitle = document.getElementById("atlasModalTitle");
const modalBody = document.getElementById("atlasModalBody");
const modalActions = document.getElementById("atlasModalActions");
const modalBackdrop = modal.querySelector(".atlas-modal__backdrop");
const modalClose = document.getElementById("atlasModalClose");

let modalLocked = false;

/* Close button */
modalClose.onclick = () => {
  if (!modalLocked) modal.hidden = true;
};

/* Backdrop click */
modalBackdrop.onclick = () => {
  if (!modalLocked) modal.hidden = true;
};

/* Open modal */
function openModal({ title, bodyHTML, actions = [], lock = false }) {
  modalLocked = lock;

  modalTitle.textContent = title || "Atlas";
  modalBody.innerHTML = bodyHTML || "";
  modalActions.innerHTML = "";

  actions.forEach(a => {
    const b = document.createElement("button");
    b.className = `btnx ${a.variant || "neutral"}`;
    b.textContent = a.label;

    b.onclick = async () => {
      if (a.onClick) await a.onClick();
    };

    modalActions.appendChild(b);
  });

  modal.hidden = false;
}


function openUnloadModal({ tripDocId, trackingDocId }) {
  const requireReason = MY_ROLE === "manager";

  openModal({
    title: "Unload Items",
    lock: true,
    bodyHTML: `
      <p>Unload selected items back to warehouse.</p>
      ${requireReason ? `
        <textarea id="unloadReason"
          placeholder="Required: reason for unloading"
          style="width:100%;min-height:80px;margin-top:10px"></textarea>
      ` : ""}
    `,
    actions: [
      {
        label: "Unload",
        variant: "danger",
        onClick: async () => {
          const el = document.getElementById("unloadReason");
          const reason = el ? el.value.trim() : null;

          if (requireReason && !reason) {
            showMiniToast("Reason is required", "err");
            return;
          }

          await unloadItemsFromTripFn({
            tripDocId,
            trackingDocId,
            reason
          });

          modal.hidden = true;
          showMiniToast("Items unloaded");
        }
      },
      {
        label: "Cancel",
        onClick: () => modal.hidden = true
      }
    ]
  });
}


/* =========================
   INLINE DUPLICATE PREVIEW
========================= */

// normalize helpers (MATCH BACKEND LOGIC)
function normPhone(p){
  return String(p||"")
    .replace(/[^\d]/g,"")
    .replace(/^09/,"63");
}

function normKey(v){
  return String(v||"").trim().toUpperCase();
}

// 🔍 Build duplicate fingerprint
function buildFingerprint(row){
  return [
    normPhone(row.customerPhone),
    normKey(row.originCode),
    normKey(row.destinationCode)
  ].join("|");
}

// 🔎 Scan rows locally (CSV preview stage)
function scanDuplicates(rows){
  const seen = new Map();
  const duplicates = [];

  rows.forEach((r, i) => {
    const key = buildFingerprint(r);
    if (!key || key === "||") return;

    if (seen.has(key)) {
      duplicates.push({
        row: i + 1,
        matchRow: seen.get(key) + 1,
        phone: r.customerPhone,
        origin: r.originCode,
        destination: r.destinationCode
      });
    } else {
      seen.set(key, i);
    }
  });

  return duplicates;
}

/* =========================
   DUPLICATE HANDLING (ADMIN ONLY)
========================= */

let _pendingRowsForRetry = null;

function openDuplicateWarning(duplicates, rows) {
  _pendingRowsForRetry = rows;

  openModal({
    title: "⚠ Duplicate Shipments Detected",
    lock: true,

    bodyHTML: `
      <p>The following rows already exist:</p>
      <div style="max-height:240px;overflow:auto;margin-top:10px">
        ${duplicates.map(d => `
          <div class="pill yellow" style="margin-bottom:6px">
            Row ${d.row} matches Row ${d.matchRow}
            <small style="display:block;color:#555">
              ${d.phone} · ${d.origin} → ${d.destination}
            </small>
          </div>
        `).join("")}
      </div>
      <p style="margin-top:10px"><b>Only Admins may override this.</b></p>
    `,

    actions: [
      {
        label: "Cancel",
        variant: "neutral",
        onClick: () => {
          _pendingRowsForRetry = null;
          modal.hidden = true;
        }
      },

      {
        label: "Override & Create Anyway",
        variant: "danger",
        onClick: async () => {
          modal.hidden = true;
          showToast("Overriding duplicates...");

          try {
            const res = await bulkCreateShipmentsFn({
              rows: _pendingRowsForRetry,
              allowDuplicates: true
            });

            showToast(`Created ${res.data.created} shipments`);
            _pendingRowsForRetry = null;

          } catch (err) {
            console.error(err);
            showMiniToast(err.message || "Override failed", "err");
          }
        }
      }
    ]
  });
}


/* =========================
   TOAST
========================= */
function showMiniToast(msg, type = "ok") {
  const t = document.createElement("div");
  t.textContent = msg;
  t.style.cssText = `
    position:fixed;
    bottom:18px;
    right:18px;
    background:${type === "err" ? "#ff4a6a" : "#2ee59d"};
    color:#081018;
    padding:10px 14px;
    border-radius:10px;
    font-weight:600;
    box-shadow:0 10px 30px rgba(0,0,0,.4);
    z-index:10000;
  `;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2600);
}

// Safe stubs for top bar actions
function openBulkSMS() {
  showMiniToast("Bulk SMS not wired yet.", "ok");
}

function openNewModal() {
  showMiniToast("New shipment not wired yet.", "ok");
}

/* =========================
   LOAD / UNLOAD / COMPLETE HANDLER
   (SINGLE EVENT DELEGATION)
========================= */

function requireRole(roles) {
  if (!roles.includes(window.MY_ROLE)) {
    showMiniToast("Permission denied", "err");
    throw new Error("Forbidden");
  }
}

document.addEventListener("click", async (e) => {
  const btn = e.target.closest("[data-act]");
  if (!btn) return;

  const act = btn.dataset.act;
  const tripDocId = btn.dataset.trip;
  const pkgId = btn.dataset.trk;
  const trackingDocId = btn.dataset.tracking;

  try {

    /* ================= TOP BAR ================= */

    if (act === "export") return exportCSV();
    if (act === "bulkSms") return openBulkSMS();
    if (act === "new") return openNewModal();

    /* ================= LOAD ================= */

    if (act === "load") {
      requireRole(["checker","manager","admin"]);

      const qty = Number(prompt("Load how many items?", "1"));
      if (!Number.isInteger(qty) || qty <= 0) return;

      const res = await loadItemsToTripCF({
        trackingDocId,
        tripDocId,
        loadCount: qty
      });

      showToast(`Loaded ${res.data.loadedNow}`);
      return;
    }

    /* ================= AUTO SPLIT ================= */

    if (act === "split") {
      requireRole(["manager","admin"]);

      const res = await loadItemsToTripCF({
        trackingDocId,
        tripDocId,
        loadCount: 999999
      });

      showToast(`Auto-split complete`);
      return;
    }

    /* ================= UNLOAD ================= */

    if (act === "unload") {
      requireRole(["checker","manager","admin"]);
      openUnloadModal({ tripDocId, trackingDocId });
      return;
    }

    /* ================= PARTIAL ================= */

    if (act === "partial") {
      requireRole(["checker","manager","admin"]);

      const qty = Number(prompt("How many items delivered?", "1"));
      if (!Number.isInteger(qty) || qty <= 0) return;

      const reason = prompt("Reason (required)", "");
      if (!reason) return alert("Reason required");

      await recordPartialCF({
        tripDocId,
        packageId: pkgId,
        partialCount: qty,
        reason
      });

      showToast("Partial delivery recorded");
      return;
    }

    /* ================= MARK DELIVERED ================= */

    if (act === "delivered") {
      requireRole(["checker","manager","admin"]);
      await window.markDelivered({ tripDocId, pkgId, trackingDocId });
      return;
    }

    /* ================= COMPLETE TRIP ================= */

    if (act === "completeTrip") {
      requireRole(["manager","admin"]);
      await openTripCloseWarningAndComplete(tripDocId);
      return;
    }

  } catch (err) {
    console.error(err);
    showMiniToast(err.message || "Action failed", "err");
  }
});




/* =========================
   TRIP CLOSE WARNING + GUARD
========================= */
async function openTripCloseWarningAndComplete(tripDocId) {
  const tripRef = firebase.firestore()
    .collection("truck_trips")
    .doc(tripDocId);

  const pkgsSnap = await tripRef.collection("trip_packages").get();

  const pending = [];
  pkgsSnap.forEach(doc => {
    const d = doc.data() || {};
    if ((d.pendingCount || 0) > 0) {
      pending.push({
        trackingNumber: d.trackingNumber,
        pendingCount: d.pendingCount
      });
    }
  });

  if (pending.length) {
    alert(
      "Trip cannot be closed.\n\nPending items:\n" +
      pending.map(p => `${p.trackingNumber}: ${p.pendingCount}`).join("\n")
    );
    return;
  }

  await completeTripFn({ tripDocId });

  showToast("Trip completed");

  // 🔥 DO NOT reload
  // Firestore listeners will update UI automatically
}


// 🔧 Firestore timestamp helper (GLOBAL)
function tsToMillis(ts){
  if (!ts) return 0;
  if (ts.toMillis) return ts.toMillis();
  if (ts.seconds) return ts.seconds * 1000;
  return new Date(ts).getTime();
}

/* =========================
   LIVE SHIPMENTS (FIRESTORE)
   - single snapshot loop
   - loader + error handling
========================= */
async function startLiveShipments() {
  return db
    .collection("tracking_records")
    .orderBy("updatedAt", "desc")
    .onSnapshot(async (snap) => {
      try {
        const rows = [];

        for (const doc of snap.docs) {
          try {
            const tr = doc.data() || {};
            tr.id = doc.id;

            tr.tripDocId = tr.tripDocId || tr.currentTruckTripId || null;

            let trip = {};
            let pkg = null;
            let pkgDoc = null;

            if (tr.tripDocId) {
              const tripRef = db.collection("truck_trips").doc(tr.tripDocId);

              const tripSnap = await tripRef.get();
              trip = tripSnap.exists ? (tripSnap.data() || {}) : {};

              const pkgSnap = await tripRef
                .collection("trip_packages")
                .where("trackingDocId", "==", doc.id)
                .limit(1)
                .get();

              if (!pkgSnap.empty) {
                pkgDoc = pkgSnap.docs[0];
                pkg = pkgDoc.data() || {};
                pkg.id = pkgDoc.id;
                pkg.trackingDocId = doc.id;

                // Fix corrupted keys
                if (pkg[" active"] !== undefined && pkg.active === undefined) {
                  pkg.active = pkg[" active"];
                  delete pkg[" active"];
                }
                if (pkg[" tripId"] !== undefined && pkg.tripId === undefined) {
                  pkg.tripId = pkg[" tripId"];
                  delete pkg[" tripId"];
                }

                const eventsSnap = await pkgDoc.ref
                  .collection("status_events")
                  .orderBy("createdAt")
                  .get();

                tr.stepsDone = eventsSnap.docs.map(
                  e => (e.data() || {}).toStatus || ""
                );
              }
            }

            tr.trip = trip.tripId || tr.tripId || "";
            tr.pkg = pkg;

            tr.route = `${tr.origin} → ${tr.destination}`;
            tr.routeCode = pkg
              ? `${pkg.originCode || ""}-${pkg.destCode || ""}`
              : "";
            tr.driverName = pkg?.driverName || "";
            tr.packageCount = pkg?.packageCount ?? 0;

          // Prefer delay from package, but fall back to tracking_records / tracking_public
            tr.delayReason = pkg?.delayReason || tr.delayReason || null;

            tr.delayStartedAt = tsToMillis(
              pkg?.delayStartedAt ||
              tr.delayStartedAt ||
              tr.delayStarted ||
              null
            );

          // Delay is cleared ONLY if explicitly cleared anywhere
           tr.delayCleared = !!(pkg?.delayClearedAt || tr.delayClearedAt);

            tr.delayClearedAt = tsToMillis(
              pkg?.delayClearedAt ||
              tr.delayClearedAt ||
              null
            ); 

            tr.lastUpdateAt = tsToMillis(pkg?.lastUpdatedAt || tr.updatedAt);
            tr.startedAt = tsToMillis(trip?.startedAt);

            const key = tr.trip || tr.tripId;

            const nowDelayed = !!(tr.delayReason && !tr.delayCleared);
            const prevDelayed = delayMemory.get(key);
            if (!firstLiveLoad && prevDelayed === true && !nowDelayed) {
              showToast(`✅ Trip ${key} is back on track`);
            }
            delayMemory.set(key, nowDelayed);

            const isBoarded =
              tr.status === "BOARDED_RORO" ||
              tr.status === "ON_RORO" ||
              !!tr.boardedAt;

            const wasBoarded = roroMemory.get(key) === true;
            if (!firstLiveLoad && !wasBoarded && isBoarded) {
              showToast(`🚢 Trip ${key} boarded RORO`);
            }
            roroMemory.set(key, isBoarded);

            const isWeatherDelayed =
              tr.delayReason &&
              String(tr.delayReason).toUpperCase().includes("WEATHER") &&
              !tr.delayCleared;

            const wasWeatherDelayed = weatherMemory.get(key) === true;
            if (!firstLiveLoad && wasWeatherDelayed && !isWeatherDelayed) {
              showToast(`🌦 Weather cleared for Trip ${key}`);
            }
            weatherMemory.set(key, isWeatherDelayed);

            const isArrived =
              tr.status === "ARRIVED" ||
              tr.status === "COMPLETED" ||
              tr.status === "DELIVERED" ||
              !!tr.endedAt;

            const wasArrived = arrivalMemory.get(key) === true;
            if (!firstLiveLoad && !wasArrived && isArrived) {
              showToast(`📦 Trip ${key} arrived at destination`);
            }
            arrivalMemory.set(key, isArrived);

            rows.push(tr);

          } catch (rowErr) {
            console.warn("Skipping bad shipment:", doc.id, rowErr);
          }
        }

        SHIPMENTS = rows;
        render();
        firstLiveLoad = false;

        liveReady = true;
        liveError = null;
        if (liveLoader) liveLoader.classList.add("hidden");

      } catch (err) {
        console.error("Firestore live error", err);
        liveReady = false;
        liveError = err;
        if (liveLoaderText)
          liveLoaderText.textContent = "Firestore error — retrying…";
        if (liveLoader) liveLoader.classList.remove("hidden");
      }
    });
}



// CSV Upload//
function exportCSV(){
  const rows = Array.from(document.querySelectorAll(".rowItem"));

  if(!rows.length){
    showToast("No shipments to export", "warn");
    return;
  }

  const headers = [
    "Tracking",
    "Customer",
    "Phone",
    "Route",
    "Status",
    "Driver",
    "Updated"
  ];

  const csv = [headers.join(",")];

  rows.forEach(r => {
    const d = r.dataset;
    csv.push([
      d.tracking || "",
      `"${d.name || ""}"`,
      d.phone || "",
      d.route || "",
      d.status || "",
      d.driver || "",
      d.updated || ""
    ].join(","));
  });

  const blob = new Blob([csv.join("\n")], { type: "text/csv" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = `atlas_shipments_${Date.now()}.csv`;
  a.click();

  URL.revokeObjectURL(url);
showToast("CSV exported");
}
