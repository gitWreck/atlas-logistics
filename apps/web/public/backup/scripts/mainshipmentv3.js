// =========================================================
// ATLAS MAINSHIPMENT (LIVE FIRESTORE) — UI = Loadboard Option A
// - UI + animations copied from public/loadboard.html
// - Data source swapped to Firestore tracking_records (+ trip_packages)
// =========================================================
"use strict";

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




/* =========================================================
   FUTURISTIC OPTION A — MOCK DATA UI (ADMIN SUPERSET)
   - Comfortable spacing
   - Energy-flow mini timeline
   - Delay animations
   - Drawer command panel
========================================================= */

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

const $ = (id) => document.getElementById(id);
const tbody = $("tbody");
const q = $("q");
const chips = $("chips");
const meta = $("meta");
const clock = $("clock");
const scrim = $("scrim");
const drawer = $("drawer");
const toast = $("toast");
const toastText = $("toastText");

let activeFilter = "ALL";
let selectedId = null;

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

/** Mini timeline builder */
function buildMiniTimeline(s){
  const tone = toneForShipment(s);
  const stepsDone = new Set(s.stepsDone || []);
  const active = s.status;

  // Determine progress %: based on active step index
  const idx = Math.max(0, STEPS.findIndex(x => x.key === active));
  const denom = Math.max(1, STEPS.length - 1);
  const pct = Math.min(100, Math.max(0, Math.round((idx / denom) * 100)));

  const el = document.createElement("div");
  el.className = "timeline";
  el.dataset.tone = tone;

  for (let i=0; i<STEPS.length; i++){
    const step = STEPS[i];
    const node = document.createElement("div");
    node.className = "tNode";
    if (stepsDone.has(step.key)) node.classList.add("done");
    if (step.key === active) node.classList.add("active");
    node.title = step.label;

    el.appendChild(node);

    if (i < STEPS.length - 1){
      const line = document.createElement("div");
      line.className = "tLine";
      // fill only on first line segment container (we'll overlay a single fill under all lines)
      // We'll create a fill that spans full width by using CSS var on wrapper and put fill in each line.
      line.style.setProperty("--pct", pct + "%");

      const fill = document.createElement("div");
      fill.className = "tFill";
      fill.style.width = pct + "%";

      // energy flow overlay
      const flow = document.createElement("div");
      flow.className = "tFlow";

      line.appendChild(fill);
      line.appendChild(flow);
      el.appendChild(line);
    }
  }

  return el;
}

/** Render chips */
function renderChips(){
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
  const query = q.value.trim();
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

    // Cell 1: Signal + Tracking
    const td1 = document.createElement("td");
    td1.className = "rowStripe";
    td1.dataset.tone = tone;

    const sig = document.createElement("div");
    sig.className = "signal";
    sig.innerHTML = `
      <div class="sigDot ${tone}"></div>
      <div class="trk">
        <div class="id mono">${escapeHtml(s.trackingNumber)}</div>
        <div class="mini">
          <span class="${statusPillClass(s)}">${escapeHtml(statusLabel(s.status))}</span>
          <span class="mono" style="opacity:.85;">${escapeHtml(s.phone || "—")}</span>
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

    // Cell 4: Delay
    const td4 = document.createElement("td");
    const d = delayBadge(s);
    let iconSpan = "";
    if (d.icon){
      if (d.anim === "weather") iconSpan = `<span class="animWeather">${d.icon}</span>`;
      else if (d.anim === "roro") iconSpan = `<span class="animRoro">${d.icon}</span>`;
      else iconSpan = `<span>${d.icon}</span>`;
    }
    td4.innerHTML = `
      <div class="delay">
        <span class="${d.cls}">${iconSpan} ${escapeHtml(d.text)}</span>
      </div>
      <div style="margin-top:6px; color: var(--muted); font-size:12px;">
        ${(!s.delayReason || s.delayCleared) ? "" : "Since " + fmtTime(s.delayStartedAt)}
      </div>
    `;

    // Cell 5: Trip
    const td5 = document.createElement("td");
    td5.innerHTML = `<div class="mono" style="font-weight:700;">${escapeHtml(s.trip || "—")}</div>
                     <div style="margin-top:6px; color: var(--muted); font-size:12px;">${escapeHtml(s.owner || "")}</div>`;

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

    tr.appendChild(td1);
    tr.appendChild(td2);
    tr.appendChild(td3);
    tr.appendChild(td4);
    tr.appendChild(td5);
    tr.appendChild(td6);
    tr.appendChild(td7);

    tbody.appendChild(tr);
  }

  // keep drawer in sync if open
  if (selectedId){
    const exists = SHIPMENTS.find(x => x.id === selectedId);
    if (!exists) closeDrawer();
  }
}

/** Drawer */
function openDrawer(id){
  const s = SHIPMENTS.find(x => x.id === id);
  if (!s) return;

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

scrim.addEventListener("click", closeDrawer);
$("closeDrawer").addEventListener("click", closeDrawer);
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeDrawer();
  if (e.key === "/" && document.activeElement !== q){
    e.preventDefault();
    q.focus();
  }
});

/** Mock actions */
function mockAction(text){
  showToast(text);
}

/** Toast */
let toastTimer = null;
function showToast(text){
  toastText.textContent = text;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 2400);
}

/** Top action buttons (mock) */
$("btnNew").onclick = () => mockAction("New Shipment (mock)");
$("btnCsv").onclick = () => mockAction("CSV Upload (mock)");
$("btnSms").onclick = () => mockAction("Bulk SMS (mock)");

/** Drawer action buttons (mock) */
$("actPreviewNext").onclick = () => selectedId && mockAction(`Preview Next SMS (mock)`);
$("actManualSms").onclick = () => selectedId && mockAction(`Manual SMS (mock)`);
$("actAssign").onclick = () => selectedId && mockAction(`Assign/Unassign (mock)`);
$("actPartial").onclick = () => selectedId && mockAction(`Partial Delivery (mock)`);
$("actDelivered").onclick = () => {
  if (!selectedId) return;

  // Simulate: mark delivered + show back on track if delay cleared recently
  const s = SHIPMENTS.find(x => x.id === selectedId);
  if (!s) return;

  s.status = "DELIVERED";
  s.stepsDone = STEPS.map(x => x.key);
  s.delayReason = null;
  s.delayCleared = true;
  s.delayClearedAt = nowISO();
  s.lastUpdateAt = nowISO();

  showToast("✅ Marked Delivered (mock)");
  render();
  openDrawer(selectedId);
};

/** Search events */
let searchTimer = null;
q.addEventListener("input", () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(render, 60);
});

/** Clock */
function tickClock(){
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
render();

/* OPTIONAL: Demo "Back on track" logic (mock)
   - toggles a delayed shipment to cleared and shows toast */
setTimeout(() => {
  // Pick the first delayed shipment and clear it (demo)
  const s = SHIPMENTS.find(x => x.delayReason && !x.delayCleared && x.status !== "DELIVERED");
  if (!s) return;
  s.delayCleared = true;
  s.delayClearedAt = nowISO();
  s.delayReason = null;
  s.lastUpdateAt = nowISO();
  showToast("✅ Back on track (mock demo)");
  render();
}, 100000);




function startLiveShipments() {
  return db
    .collection("tracking_records")
    .orderBy("updatedAt", "desc")
    .onSnapshot(async (snap) => {
      const ll1 = document.getElementById('liveLoader');
      if (ll1) ll1.style.display = 'flex';

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

            tr.delayReason = pkg?.delayReason || null;
            tr.delayStartedAt = tsToMillis(pkg?.delayStartedAt);
            tr.delayCleared = !!pkg?.delayClearedAt;
            tr.delayClearedAt = tsToMillis(pkg?.delayClearedAt);

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


