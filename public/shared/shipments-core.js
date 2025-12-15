import {
  collection,
  getDocs,
  query,
  orderBy,
  limit
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

import { STATUS_FLOW } from "./status-flow.js";
import { getStatusBadgeClass } from "./badge-utils.js";
import { updateShipmentStatus } from "../src/services/updateShipmentStatus.js";

/**
 * initShipmentsCore({
 *   db,
 *   tableEl,
 *   user,
 *   roleConfig
 * })
 */
export async function initShipmentsCore({
  db,
  tableEl,
  user,
  roleConfig
}) {
  tableEl.innerHTML = "";

  const snap = await getDocs(collection(db, "tracking_records"));

  if (snap.empty) {
    tableEl.innerHTML = `
      <tr>
        <td colspan="4" style="text-align:center;padding:24px;color:#64748b">
          No shipments found
        </td>
      </tr>`;
    return;
  }

  for (const docSnap of snap.docs) {
    const record = docSnap.data();

    // 🔑 latest status
    const eventsRef = collection(
      db,
      "tracking_records",
      docSnap.id,
      "status_events"
    );

    const eventsSnap = await getDocs(
      query(eventsRef, orderBy("statusIndex", "desc"), limit(1))
    );

    let status = record.status || "Received";
    let statusIndex = record.statusIndex ?? 0;

    if (!eventsSnap.empty) {
      const latest = eventsSnap.docs[0].data();
      status = latest.status;
      statusIndex = latest.statusIndex;
    }

    const badgeClass = getStatusBadgeClass(status);
    const tr = document.createElement("tr");

    // 🔒 forward-only
    const nextIndex = statusIndex + 1;
    const canAdvance =
      roleConfig.canUpdate &&
      nextIndex < STATUS_FLOW.length &&
      roleConfig.allowedNext(statusIndex, nextIndex);

    tr.innerHTML = `
      <td>${docSnap.id}</td>
      <td>${record.customerName ?? "—"}</td>
      <td>
        <span class="badge ${badgeClass}">
          ${status}
        </span>
      </td>
      <td>
        ${
          roleConfig.canUpdate
            ? `<button ${canAdvance ? "" : "disabled"}>
                ${canAdvance ? "→ " + STATUS_FLOW[nextIndex] : "Completed"}
               </button>`
            : ""
        }
      </td>
    `;

    if (canAdvance) {
      tr.querySelector("button").onclick = async () => {
        await updateShipmentStatus({
          trackingId: docSnap.id,
          nextStatus: STATUS_FLOW[nextIndex],
          nextStatusIndex: nextIndex,
          user
        });
        initShipmentsCore({ db, tableEl, user, roleConfig });
      };
    }

    tableEl.appendChild(tr);
  }
}
