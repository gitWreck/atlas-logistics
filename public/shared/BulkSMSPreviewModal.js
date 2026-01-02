/*********************************************************
 * Bulk SMS Preview Modal (CANONICAL, SAFE)
 *
 * ✔ Admin / Manager only
 * ✔ Frontend builds PREVIEW ONLY
 * ✔ Backend ALWAYS rebuilds final SMS
 * ✔ Supports suppression / force resend
 * ✔ Per-truck / batch friendly
 *********************************************************/

import { getFunctions, httpsCallable } from "firebase/functions";

import { buildStatusSMS } from "./buildStatusSMS.js";   // 🔎 preview only
import { estimateSmsCost } from "./sms-cost.js";

/* ======================================================
   OPEN BULK SMS PREVIEW
====================================================== */
export function openBulkSMSPreview({
  trackingId,
  status,
  delayReason = null,
  delayCleared = false,

  recipients = [],

  // 🆕 optional context
  contextLabel = "Bulk",
  suppressDuplicates = true,
}) {
  /* -----------------------------------------------
     VALIDATION
  ----------------------------------------------- */
  if (!recipients.length) {
    alert("No recipients selected");
    return;
  }

  if (recipients.length > 50) {
    alert("Bulk SMS limit exceeded (max 50 recipients)");
    return;
  }

  /* -----------------------------------------------
     SINGLE MODAL GUARD
  ----------------------------------------------- */
  const existing = document.getElementById("bulkSMSModal");
  if (existing) existing.remove();

  /* -----------------------------------------------
     PREVIEW MESSAGE (NON-AUTHORITATIVE)
  ----------------------------------------------- */
  const previewMessage = buildStatusSMS({
    trackingId,
    status,
    delayReason,
    delayCleared,
  });

  const { length, credits, costPhp } = estimateSmsCost(previewMessage);
  const estimatedTotalCredits = credits * recipients.length;

  /* -----------------------------------------------
     CREATE MODAL
  ----------------------------------------------- */
  const modal = document.createElement("div");
  modal.id = "bulkSMSModal";
  modal.style = overlayStyle();

  modal.innerHTML = `
    <div style="${cardStyle()}">
      <h3 style="margin:0 0 6px 0;">📦 ${contextLabel} SMS Preview</h3>

      <div style="font-size:12px;color:#64748b;margin-bottom:8px;">
        ⚠ Preview only. Final SMS is rebuilt and validated by the server.
      </div>

      <div style="${previewBoxStyle()}">${previewMessage}</div>

      <div style="margin-top:10px;font-size:13px;color:#334155;">
        👥 Recipients: <b>${recipients.length}</b><br>
        ✉ Characters: <b>${length}</b><br>
        💳 Credits / SMS: <b>${credits}</b><br>
        📊 Estimated total credits: <b>${estimatedTotalCredits}</b>
        ${
          costPhp
            ? `<br>💵 Estimated cost: <b>₱${(
                costPhp * recipients.length
              ).toFixed(2)}</b>`
            : ""
        }
      </div>

      ${
        credits > 1
          ? `<div style="margin-top:8px;color:#b45309;font-size:12px;">
               ⚠ Message uses more than 1 SMS credit
             </div>`
          : ""
      }

      <div style="margin-top:14px;font-size:12px;color:#475569;">
        🔁 Duplicate suppression:
        <b>${suppressDuplicates ? "ON" : "OFF"}</b>
      </div>

      <div style="margin-top:16px;text-align:right;">
        <button id="bulkCancel" style="${btn("#e5e7eb")}">Cancel</button>
        <button id="bulkSend" style="${btn("#2563eb", "#fff")}">
          Send Bulk SMS
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  /* -----------------------------------------------
     ACTIONS
  ----------------------------------------------- */
  modal.querySelector("#bulkCancel").onclick = () => modal.remove();

  modal.querySelector("#bulkSend").onclick = async () => {
    const confirmSend = confirm(
      `Send SMS to ${recipients.length} recipients?\n\nThis action cannot be undone.`
    );

    if (!confirmSend) return;

    const sendBtn = modal.querySelector("#bulkSend");
    sendBtn.disabled = true;
    sendBtn.innerText = "Sending…";

    try {
      const functions = getFunctions(undefined, "asia-southeast1");
      const sendBulkSMS = httpsCallable(functions, "sendBulkSMS");

      const res = await sendBulkSMS({
        trackingId,
        status,
        delayReason,
        delayCleared,
        recipients,

        suppressDuplicates,
        forceResend: false,
        reason: "ui_bulk_send",
      });

      alert(
        `✅ Bulk SMS Completed\n\n` +
        `Sent: ${res.data.summary.sent}\n` +
        `Suppressed: ${res.data.summary.suppressed}\n` +
        `Failed: ${res.data.summary.failed}`
      );

      modal.remove();
    } catch (err) {
      console.error(err);
      alert("❌ Bulk SMS failed. See console for details.");
      sendBtn.disabled = false;
      sendBtn.innerText = "Send Bulk SMS";
    }
  };
}

/* ======================================================
   STYLES
====================================================== */
function overlayStyle() {
  return `
    position:fixed;
    inset:0;
    background:rgba(0,0,0,.45);
    display:flex;
    align-items:center;
    justify-content:center;
    z-index:9999;
  `;
}

function cardStyle() {
  return `
    background:#fff;
    width:420px;
    border-radius:14px;
    padding:18px;
    font-family:system-ui;
    box-shadow:0 20px 40px rgba(0,0,0,.25);
  `;
}

function previewBoxStyle() {
  return `
    background:#f9fafb;
    padding:12px;
    border-radius:8px;
    font-size:14px;
    white-space:pre-wrap;
    border:1px solid #e5e7eb;
  `;
}

function btn(bg, color = "#111") {
  return `
    background:${bg};
    color:${color};
    border:none;
    padding:8px 12px;
    border-radius:8px;
    cursor:pointer;
    margin-left:6px;
    font-size:13px;
  `;
}
