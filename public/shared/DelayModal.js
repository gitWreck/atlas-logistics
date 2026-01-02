import { DELAY_REASONS } from "./delay-reasons.js";

/* ======================================================
   SAFE HTML ESCAPE
====================================================== */
function esc(str = "") {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

/* ======================================================
   OPEN DELAY MODAL (CANONICAL, SAFE)
====================================================== */
export function openDelayModal({
  trackingId,
  currentReason = null,
  onSave
}) {
  // 🔒 Prevent duplicate modals
  const existing = document.getElementById("delayModal");
  if (existing) existing.remove();

  const prevOverflow = document.body.style.overflow;
  document.body.style.overflow = "hidden";

  const modal = document.createElement("div");
  modal.id = "delayModal";
  modal.style = `
    position:fixed;
    inset:0;
    background:rgba(0,0,0,.45);
    display:flex;
    align-items:center;
    justify-content:center;
    z-index:9999;
    padding:16px;
  `;

  const options = Object.entries(DELAY_REASONS)
    .map(
      ([k, v]) =>
        `<option value="${esc(k)}" ${
          k === currentReason ? "selected" : ""
        }>${esc(v)}</option>`
    )
    .join("");

  modal.innerHTML = `
    <div id="delayModalCard" style="
      background:#fff;
      width:360px;
      padding:18px;
      border-radius:14px;
      font-family:system-ui;
      box-shadow:0 20px 60px rgba(0,0,0,.25);
    ">
      <h3 style="margin-top:0;">⏱ Truck Delay</h3>

      <div style="font-size:12px;color:#475569;margin-bottom:8px;">
        Tracking ID: <strong>${esc(trackingId)}</strong>
      </div>

      <label style="font-size:13px;">Delay reason</label>
      <select id="delayReason" style="
        width:100%;
        padding:8px;
        margin-top:6px;
        border-radius:8px;
        border:1px solid #cbd5e1;
      ">
        <option value="">— Select reason —</option>
        ${options}
      </select>

      <div style="
        margin-top:16px;
        display:flex;
        justify-content:space-between;
        align-items:center;
      ">
        ${
          currentReason
            ? `<button id="clear" style="
                background:#e5e7eb;
                border:none;
                padding:6px 10px;
                border-radius:8px;
                cursor:pointer;
              ">Clear Delay</button>`
            : `<span></span>`
        }

        <div>
          <button id="cancel" style="
            background:#e5e7eb;
            border:none;
            padding:6px 10px;
            border-radius:8px;
            cursor:pointer;
          ">Cancel</button>

          <button id="save" style="
            background:#dc2626;
            color:#fff;
            border:none;
            padding:6px 12px;
            border-radius:8px;
            cursor:pointer;
            margin-left:6px;
          ">
            Set Delay
          </button>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  const cleanup = () => {
    document.body.style.overflow = prevOverflow;
    modal.remove();
    window.removeEventListener("keydown", onKey);
  };

  /* ===============================
     CLOSE HANDLERS
  =============================== */
  const onKey = (e) => {
    if (e.key === "Escape") cleanup();
  };
  window.addEventListener("keydown", onKey);

  modal.addEventListener("click", (e) => {
    if (e.target === modal) cleanup();
  });

  modal.querySelector("#cancel").onclick = cleanup;

  /* ===============================
     SAVE
  =============================== */
  const saveBtn = modal.querySelector("#save");
  const selectEl = modal.querySelector("#delayReason");

  saveBtn.onclick = async () => {
    if (saveBtn.disabled) return;

    const reason = selectEl.value;
    if (!reason) {
      alert("Select a delay reason");
      return;
    }

    try {
      saveBtn.disabled = true;
      saveBtn.innerText = "Saving…";

      await onSave(reason);
      cleanup();
    } catch (err) {
      console.error("Failed to save delay:", err);
      alert("Failed to set delay. Please try again.");

      saveBtn.disabled = false;
      saveBtn.innerText = "Set Delay";
    }
  };

  /* ===============================
     CLEAR DELAY
  =============================== */
  const clearBtn = modal.querySelector("#clear");
  if (clearBtn) {
    clearBtn.onclick = async () => {
      if (clearBtn.disabled) return;

      try {
        clearBtn.disabled = true;
        clearBtn.innerText = "Clearing…";

        await onSave(null);
        cleanup();
      } catch (err) {
        console.error("Failed to clear delay:", err);
        alert("Failed to clear delay.");

        clearBtn.disabled = false;
        clearBtn.innerText = "Clear Delay";
      }
    };
  }
}
