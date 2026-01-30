/* =========================================================
   MANAGER / ADMIN – SHIPMENTS (TRUCK-CENTRIC) — PATCHED 10/10
   ✅ Truck trip is source of truth (top-level /truck_trips)
   ✅ Delay applies per truck
   ✅ Shipments inherit delay (denormalized)
   ✅ Role verified from /users/{uid} (no hard-coded role)
   ✅ Admin vs Manager gating (no UI change)
   ✅ Status flow consistency guard
   ✅ Non-blocking audit logging (safe if function not deployed)
   ✅ Bulk upload safety (delay-aware when assigning to truckTrip)
========================================================= */

/* =========================================================
   FIREBASE IMPORTS
========================================================= */
import {
  collection,
  getDocs,
  getDoc,
  doc,
  query,
  orderBy,
  limit,
  writeBatch,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

import {
  getFunctions,
  httpsCallable,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-functions.js";

/* =========================================================
   APP IMPORTS
========================================================= */
import { auth, db } from "../firebase.js";
import { updateShipmentStatus } from "../../../../packages/src/updateShipmentStatus.js/index.js";
import { STATUS_FLOW } from "../shared/status-flow.js";
import { DELAY_REASONS } from "../shared/delay-reasons.js";
import { getStatusBadgeClass } from "../shared/badge-utils.js";
import { buildStatusSMS } from "../shared/buildStatusSMS.js";
import { suggestLocation } from "../shared/locationSuggest.js";
import { initBulkUpload } from "../shared/bulkUpload.js";
import { initCsvTemplateDownload } from "../shared/bulkUpload.js";
import { initShipmentModal } from "../shared/shipmentModal.js";
import { initTruckTripItemEditor } from "../shared/truckTripEditor.js";

/* =========================================================
   OPTIONAL MODAL INIT (KEEP)
========================================================= */
try {
  initShipmentModal({ onCreated: refreshAll });
} catch (_) {}

/* =========================================================
   CLOUD FUNCTIONS (REGION-LOCKED)
========================================================= */
const functions = getFunctions(undefined, "asia-southeast1");

const createShipmentCallable = httpsCallable(functions, "createShipment");

const sendSMSCallable = httpsCallable(functions, "sendSMS");

/**
 * ✅ PATCH 5 — Audit logging (non-blocking)
 * - This callable may or may not exist. We will never break UX if missing.
 * - If you already have a callable name, set it here.
 */
const logAuditCallableNames = [
  "logAuditEvent",
  "logAdminAction",
  "auditEvent",
  "logManagerAction",
];

let logAuditCallable = null;
for (const name of logAuditCallableNames) {
  try {
    logAuditCallable = httpsCallable(functions, name);
    break;
  } catch (_) {}
}

async function logAudit(type, details = {}) {
  try {
    if (!logAuditCallable || !currentUser?.uid) return;
    await logAuditCallable({
      type,
      at: Date.now(),
      by: currentUser.uid,
      role: currentUser.role,
      ...details,
    });
  } catch (_) {
    // non-blocking by design
  }
}

/* =========================================================
   DOM
========================================================= */
const table = document.getElementById("shipmentTable");

/* SMS MODAL */
const smsModal = document.getElementById("smsModal");
const smsPhoneEl = document.getElementById("smsPhone");
const smsTrackingEl = document.getElementById("smsTracking");
const smsMessageEl = document.getElementById("smsMessage");
const sendSmsBtn = document.getElementById("sendSmsBtn");
const closeSmsBtn = document.getElementById("closeSmsBtn");

/* BULK UPLOAD (CSV) */
const bulkFile = document.getElementById("bulkFile");
const bulkUploadBtn = document.getElementById("bulkUploadBtn");

/* =========================================================
   INIT (SAFE ORDER)
========================================================= */
wireLocationSuggest("originInput", "originHint");
wireLocationSuggest("destinationInput", "destinationHint");

try {
  initCsvTemplateDownload?.();
} catch (_) {}

if (bulkFile && bulkUploadBtn) {
  // shared module may wire listeners/UI; keep it, but do not rely on it alone
  try {
    initBulkUpload({
      bulkFile,
      bulkUploadBtn,
      createShipmentCallable,
    });
  } catch (_) {}
}

/* =========================================================
   STATE
========================================================= */
let currentUser = null; // { uid, role }
let smsContext = null;

/* =========================================================
   PATCH 2 — ROLE / FEATURE GATING
========================================================= */
function isAdmin() {
  return currentUser?.role === "admin";
}
function isManager() {
  return currentUser?.role === "manager";
}
function isStaffAllowed() {
  return isAdmin() || isManager();
}

/* =========================================================
   HELPERS
========================================================= */
function getCustomerPhone(r) {
  return r?.customerPhoneNumber || r?.customerPhone || null;
}

function getTripDelayState(trip) {
  const reason = trip?.delayReason ?? null;
  const cleared = !!trip?.delayCleared;
  return {
    isDelayed: !!reason && !cleared,
    reason,
  };
}

/* LOCATION NORMALIZER (BULK SAFETY)
   - Enforces exact match so CSV cannot inject unknown locations
*/
function normalizeLocation(input) {
  const result = suggestLocation(input);
  if (!result || !result.exact) return null;

  return {
    code: result.match.code,
    label: result.match.label,
  };
}

function wireLocationSuggest(inputId, hintId) {
  const input = document.getElementById(inputId);
  const hint = document.getElementById(hintId);
  if (!input || !hint) return;

  input.addEventListener("input", () => {
    const value = input.value;
    hint.textContent = "";
    hint.className = "hint";
    if (!value) return;

    const result = suggestLocation(value);

    if (!result) {
      hint.textContent = "⚠ Unknown location";
      hint.classList.add("warn");
      return;
    }

    if (!result.exact) {
      hint.textContent = `Did you mean ${result.match.label}?`;
      hint.classList.add("warn");
    } else {
      hint.textContent = "✓ Valid location";
      hint.classList.add("ok");
    }
  });
}

/* =========================================================
   ✅ PATCH 1 — REAL ROLE VERIFICATION (CRITICAL)
========================================================= */
onAuthStateChanged(auth, async (user) => {
  if (!user) return (location.href = "../login.html");

  try {
    const snap = await getDoc(doc(db, "users", user.uid));
    const data = snap.data();

    if (!data || !["manager", "admin"].includes(data.role)) {
      alert("Access denied");
      return (location.href = "../login.html");
    }

    currentUser = {
      uid: user.uid,
      role: data.role,
    };

    await logAudit("MANAGER_UI_OPENED", { page: "manager/shipments" });

    loadShipments();
  } catch (e) {
    console.error(e);
    alert("Unable to verify account. Please login again.");
    location.href = "../login.html";
  }
});

/* =========================================================
   REFRESH HOOK (kept for your modal onCreated)
========================================================= */
async function refreshAll() {
  await loadShipments();
}

/* =========================================================
   ✅ PATCH 4 — CANONICAL TRUCK TRIP LOOKUP (RULE-ALIGNED)
   Truck trips are TOP-LEVEL: /truck_trips/{truckTripId}
========================================================= */
async function getTruckTripDoc(truckTripId) {
  if (!truckTripId || truckTripId === "UNASSIGNED") return null;

  const ref = doc(db, "truck_trips", truckTripId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;

  return { ref, data: snap.data() };
}

/* =========================================================
   ✅ PATCH 3 — STATUS FLOW CONSISTENCY GUARD
   If Firestore status != STATUS_FLOW[index], do NOT allow advance.
========================================================= */
function isFlowConsistent(status, index) {
  const expected = STATUS_FLOW[index];
  return status === expected;
}

/* =========================================================
   LOAD SHIPMENTS (TRUCK-CENTRIC)
========================================================= */
async function loadShipments() {
  if (!table) return;
  if (!isStaffAllowed()) {
    table.innerHTML = `<tr><td colspan="5" style="padding:24px;text-align:center;">Access denied</td></tr>`;
    return;
  }

  table.innerHTML = "";

  const snap = await getDocs(collection(db, "tracking_records"));

  if (snap.empty) {
    table.innerHTML = `<tr><td colspan="5" style="padding:24px;text-align:center;">No shipments</td></tr>`;
    return;
  }

  /* ================= GROUP BY TRUCK TRIP ================= */
  const groups = new Map();

  snap.forEach((docSnap) => {
    const record = docSnap.data();
    const tripId = record.currentTruckTripId || "UNASSIGNED";

    if (!groups.has(tripId)) groups.set(tripId, []);
    groups.get(tripId).push({
      docId: docSnap.id,
      record,
    });
  });

  /* ================= RENDER GROUPS ================= */
  for (const [truckTripId, shipments] of groups.entries()) {
    const tripDoc = await getTruckTripDoc(truckTripId);
    const tripDelay = getTripDelayState(tripDoc?.data);

    /* ================= TRUCK HEADER ================= */
    const header = document.createElement("tr");
    header.className = "truck-row";

    // NOTE: This assumes your HTML uses a 5-column table.
    // If yours is different, keep colspan aligned.
    header.innerHTML = `
      <td colspan="5">
        <strong>🚛 ${
          truckTripId === "UNASSIGNED" ? "Unassigned Shipments" : truckTripId
        }</strong>

        ${
          tripDoc?.data?.truckPlateNumber
            ? ` | Plate: ${tripDoc.data.truckPlateNumber}`
            : ""
        }

        ${
          tripDoc?.data?.driverName
            ? ` | Driver: ${tripDoc.data.driverName}`
            : ""
        }

        ${
          tripDelay.isDelayed
            ? ` <span class="badge delayed">Delayed</span>`
            : ""
        }

        <div style="margin-top:10px; display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
          ${
            truckTripId === "UNASSIGNED"
              ? `<em style="color:#64748b;">Assign these shipments to a truck to enable actions.</em>`
              : `
                <input
                  type="number"
                  min="0"
                  class="loaded-items-input"
                  placeholder="Loaded"
                  value="${tripDoc?.data?.loadedItems ?? 0}"
                  style="width:90px;padding:6px;"
                  ${isStaffAllowed() ? "" : "disabled"}
                />
                <button class="save-loaded-items" ${isStaffAllowed() ? "" : "disabled"}>Save</button>

                <select class="delay-select" ${isStaffAllowed() ? "" : "disabled"}>
                  <option value="">No Delay</option>
                  ${Object.entries(DELAY_REASONS)
                    .map(
                      ([k, v]) =>
                        `<option value="${k}" ${tripDoc?.data?.delayReason === k ? "selected" : ""}>${v}</option>`,
                    )
                    .join("")}
                </select>
                <button class="apply-delay" ${isStaffAllowed() ? "" : "disabled"}>Apply</button>
              `
          }
        </div>
      </td>
    `;

    table.appendChild(header);

    /* ================= LOADED ITEMS EDITOR (CANONICAL) ================= */
    if (truckTripId !== "UNASSIGNED" && tripDoc && isStaffAllowed()) {
      const loadedInput = header.querySelector(".loaded-items-input");
      const saveLoadedBtn = header.querySelector(".save-loaded-items");

      if (loadedInput && saveLoadedBtn) {
        try {
          initTruckTripItemEditor({
            // If your editor expects trackingId (legacy), pass the first shipment id.
            // If it supports direct trip ref, it will still work because we also pass truckTripId.
            trackingId: shipments[0]?.docId,
            truckTripId,
            inputEl: loadedInput,
            saveBtn: saveLoadedBtn,
            currentUser,
            onSuccess: async () => {
              await logAudit("TRUCK_LOADED_ITEMS_UPDATED", {
                truckTripId,
                loadedItems: Number(loadedInput.value || 0),
              });
              loadShipments();
            },
          });
        } catch (e) {
          console.warn("initTruckTripItemEditor failed:", e);
        }
      }
    }

    /* ================= APPLY TRUCK DELAY ================= */
    if (truckTripId !== "UNASSIGNED" && tripDoc && isStaffAllowed()) {
      const applyBtn = header.querySelector(".apply-delay");
      const selectEl = header.querySelector(".delay-select");

      if (applyBtn && selectEl) {
        applyBtn.onclick = async () => {
          const delayReason = selectEl.value || null;

          const batch = writeBatch(db);
          const now = serverTimestamp();

          try {
            applyBtn.disabled = true;

            // Update canonical truck trip
            batch.update(tripDoc.ref, {
              delayReason,
              delayCleared: !delayReason,
              delayStartedAt: delayReason ? now : null,
              delayClearedAt: !delayReason ? now : null,
              lastUpdatedAt: now,
              lastUpdatedBy: currentUser.uid,
              lastUpdatedRole: currentUser.role,
            });

            // Denormalize to shipments
            for (const s of shipments) {
              batch.update(doc(db, "tracking_records", s.docId), {
                delayReason,
                delayCleared: !delayReason,
                delayStartedAt: delayReason ? now : null,
                delayClearedAt: !delayReason ? now : null,
              });
            }

            await batch.commit();

            await logAudit(
              delayReason ? "TRUCK_DELAY_APPLIED" : "TRUCK_DELAY_CLEARED",
              {
                truckTripId,
                delayReason: delayReason || null,
                shipmentsCount: shipments.length,
              },
            );

            loadShipments();
          } catch (e) {
            console.error(e);
            alert("Failed to apply delay. Check permissions / connection.");
          } finally {
            applyBtn.disabled = false;
          }
        };
      }
    }

    /* ================= SHIPMENTS ================= */
    for (const s of shipments) {
      const eventsRef = collection(
        db,
        "tracking_records",
        s.docId,
        "status_events",
      );

      const eventsSnap = await getDocs(
        query(eventsRef, orderBy("statusIndex", "desc"), limit(1)),
      );

      let status = s.record.status || STATUS_FLOW[0];
      let index = s.record.statusIndex ?? 0;

      if (!eventsSnap.empty) {
        const latest = eventsSnap.docs[0].data();
        status = latest.status;
        index = latest.statusIndex;
      }

      const expectedStatus = STATUS_FLOW[index];
      const flowOk = isFlowConsistent(status, index);

      if (!flowOk) {
        console.warn("Status flow mismatch", s.docId, status, expectedStatus);
      }

      const nextIndex = index + 1;

      const canAdvance =
        flowOk &&
        nextIndex < STATUS_FLOW.length &&
        !tripDelay.isDelayed &&
        truckTripId !== "UNASSIGNED";

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${s.docId}</td>
        <td>${s.record.customerName || "—"}</td>
        <td>${s.record.destination || "—"}</td>
        <td>
          <span
            class="badge ${
              tripDelay.isDelayed
                ? "delayed"
                : flowOk
                  ? getStatusBadgeClass(status)
                  : "error"
            }"
            title="${
              flowOk
                ? ""
                : `Flow mismatch: expected "${expectedStatus}" at index ${index}`
            }"
          >
            ${
              tripDelay.isDelayed
                ? `Delayed (Truck)`
                : flowOk
                  ? status
                  : `⚠ Flow mismatch`
            }
          </span>
        </td>
        <td>
          <button class="sms">📩 SMS</button>
          <button ${canAdvance ? "" : "disabled"}>
            ${canAdvance ? "→ " + STATUS_FLOW[nextIndex] : "Locked"}
          </button>
        </td>
      `;

      const [smsBtn, statusBtn] = tr.querySelectorAll("button");

      if (canAdvance) {
        statusBtn.onclick = async () => {
          try {
            statusBtn.disabled = true;

            await updateShipmentStatus({
              trackingId: s.docId,
              nextStatus: STATUS_FLOW[nextIndex],
              nextStatusIndex: nextIndex,
              user: currentUser,
            });

            await logAudit("SHIPMENT_STATUS_ADVANCED", {
              trackingId: s.docId,
              fromStatus: status,
              toStatus: STATUS_FLOW[nextIndex],
              truckTripId,
            });

            loadShipments();
          } catch (e) {
            console.error(e);
            alert("Failed to advance status.");
          } finally {
            statusBtn.disabled = false;
          }
        };
      }

      /* ===== SMS ===== */
      smsBtn.onclick = () => {
        const phone = getCustomerPhone(s.record);
        if (!phone) return alert("No customer phone number.");

        smsContext = {
          trackingId: s.docId,
          phone,
          status,
          delayReason: tripDelay.isDelayed ? tripDelay.reason : null,
          delayCleared: !tripDelay.isDelayed,
        };

        if (smsPhoneEl) smsPhoneEl.textContent = phone;
        if (smsTrackingEl) smsTrackingEl.textContent = s.docId;
        if (smsMessageEl) smsMessageEl.value = buildStatusSMS(smsContext);

        smsModal?.classList.add("active");
      };

      table.appendChild(tr);
    }
  }
}

/* =========================================================
   BULK CSV UPLOAD (MANAGER) — PATCH 6 (DELAY-AWARE)
========================================================= */
function parseCSV(text) {
  const lines = text.split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const cols = line.split(",").map((c) => c.trim());
    const row = {};
    headers.forEach((h, i) => (row[h] = cols[i] ?? ""));
    return row;
  });
}

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function isTripDelayedIfProvided(truckTripId) {
  if (!truckTripId) return false;
  const trip = await getTruckTripDoc(truckTripId);
  if (!trip) return false; // if trip doesn't exist, treat as not delayed but assignment should be handled by your server logic
  const d = getTripDelayState(trip.data);
  return d.isDelayed;
}

if (bulkUploadBtn) {
  bulkUploadBtn.onclick = async () => {
    if (!bulkFile?.files?.length) {
      return alert("Select a CSV file first.");
    }

    const file = bulkFile.files[0];
    const text = await file.text();
    const rows = parseCSV(text);

    if (!rows.length) {
      return alert("No rows found in CSV.");
    }

    bulkUploadBtn.disabled = true;
    bulkUploadBtn.textContent = "Uploading…";

    let ok = 0;
    let fail = 0;

    for (const r of rows) {
      // ✅ REQUIRED FIELD GUARD
      if (!r.customerName || !(r.customerPhone || r.customerPhoneNumber)) {
        console.warn("Skipping row — missing customer fields:", r);
        fail++;
        continue;
      }

      const origin = normalizeLocation(
        r.origin || r.originLabel || r.originCode,
      );

      const destination = normalizeLocation(
        r.destination || r.destinationLabel || r.destinationCode,
      );

      if (!origin || !destination) {
        console.warn("✗ Invalid location:", r);
        fail++;
        continue;
      }

      // ✅ PATCH 6: Delay-aware assignment if CSV tries to force truckTripId
      const truckTripId =
        (r.truckTripId || r.currentTruckTripId || "").trim() || null;

      if (truckTripId) {
        const delayed = await isTripDelayedIfProvided(truckTripId);
        if (delayed) {
          console.warn("Skipping row — truckTrip is delayed:", truckTripId, r);
          fail++;
          continue;
        }
      }

      try {
        await createShipmentCallable({
          customerName: r.customerName,
          customerPhone: r.customerPhone || r.customerPhoneNumber,
          originCode: origin.code,
          originLabel: origin.label,
          destinationCode: destination.code,
          destinationLabel: destination.label,
          // Optional: only include if you support it server-side
          ...(truckTripId ? { currentTruckTripId: truckTripId } : {}),
        });

        ok++;
      } catch (e) {
        console.error("Bulk row failed:", r, e);
        fail++;
      }

      await sleep(120);
    }

    await logAudit("BULK_UPLOAD_COMPLETED", {
      ok,
      fail,
    });

    alert(`✅ Bulk upload done\nSuccess: ${ok}\nFailed: ${fail}`);

    bulkUploadBtn.disabled = false;
    bulkUploadBtn.textContent = "📄 Bulk Upload CSV";

    await loadShipments();
  };
}

/* =========================================================
   SMS MODAL
========================================================= */
if (closeSmsBtn) {
  closeSmsBtn.onclick = () => {
    smsModal?.classList.remove("active");
    smsContext = null;
  };
}

if (sendSmsBtn) {
  sendSmsBtn.onclick = async () => {
    if (!smsContext) return;

    sendSmsBtn.disabled = true;
    sendSmsBtn.textContent = "Sending…";

    try {
      await sendSMSCallable(smsContext);
      await logAudit("SMS_SENT", {
        trackingId: smsContext.trackingId,
        phone: smsContext.phone,
        status: smsContext.status,
        delayReason: smsContext.delayReason || null,
      });

      alert("✅ SMS sent");
      smsModal?.classList.remove("active");
    } catch (e) {
      console.error(e);
      alert("❌ SMS failed");
    } finally {
      sendSmsBtn.disabled = false;
      sendSmsBtn.textContent = "Send SMS";
    }
  };
}
