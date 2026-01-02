import {
  collection,
  getDocs
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

import { STATUS_FLOW } from "./status-flow.js";
import { getStatusBadgeClass } from "./badge-utils.js";
import { updateShipmentStatus } from "../src/services/updateShipmentStatus.js";

/* ======================================================
   SAFE HTML ESCAPE (XSS HARDENING)
====================================================== */
function esc(v = "—") {
  return String(v)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

/* ======================================================
   EMPTY STATE RENDERER
====================================================== */
function renderState(tableEl, message, color = "#64748b") {
  tableEl.innerHTML = `
    <tr>
      <td colspan="4" style="text-align:center;padding:24px;color:${color}">
        ${esc(message)}
      </td>
    </tr>`;
}

/**
 * Initialize shipment table
 * - Delay-aware badge
 * - Forward-only status progression
 * - Role-guarded updates
 */
export async function initShipmentsCore({
  db,
  tableEl,
  user,
  roleConfig
}) {
  tableEl.innerHTML = "";

  let snap;
  try {
    snap = await getDocs(collection(db, "tracking_records"));
  } catch (err) {
    console.error("Failed to load shipments:", err);
    renderState(tableEl, "Failed to load shipments", "#dc2626");
    return;
  }

  if (snap.empty) {
    renderState(tableEl, "No shipments found");
    return;
  }

  const rows = document.createDocumentFragment();

  for (const docSnap of snap.docs) {
    const record = docSnap.data();

    const status = record.status || "Received";
    const statusIndex = record.statusIndex ?? 0;

    /* ==================================================
       🔴 DELAY-AWARE BADGE (CANONICAL)
    ================================================== */
    const hasActiveDelay =
      record.delayReason && !record.delayCleared;

    const badgeClass = hasActiveDelay
      ? "delayed"
      : getStatusBadgeClass(status);

    const badgeLabel = hasActiveDelay
      ? "Delayed"
      : status;

    const nextIndex = statusIndex + 1;

    const canAdvance =
      roleConfig.canUpdate &&
      nextIndex < STATUS_FLOW.length &&
      roleConfig.allowedNext(statusIndex, nextIndex);

    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td>${esc(docSnap.id)}</td>
      <td>${esc(record.customerName)}</td>
      <td>
        <span class="badge ${badgeClass}">
          ${esc(badgeLabel)}
        </span>
      </td>
      <td>
        ${
          canAdvance
            ? `<button>→ ${esc(STATUS_FLOW[nextIndex])}</button>`
            : `<span style="color:#94a3b8;font-size:12px;">No action</span>`
        }
      </td>
    `;

    /* ==================================================
       STATUS UPDATE HANDLER (SAFE)
    ================================================== */
    if (canAdvance) {
      const btn = tr.querySelector("button");

      btn.onclick = async () => {
        if (btn.disabled) return;

        btn.disabled = true;
        btn.textContent = "Updating…";

        try {
          await updateShipmentStatus({
            trackingId: docSnap.id,
            nextStatus: STATUS_FLOW[nextIndex],
            nextStatusIndex: nextIndex,
            user
          });

          // Full refresh (single call)
          await initShipmentsCore({
            db,
            tableEl,
            user,
            roleConfig
          });
        } catch (err) {
          console.error("Status update failed:", err);
          alert(err.message || "Failed to update status");

          btn.disabled = false;
          btn.textContent = "→ " + STATUS_FLOW[nextIndex];
        }
      };
    }

    rows.appendChild(tr);
  }

  tableEl.appendChild(rows);
}
