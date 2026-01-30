/*********************************************************
 * SMS Preview Modal (CANONICAL, SAFE)
 *
 * - Admin / Manager: preview + send + resend
 * - Checker / Driver: preview only
 *
 * RULES:
 * - Frontend builds PREVIEW ONLY
 * - Backend ALWAYS rebuilds final SMS
 * - No legacy template usage
 *********************************************************/

import { getFunctions, httpsCallable } from "firebase/functions";

import { buildStatusSMS } from "./buildStatusSMS.js";      // ✅ preview only
import { estimateSmsCost } from "./sms-cost.js";          // preview only
import { getDelayDurationMinutes } from "./delay-utils.js";
import { loadSMSHistory } from "./sms-history.js";
import { resendSMS } from "./resendSMS.js";

/* ======================================================
   SAFE HTML ESCAPE (XSS HARDENING)
====================================================== */
function escapeHtml(str = "") {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

/* ======================================================
   SAFE TIMESTAMP FORMATTER
====================================================== */
function formatTimestamp(ts) {
  if (!ts) return "Unknown time";
  if (ts.seconds) return new Date(ts.seconds * 1000).toLocaleString();
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return "Unknown time";
  }
}

/* ======================================================
   BUTTON STYLE HELPER
====================================================== */
function btn(bg, color = "#111") {
  return `
    background:${bg};
    color:${color};
    border:none;
    padding:6px 10px;
    border-radius:8px;
    cursor:pointer;
    margin-left:6px;
    font-size:12px;
  `;
}

/* ======================================================
   LIGHT PHONE CHECK (UI ONLY)
====================================================== */
function looksLikePhone(phone) {
  if (!phone) return false;
  const p = String(phone).trim();
  // Accept +63XXXXXXXXXX or 09XXXXXXXXX or 9XXXXXXXXX
  return /^(\+63\d{10}|09\d{9}|9\d{9})$/.test(p.replace(/\s+/g, ""));
}

/* ======================================================
   OPEN SMS PREVIEW MODAL
====================================================== */
export async function openSMSPreview({
  trackingId,
  phone,
  status,
  delayReason = null,
  delayCleared = false,
  delayStartedAt = null,
  userRole
}) {
  /* -----------------------------------------------
     DUPLICATE MODAL GUARD
  ----------------------------------------------- */
  const existing = document.getElementById("smsPreviewModal");
  if (existing) existing.remove();

  /* -----------------------------------------------
     BUILD PREVIEW MESSAGE (NON-AUTHORITATIVE)
  ----------------------------------------------- */
  const message = buildStatusSMS({
    trackingId,
    status,
    delayReason,
    delayCleared
  });

  const canSend = ["admin", "manager"].includes(String(userRole || "").toLowerCase());
  const canResend = canSend;

  const { length, credits, costPhp } = estimateSmsCost(message);
  const delayDuration = getDelayDurationMinutes(delayStartedAt);

  /* -----------------------------------------------
     LOAD SMS HISTORY (SAFE, NON-BLOCKING)
  ----------------------------------------------- */
  let history = [];
  try {
    history = await loadSMSHistory(trackingId, 3);
  } catch {
    console.warn("SMS history unavailable");
  }

  /* -----------------------------------------------
     LOCK SCROLL (NATIVE FEEL)
  ----------------------------------------------- */
  const prevOverflow = document.body.style.overflow;
  document.body.style.overflow = "hidden";

  /* -----------------------------------------------
     CREATE MODAL
  ----------------------------------------------- */
  const modal = document.createElement("div");
  modal.id = "smsPreviewModal";
  modal.style = `
    position:fixed;
    inset:0;
    background:rgba(0,0,0,.45);
    display:flex;
    align-items:center;
    justify-content:center;
    z-index:9999;
    padding:18px;
  `;

  const safeMsg = escapeHtml(message);

  modal.innerHTML = `
    <div id="smsPreviewCard" style="
      background:#fff;
      width:380px;
      border-radius:14px;
      padding:18px;
      font-family:system-ui;
      max-height:85vh;
      overflow:auto;
      box-shadow:0 20px 60px rgba(0,0,0,.25);
    ">
      <h3 style="margin-top:0;">📩 SMS Preview</h3>

      <div style="
        background:#f9fafb;
        padding:12px;
        border-radius:8px;
        font-size:14px;
        white-space:pre-wrap;
        border:1px solid #e5e7eb;
      ">${safeMsg}</div>

      <div style="margin-top:8px;font-size:12px;color:#555;">
        📞 ${escapeHtml(phone || "—")}<br>
        ${length} chars · ${credits} credit${credits > 1 ? "s" : ""} · ₱${Number(costPhp || 0).toFixed(2)}
        ${delayDuration ? `<br>⏱ Delay duration: ${delayDuration} min` : ""}
      </div>

      ${
        history.length
          ? `
        <div style="margin-top:14px;">
          <strong style="font-size:13px;">🧾 Recent SMS</strong>
          <ul style="font-size:12px;padding-left:16px;margin-top:6px;">
            ${history
              .map(
                (h, i) => `
              <li>
                ${escapeHtml(h.status || "—")} · ${escapeHtml(formatTimestamp(h.at))}
                ${
                  canResend && i === 0
                    ? `<button id="resendBtn" style="${btn("#f59e0b")}">Resend</button>`
                    : ""
                }
              </li>
            `
              )
              .join("")}
          </ul>
        </div>
      `
          : ""
      }

      <div style="margin-top:14px;text-align:right;">
        <button id="smsCancel" style="${btn("#e5e7eb")}">Close</button>
        ${
          canSend
            ? `<button id="smsSend" style="${btn("#2563eb", "#fff")}">Send SMS</button>`
            : `<span style="font-size:12px;color:#777;">Preview only</span>`
        }
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  const cleanup = () => {
    document.body.style.overflow = prevOverflow;
    modal.remove();
    window.removeEventListener("keydown", onKey);
  };

  /* -----------------------------------------------
     CLOSE BEHAVIORS
  ----------------------------------------------- */
  const onKey = (e) => {
    if (e.key === "Escape") cleanup();
  };
  window.addEventListener("keydown", onKey);

  // Click outside closes
  modal.addEventListener("click", (e) => {
    if (e.target === modal) cleanup();
  });

  modal.querySelector("#smsCancel").onclick = cleanup;

  /* -----------------------------------------------
     SEND SMS (BACKEND BUILDS FINAL MESSAGE)
  ----------------------------------------------- */
  if (canSend) {
    const functions = getFunctions(undefined, "asia-southeast1");
    const sendSMS = httpsCallable(functions, "sendSMS");

    const sendBtn = modal.querySelector("#smsSend");

    sendBtn.onclick = async () => {
      if (sendBtn.disabled) return;

      if (!looksLikePhone(phone)) {
        alert("⚠ Invalid phone number format.");
        return;
      }

      sendBtn.disabled = true;
      sendBtn.innerText = "Sending…";

      try {
        await sendSMS({
          trackingId,
          phone,
          status,
          delayReason,
          delayCleared
        });

        alert("✅ SMS sent");
        cleanup();
      } catch (e) {
        console.error(e);
        alert("❌ Failed to send SMS");
        sendBtn.disabled = false;
        sendBtn.innerText = "Send SMS";
      }
    };
  }

  /* -----------------------------------------------
     RESEND SMS (BACKEND REBUILD ONLY)
  ----------------------------------------------- */
  if (canResend && history.length) {
    const resendBtn = modal.querySelector("#resendBtn");
    if (resendBtn) {
      resendBtn.onclick = async () => {
        if (resendBtn.disabled) return;

        resendBtn.innerText = "Resending…";
        resendBtn.disabled = true;

        try {
          await resendSMS(history[0]);
          alert("📩 SMS resent");
          cleanup();
        } catch (e) {
          console.error(e);
          alert("❌ Resend failed");
          resendBtn.disabled = false;
          resendBtn.innerText = "Resend";
        }
      };
    }
  }
}
