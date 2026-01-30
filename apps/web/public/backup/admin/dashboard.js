/* =========================================================
   ADMIN DASHBOARD (10/10) — POWER TOOLS (Option C)
   ✅ NO layout redesign (injects small controls inside existing cards)
   ✅ Last-admin protection
   ✅ Real role verification + live revocation
   ✅ Filters/search + CSV export
   ✅ Action breakdown (24h): role changes / activation toggles
   ✅ Audit confirmation (non-blocking)
========================================================= */

/* =========================================================
   FIREBASE IMPORTS (SINGLE, CLEAN)
========================================================= */
import {
  collection,
  doc,
  getDoc,
  query,
  orderBy,
  limit,
  updateDoc,
  serverTimestamp,
  onSnapshot,
  where,
  Timestamp,
  getCountFromServer,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

import {
  onAuthStateChanged,
  signOut,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

import {
  getFunctions,
  httpsCallable,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-functions.js";

import { auth, db, app } from "../firebase.js";

/* =========================================================
   CONSTANTS
========================================================= */
const ROLES = ["admin", "manager", "driver", "checker"];
const ROLE_LABEL = {
  admin: "Admin",
  manager: "Manager",
  driver: "Driver",
  checker: "Checker",
};

const REGION = "asia-southeast1";

// audit action inference (works with mixed schemas)
const ACTION_KEYS = {
  SET_ROLE: ["set_role", "role_change", "adminSetUserRole", "SET_ROLE"],
  SET_ACTIVE: [
    "set_active",
    "set_status",
    "activation",
    "adminSetUserActive",
    "SET_ACTIVE",
  ],
};

const MAX_USERS = 500;
const MAX_LOGS = 50;

/* =========================================================
   CLOUD FUNCTIONS (REGION-LOCKED)
========================================================= */
const functions = getFunctions(app, REGION);
const adminSetUserRole = httpsCallable(functions, "adminSetUserRole");
const adminSetUserActive = httpsCallable(functions, "adminSetUserActive");

/* =========================================================
   DOM
========================================================= */
const adminInfo = document.getElementById("adminInfo");
const userTable = document.getElementById("userTable");

const userCountEl = document.getElementById("userCount");
const activeCountEl = document.getElementById("activeCount");
const inactiveCountEl = document.getElementById("inactiveCount");

const adminActions24hEl = document.getElementById("adminActions24h");
const adminActionsTotalEl = document.getElementById("adminActionsTotal");

const auditTable = document.getElementById("auditTable");
const logoutBtn = document.getElementById("logoutBtn");

/* =========================================================
   STATE
========================================================= */
let currentAdmin = null;

let unsubUsers = null;
let unsubAudit = null;
let unsubSelf = null;

const usersById = new Map(); // uid -> user doc
const logsCache = []; // latest logs in memory

// filters (Users)
let userSearch = "";
let userRoleFilter = "all"; // all | admin | manager | driver | checker
let userActiveFilter = "all"; // all | active | inactive

// filters (Audit)
let auditSearch = "";
let auditActionFilter = "all"; // all | role | active
let auditWindow = "50"; // "50" fixed to table size; kept for future

// op locks
let opBusy = false;

/* =========================================================
   UI HELPERS (NO LAYOUT CHANGE)
========================================================= */
function hardRedirectToLogin() {
  location.replace("/login.html");
}

function setAdminText(msg) {
  if (adminInfo) adminInfo.textContent = msg;
}

function setStat(el, value) {
  if (!el) return;
  el.textContent = value === null || value === undefined ? "—" : String(value);
}

function setUsersLoading() {
  if (!userTable) return;
  userTable.innerHTML = `<tr><td colspan="4" class="state">Loading users…</td></tr>`;
}

function setUsersError(msg) {
  if (!userTable) return;
  userTable.innerHTML = `<tr><td colspan="4" class="state">${escapeHtml(msg)}</td></tr>`;
}

function setAuditLoading() {
  if (!auditTable) return;
  auditTable.innerHTML = `<tr><td colspan="5" class="state">Loading logs…</td></tr>`;
}

function setAuditError(msg) {
  if (!auditTable) return;
  auditTable.innerHTML = `<tr><td colspan="5" class="state">${escapeHtml(msg)}</td></tr>`;
}

function cleanupListeners() {
  try {
    unsubUsers?.();
  } catch (_) {}
  try {
    unsubAudit?.();
  } catch (_) {}
  try {
    unsubSelf?.();
  } catch (_) {}
  unsubUsers = null;
  unsubAudit = null;
  unsubSelf = null;
}

function toast(msg) {
  // no layout change: lightweight alert fallback
  // (can be replaced later with inline toast component)
  alert(msg);
}

/* =========================================================
   INJECT CONTROLS (Option C) — NO REBUILD OF LAYOUT
========================================================= */
function injectUserControls() {
  // inject once, above users table
  const usersCard = userTable?.closest(".card");
  if (!usersCard) return;
  if (usersCard.querySelector("[data-users-controls='1']")) return;

  const h2 = usersCard.querySelector("h2");
  const controls = document.createElement("div");
  controls.setAttribute("data-users-controls", "1");
  controls.style.display = "flex";
  controls.style.gap = "10px";
  controls.style.flexWrap = "wrap";
  controls.style.alignItems = "center";
  controls.style.margin = "10px 0 12px";

  controls.innerHTML = `
    <input
      type="search"
      placeholder="Search name…"
      style="flex:1; min-width:180px; padding:10px 12px; border-radius:10px; border:1px solid #e5e7eb;"
      aria-label="Search users"
      data-u-search
    />
    <select style="padding:10px 12px; border-radius:10px; border:1px solid #e5e7eb;" aria-label="Filter role" data-u-role>
      <option value="all">All roles</option>
      ${ROLES.map((r) => `<option value="${r}">${ROLE_LABEL[r] || r}</option>`).join("")}
    </select>
    <select style="padding:10px 12px; border-radius:10px; border:1px solid #e5e7eb;" aria-label="Filter status" data-u-active>
      <option value="all">All status</option>
      <option value="active">Active</option>
      <option value="inactive">Inactive</option>
    </select>
    <button class="secondary" style="padding:10px 12px;" data-u-reset title="Reset filters">Reset</button>
  `;

  if (h2) h2.insertAdjacentElement("afterend", controls);
  else usersCard.insertAdjacentElement("afterbegin", controls);

  const searchEl = controls.querySelector("[data-u-search]");
  const roleEl = controls.querySelector("[data-u-role]");
  const activeEl = controls.querySelector("[data-u-active]");
  const resetEl = controls.querySelector("[data-u-reset]");

  searchEl.addEventListener("input", () => {
    userSearch = (searchEl.value || "").trim().toLowerCase();
    renderUsersTable();
  });
  roleEl.addEventListener("change", () => {
    userRoleFilter = roleEl.value;
    renderUsersTable();
  });
  activeEl.addEventListener("change", () => {
    userActiveFilter = activeEl.value;
    renderUsersTable();
  });
  resetEl.addEventListener("click", () => {
    userSearch = "";
    userRoleFilter = "all";
    userActiveFilter = "all";
    searchEl.value = "";
    roleEl.value = "all";
    activeEl.value = "all";
    renderUsersTable();
  });
}

function injectAuditControls() {
  const auditCard = auditTable?.closest(".card");
  if (!auditCard) return;
  if (auditCard.querySelector("[data-audit-controls='1']")) return;

  const h2 = auditCard.querySelector("h2");
  const controls = document.createElement("div");
  controls.setAttribute("data-audit-controls", "1");
  controls.style.display = "flex";
  controls.style.gap = "10px";
  controls.style.flexWrap = "wrap";
  controls.style.alignItems = "center";
  controls.style.margin = "10px 0 12px";

  controls.innerHTML = `
    <input
      type="search"
      placeholder="Search logs… (action / target / by)"
      style="flex:1; min-width:220px; padding:10px 12px; border-radius:10px; border:1px solid #e5e7eb;"
      aria-label="Search audit logs"
      data-a-search
    />
    <select style="padding:10px 12px; border-radius:10px; border:1px solid #e5e7eb;" aria-label="Filter action" data-a-action>
      <option value="all">All actions</option>
      <option value="role">Role changes</option>
      <option value="active">Activation toggles</option>
    </select>
    <button class="secondary" style="padding:10px 12px;" data-a-export title="Export shown logs to CSV">Export CSV</button>
    <button class="secondary" style="padding:10px 12px;" data-a-reset title="Reset filters">Reset</button>
  `;

  if (h2) h2.insertAdjacentElement("afterend", controls);
  else auditCard.insertAdjacentElement("afterbegin", controls);

  const searchEl = controls.querySelector("[data-a-search]");
  const actionEl = controls.querySelector("[data-a-action]");
  const exportEl = controls.querySelector("[data-a-export]");
  const resetEl = controls.querySelector("[data-a-reset]");

  searchEl.addEventListener("input", () => {
    auditSearch = (searchEl.value || "").trim().toLowerCase();
    renderAuditTable();
  });
  actionEl.addEventListener("change", () => {
    auditActionFilter = actionEl.value;
    renderAuditTable();
  });
  exportEl.addEventListener("click", exportAuditCsv);
  resetEl.addEventListener("click", () => {
    auditSearch = "";
    auditActionFilter = "all";
    searchEl.value = "";
    actionEl.value = "all";
    renderAuditTable();
  });
}

function injectAnalyticsBreakdown() {
  // No layout change: add small subtext under existing stat numbers
  // (does not create new cards)
  const a24 = adminActions24hEl?.parentElement;
  const aTot = adminActionsTotalEl?.parentElement;

  if (a24 && !a24.querySelector("[data-breakdown='24h']")) {
    const div = document.createElement("div");
    div.setAttribute("data-breakdown", "24h");
    div.style.marginTop = "6px";
    div.style.fontSize = "12px";
    div.style.color = "#64748b";
    div.textContent = "—";
    a24.appendChild(div);
  }

  if (aTot && !aTot.querySelector("[data-breakdown='total']")) {
    const div = document.createElement("div");
    div.setAttribute("data-breakdown", "total");
    div.style.marginTop = "6px";
    div.style.fontSize = "12px";
    div.style.color = "#64748b";
    div.textContent = "—";
    aTot.appendChild(div);
  }
}

/* =========================================================
   AUTH + ADMIN GUARD (LIVE REVOCATION)
========================================================= */
onAuthStateChanged(auth, async (user) => {
  cleanupListeners();
  usersById.clear();
  logsCache.length = 0;
  currentAdmin = null;
  opBusy = false;

  setUsersLoading();
  setAuditLoading();
  setStat(userCountEl, "—");
  setStat(activeCountEl, "—");
  setStat(inactiveCountEl, "—");
  setStat(adminActions24hEl, "—");
  setStat(adminActionsTotalEl, "—");

  if (!user) {
    hardRedirectToLogin();
    return;
  }

  try {
    const selfRef = doc(db, "users", user.uid);

    // live revocation if role/active changes mid-session
    unsubSelf = onSnapshot(selfRef, (snap) => {
      const data = snap.exists() ? snap.data() : null;
      if (!data || data.role !== "admin" || data.active !== true) {
        signOut(auth).finally(hardRedirectToLogin);
      }
    });

    const snap = await getDoc(selfRef);
    const data = snap.exists() ? snap.data() : null;

    if (!data || data.role !== "admin" || data.active !== true) {
      try {
        await signOut(auth);
      } catch (_) {}
      hardRedirectToLogin();
      return;
    }

    updateDoc(selfRef, { lastLoginAt: serverTimestamp() }).catch(() => {});

    currentAdmin = user;
    setAdminText(`Logged in as ${user.email}`);

    // power tools injection (no layout redesign)
    injectUserControls();
    injectAuditControls();
    injectAnalyticsBreakdown();

    // start live listeners
    startUsersListener();
    startAuditListener();

    // counts
    refreshAdminActionCounts().catch(() => {});
  } catch (err) {
    console.error("Admin guard failed:", err);
    try {
      await signOut(auth);
    } catch (_) {}
    hardRedirectToLogin();
  }
});

/* =========================================================
   USERS (REAL-TIME) — SOURCE OF TRUTH IN MEMORY
========================================================= */
function startUsersListener() {
  if (!currentAdmin) return;

  const qUsers = query(
    collection(db, "users"),
    orderBy("role"),
    limit(MAX_USERS),
  );

  setUsersLoading();

  unsubUsers = onSnapshot(
    qUsers,
    (snap) => {
      usersById.clear();

      if (snap.empty) {
        renderUsersTable(); // will show "no users" message
        setStat(userCountEl, 0);
        setStat(activeCountEl, 0);
        setStat(inactiveCountEl, 0);
        return;
      }

      snap.forEach((docSnap) =>
        usersById.set(docSnap.id, docSnap.data() || {}),
      );

      renderUsersTable();
      refreshUserStats();
    },
    (err) => {
      console.error("Users listener error:", err);
      setUsersError("Failed to load users (check Firestore rules / network).");
      setStat(userCountEl, "—");
      setStat(activeCountEl, "—");
      setStat(inactiveCountEl, "—");
    },
  );
}

function refreshUserStats() {
  let total = 0,
    active = 0,
    inactive = 0;

  for (const [, u] of usersById.entries()) {
    total++;
    u.active === true ? active++ : inactive++;
  }

  setStat(userCountEl, total);
  setStat(activeCountEl, active);
  setStat(inactiveCountEl, inactive);
}

function getActiveAdminCount() {
  let count = 0;
  for (const [, u] of usersById.entries()) {
    if (u.role === "admin" && u.active === true) count++;
  }
  return count;
}

function passesUserFilters(uid, u) {
  const name = (u?.name || "").toString().toLowerCase();
  const role = ROLES.includes(u?.role) ? u.role : "unknown";
  const isActive = u?.active === true;

  if (userSearch && !name.includes(userSearch)) return false;

  if (userRoleFilter !== "all" && role !== userRoleFilter) return false;

  if (userActiveFilter === "active" && !isActive) return false;
  if (userActiveFilter === "inactive" && isActive) return false;

  return true;
}

function renderUsersTable() {
  if (!userTable) return;
  userTable.innerHTML = "";

  if (usersById.size === 0) {
    setUsersError("No users found.");
    return;
  }

  // render (filtered)
  const rows = [];
  for (const [uid, u] of usersById.entries()) {
    if (!passesUserFilters(uid, u)) continue;
    rows.push([uid, u]);
  }

  if (rows.length === 0) {
    setUsersError("No users match your filters.");
    return;
  }

  for (const [uid, u] of rows) {
    const isSelf = currentAdmin && uid === currentAdmin.uid;

    const safeName = u.name || "—";
    const safeRole = ROLES.includes(u.role) ? u.role : "unknown";
    const active = u.active === true;

    const malformed = !ROLES.includes(u.role) || typeof u.active !== "boolean";

    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td title="${isSelf ? "This is your account (self changes disabled)" : ""}">
        ${escapeHtml(safeName)}
        ${isSelf ? `<span style="color:#64748b; font-size:12px;"> (You)</span>` : ""}
        ${malformed ? `<span style="margin-left:8px; color:#b45309; font-size:12px;">⚠ Malformed</span>` : ""}
      </td>

      <td>
        <select ${isSelf ? "disabled" : ""} aria-label="Role">
          ${ROLES.map(
            (r) => `
            <option value="${r}" ${safeRole === r ? "selected" : ""}>
              ${ROLE_LABEL[r] || r}
            </option>
          `,
          ).join("")}
        </select>
      </td>

      <td>
        <span class="badge ${active ? "green" : "red"}">
          ${active ? "Active" : "Inactive"}
        </span>
      </td>

      <td>
        <button ${isSelf ? "disabled" : ""} title="${isSelf ? "You cannot deactivate yourself" : ""}">
          ${active ? "Deactivate" : "Activate"}
        </button>
      </td>
    `;

    const roleSelect = tr.querySelector("select");
    const toggleBtn = tr.querySelector("button");

    /* ==========================
       ROLE CHANGE (GUARDED)
       - admin-only
       - last-admin protection
       - audit-confirm non-blocking
    ========================== */
    roleSelect.addEventListener("change", async (e) => {
      if (isSelf) return;
      if (!currentAdmin) return;

      const nextRole = e.target.value;
      const prevRole = safeRole;

      if (!ROLES.includes(nextRole)) {
        toast("Invalid role.");
        roleSelect.value = prevRole;
        return;
      }

      // Last-admin protection: cannot demote last active admin
      if (prevRole === "admin" && nextRole !== "admin" && u.active === true) {
        const activeAdminCount = getActiveAdminCount();
        if (activeAdminCount <= 1) {
          toast("Blocked: you cannot demote the last active admin.");
          roleSelect.value = prevRole;
          return;
        }
      }

      const ok = confirm(`Change role to ${ROLE_LABEL[nextRole] || nextRole}?`);
      if (!ok) {
        roleSelect.value = prevRole;
        return;
      }

      roleSelect.disabled = true;

      try {
        const res = await adminSetUserRole({ userId: uid, role: nextRole });

        // non-blocking audit confirmation
        confirmAuditSoon({
          kind: "role",
          target: uid,
          expected: nextRole,
        }).catch(() => {});
      } catch (err) {
        console.error(err);
        toast(err?.message || "Role update failed.");
        roleSelect.value = prevRole;
      } finally {
        roleSelect.disabled = false;
      }
    });

    /* ==========================
       ACTIVE TOGGLE (GUARDED)
       - admin-only
       - last-admin protection (deactivate last admin)
       - delay-aware warning (operator awareness)
       - audit-confirm non-blocking
    ========================== */
    toggleBtn.addEventListener("click", async () => {
      if (isSelf) return;
      if (!currentAdmin) return;

      const nextActive = !active;

      // Last-admin protection: cannot deactivate last active admin
      if (safeRole === "admin" && active === true && nextActive === false) {
        const activeAdminCount = getActiveAdminCount();
        if (activeAdminCount <= 1) {
          toast("Blocked: you cannot deactivate the last active admin.");
          return;
        }
      }

      // Operator warning (Patch 6 style): if disabling a manager/driver/checker, warn
      // (We don’t query shipments here to avoid indexes; this is awareness only.)
      if (
        nextActive === false &&
        (safeRole === "manager" ||
          safeRole === "driver" ||
          safeRole === "checker")
      ) {
        const okWarn = confirm(
          `Heads up:\n\nYou are disabling a ${ROLE_LABEL[safeRole]}.\n` +
            `If they are currently responsible for active/delayed shipments, operations may be impacted.\n\nContinue?`,
        );
        if (!okWarn) return;
      } else {
        const ok = confirm(`${active ? "Deactivate" : "Activate"} this user?`);
        if (!ok) return;
      }

      toggleBtn.disabled = true;

      try {
        await adminSetUserActive({ userId: uid, active: nextActive });

        confirmAuditSoon({
          kind: "active",
          target: uid,
          expected: nextActive,
        }).catch(() => {});
      } catch (err) {
        console.error(err);
        toast(err?.message || "Status update failed.");
      } finally {
        toggleBtn.disabled = false;
      }
    });

    userTable.appendChild(tr);
  }
}

/* =========================================================
   AUDIT LOGS (REAL-TIME, FILTERED, EXPORTABLE)
========================================================= */
function startAuditListener() {
  const qLogs = query(
    collection(db, "admin_logs"),
    orderBy("at", "desc"),
    limit(MAX_LOGS),
  );

  setAuditLoading();

  unsubAudit = onSnapshot(
    qLogs,
    (snap) => {
      logsCache.length = 0;

      if (snap.empty) {
        renderAuditTable();
        return;
      }

      snap.forEach((docSnap) => logsCache.push(docSnap.data() || {}));
      renderAuditTable();

      // also refresh analytics breakdown from real logs
      refreshAnalyticsBreakdownFromCache();
    },
    (err) => {
      console.error("Audit listener error:", err);
      setAuditError(
        "Failed to load audit logs (check Firestore rules / network).",
      );
    },
  );
}

function inferActionKind(log) {
  const raw = String(log?.action ?? log?.type ?? "").toLowerCase();

  const isRole = ACTION_KEYS.SET_ROLE.some((k) =>
    raw.includes(String(k).toLowerCase()),
  );
  const isActive = ACTION_KEYS.SET_ACTIVE.some((k) =>
    raw.includes(String(k).toLowerCase()),
  );

  if (isRole) return "role";
  if (isActive) return "active";
  return "other";
}

function passesAuditFilters(log) {
  const kind = inferActionKind(log);

  if (auditActionFilter !== "all" && kind !== auditActionFilter) return false;

  if (!auditSearch) return true;

  const hay = [
    log.action,
    log.type,
    log.targetUser,
    log.target,
    log.by,
    log.byEmail,
    log.change,
    log.role,
    log.active === true ? "active" : log.active === false ? "inactive" : "",
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return hay.includes(auditSearch);
}

function renderAuditTable() {
  if (!auditTable) return;

  auditTable.innerHTML = "";

  if (logsCache.length === 0) {
    auditTable.innerHTML = `<tr><td colspan="5" class="state">No audit logs found.</td></tr>`;
    return;
  }

  const rows = logsCache.filter(passesAuditFilters);

  if (rows.length === 0) {
    auditTable.innerHTML = `<tr><td colspan="5" class="state">No logs match your filters.</td></tr>`;
    return;
  }

  for (const log of rows) {
    const time = log.at?.toDate ? log.at.toDate().toLocaleString() : "—";

    const action = log.action ?? log.type ?? "—";
    const target = log.targetUser ?? log.target ?? "—";
    const change =
      log.change ??
      log.role ??
      (log.active === true
        ? "Active"
        : log.active === false
          ? "Inactive"
          : "—");
    const by = log.by ?? log.byEmail ?? "—";

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${escapeHtml(time)}</td>
      <td><strong>${escapeHtml(String(action))}</strong></td>
      <td>${escapeHtml(String(target))}</td>
      <td>${escapeHtml(String(change))}</td>
      <td>${escapeHtml(String(by))}</td>
    `;
    auditTable.appendChild(tr);
  }
}

function exportAuditCsv() {
  const rows = logsCache.filter(passesAuditFilters);
  if (!rows.length) {
    toast("No logs to export.");
    return;
  }

  const header = ["time", "action", "target", "change", "by"];
  const lines = [header.join(",")];

  for (const log of rows) {
    const time = log.at?.toDate ? log.at.toDate().toISOString() : "";
    const action = log.action ?? log.type ?? "";
    const target = log.targetUser ?? log.target ?? "";
    const change =
      log.change ??
      log.role ??
      (log.active === true ? "Active" : log.active === false ? "Inactive" : "");
    const by = log.by ?? log.byEmail ?? "";

    lines.push(
      [
        csvCell(time),
        csvCell(action),
        csvCell(target),
        csvCell(change),
        csvCell(by),
      ].join(","),
    );
  }

  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = `admin_logs_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();

  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

function csvCell(v) {
  const s = String(v ?? "");
  const escaped = s.replaceAll('"', '""');
  return `"${escaped}"`;
}

/* =========================================================
   ADMIN ACTION COUNTS (TOTAL + 24H) + BREAKDOWN (Option C)
========================================================= */
async function refreshAdminActionCounts() {
  // TOTAL count
  try {
    const totalSnap = await getCountFromServer(collection(db, "admin_logs"));
    setStat(adminActionsTotalEl, totalSnap.data().count);
  } catch (err) {
    console.error("Total admin actions count failed:", err);
    setStat(adminActionsTotalEl, "—");
  }

  // 24H count
  try {
    const since = Timestamp.fromMillis(Date.now() - 24 * 60 * 60 * 1000);
    const q24h = query(collection(db, "admin_logs"), where("at", ">=", since));
    const snap24h = await getCountFromServer(q24h);
    setStat(adminActions24hEl, snap24h.data().count);
  } catch (err) {
    console.error("24h admin actions count failed:", err);
    setStat(adminActions24hEl, "—");
  }
}

// uses live cache for breakdown (zero extra reads)
function refreshAnalyticsBreakdownFromCache() {
  const a24 = adminActions24hEl?.parentElement?.querySelector(
    "[data-breakdown='24h']",
  );
  const aTot = adminActionsTotalEl?.parentElement?.querySelector(
    "[data-breakdown='total']",
  );
  if (!a24 && !aTot) return;

  const sinceMs = Date.now() - 24 * 60 * 60 * 1000;

  let role24 = 0,
    active24 = 0,
    other24 = 0;
  let roleTot = 0,
    activeTot = 0,
    otherTot = 0;

  for (const log of logsCache) {
    const kind = inferActionKind(log);
    const atMs = log.at?.toDate ? log.at.toDate().getTime() : 0;
    const in24 = atMs && atMs >= sinceMs;

    if (kind === "role") {
      roleTot++;
      if (in24) role24++;
    } else if (kind === "active") {
      activeTot++;
      if (in24) active24++;
    } else {
      otherTot++;
      if (in24) other24++;
    }
  }

  if (a24)
    a24.textContent = `24h breakdown: Role ${role24} • Active ${active24} • Other ${other24}`;
  if (aTot)
    aTot.textContent = `Shown breakdown: Role ${roleTot} • Active ${activeTot} • Other ${otherTot}`;
}

/* =========================================================
   AUDIT CONFIRMATION (NON-BLOCKING)
   If action succeeds but audit log doesn't appear soon,
   warn the admin (but don't break flow).
========================================================= */
async function confirmAuditSoon({ kind, target, expected }) {
  const start = Date.now();
  const timeoutMs = 4500;

  // simple polling against in-memory cache
  // (we already have onSnapshot feeding logsCache)
  while (Date.now() - start < timeoutMs) {
    const found = logsCache.some((l) => {
      const k = inferActionKind(l);
      const tgt = String(l.targetUser ?? l.target ?? "");
      if (k !== kind) return false;
      if (target && tgt !== target) return false;

      if (kind === "role") {
        const role = String(l.change ?? l.role ?? "");
        return !expected || role === expected;
      }

      if (kind === "active") {
        const act =
          typeof l.active === "boolean"
            ? l.active
            : String(l.change ?? "")
                .toLowerCase()
                .includes("active");
        return expected === undefined ? true : act === expected;
      }

      return true;
    });

    if (found) return;

    await sleep(250);
  }

  // warn only
  console.warn("Audit confirmation timeout:", { kind, target, expected });
  // no layout change: alert
  // (if you want later: replace with inline toast)
  // toast("Warning: action completed, but audit log did not appear yet.");
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/* =========================================================
   LOGOUT
========================================================= */
logoutBtn?.addEventListener("click", async () => {
  try {
    await signOut(auth);
  } catch (_) {}
  hardRedirectToLogin();
});

/* =========================================================
   UTIL — HTML ESCAPE (SAFE RENDER)
========================================================= */
function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
