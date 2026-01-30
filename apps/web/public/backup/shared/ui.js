// public/shared/ui.js
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
export const byId = (id) => document.getElementById(id);

export function setText(el, text) {
  if (!el) return;
  el.textContent = text ?? "";
}

export function show(el) {
  if (!el) return;
  el.classList.add("active");
}

export function hide(el) {
  if (!el) return;
  el.classList.remove("active");
}

export function isActive(el) {
  return !!el?.classList?.contains("active");
}

export function escapeHtml(str) {
  return String(str ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;")
    .replaceAll("`", "&#096;");
}

export function fmtDate(ts) {
  if (!ts) return "—";
  try {
    const d =
      typeof ts === "number"
        ? new Date(ts)
        : ts?.toDate
          ? ts.toDate()
          : new Date(ts);
    return d.toLocaleString();
  } catch {
    return "—";
  }
}

// Minimal toast (no deps) — safe in production
let toastEl = null;
let toastTimer = null;

export function toast(msg, type = "info") {
  try {
    if (!toastEl) {
      toastEl = document.createElement("div");
      toastEl.style.position = "fixed";
      toastEl.style.left = "50%";
      toastEl.style.bottom = "18px";
      toastEl.style.transform = "translateX(-50%)";
      toastEl.style.zIndex = "9999";
      toastEl.style.padding = "10px 12px";
      toastEl.style.borderRadius = "12px";
      toastEl.style.boxShadow = "0 14px 40px rgba(0,0,0,.18)";
      toastEl.style.fontFamily = "system-ui,-apple-system,Segoe UI,Roboto,sans-serif";
      toastEl.style.fontSize = "13px";
      toastEl.style.fontWeight = "700";
      toastEl.style.opacity = "0";
      toastEl.style.transition = "opacity .18s ease, transform .18s ease";
      document.body.appendChild(toastEl);
    }

    toastEl.style.background =
      type === "error" ? "#991b1b" : type === "ok" ? "#065f46" : "#0f172a";
    toastEl.style.color = "#fff";
    toastEl.textContent = String(msg || "");
    toastEl.style.opacity = "1";
    toastEl.style.transform = "translateX(-50%) translateY(-2px)";

    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toastEl.style.opacity = "0";
      toastEl.style.transform = "translateX(-50%) translateY(6px)";
    }, 1800);
  } catch {
    console.log("[toast]", msg);
  }
}

export function bindEscToClose({ modals = [], onEsc = null } = {}) {
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    for (const m of modals) {
      if (m && isActive(m)) hide(m);
    }
    if (typeof onEsc === "function") onEsc();
  });
}
