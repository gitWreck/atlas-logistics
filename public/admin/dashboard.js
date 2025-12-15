/* =========================================================
   FIREBASE IMPORTS (SINGLE, CLEAN)
========================================================= */
import {
  collection,
  getDocs,
  getDoc,
  doc,
  query,
  orderBy,
  limit,
  updateDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

import {
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

import {
  getFunctions,
  httpsCallable
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-functions.js";

import { auth, db, app } from "./firebase.js";

/* =========================================================
   CLOUD FUNCTIONS (REGION-LOCKED)
========================================================= */
const functions = getFunctions(app, "asia-southeast1");

const adminSetUserRole =
  httpsCallable(functions, "adminSetUserRole");

const adminSetUserActive =
  httpsCallable(functions, "adminSetUserActive");

/* =========================================================
   DOM
========================================================= */
const adminInfo = document.getElementById("adminInfo");
const userTable = document.getElementById("userTable");

const userCountEl = document.getElementById("userCount");
const activeCountEl = document.getElementById("activeCount");
const inactiveCountEl = document.getElementById("inactiveCount");

const auditTable = document.getElementById("auditTable");

let currentAdmin = null;

/* =========================================================
   AUTH + ADMIN GUARD
========================================================= */
onAuthStateChanged(auth, async user => {
  if (!user) {
    location.href = "./login.html";
    return;
  }

  const snap = await getDoc(doc(db, "users", user.uid));
  const data = snap.data();

  if (!data || data.role !== "admin") {
    alert("Access denied");
    await signOut(auth);
    location.href = "./login.html";
    return;
  }

  /* 👤 LAST LOGIN TRACKING (NON-BLOCKING, SAFE) */
  updateDoc(doc(db, "users", user.uid), {
    lastLoginAt: serverTimestamp()
  }).catch(console.warn);

  currentAdmin = user;
  adminInfo.textContent = `Logged in as ${user.email}`;

  loadUsers();
  loadAuditLogs();
});

/* =========================================================
   LOAD USERS + ADMIN ANALYTICS
========================================================= */
async function loadUsers() {
  const snap = await getDocs(collection(db, "users"));

  userTable.innerHTML = "";

  let total = 0;
  let active = 0;
  let inactive = 0;

  snap.forEach(docSnap => {
    const u = docSnap.data();
    const uid = docSnap.id;

    total++;
    u.active ? active++ : inactive++;

    const isSelf = uid === currentAdmin.uid;

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${u.name || "—"}</td>

      <td>
        <select ${isSelf ? "disabled" : ""}>
          <option value="user" ${u.role === "user" ? "selected" : ""}>User</option>
          <option value="admin" ${u.role === "admin" ? "selected" : ""}>Admin</option>
        </select>
      </td>

      <td>
        <span class="badge ${u.active ? "green" : "red"}">
          ${u.active ? "Active" : "Inactive"}
        </span>
      </td>

      <td>
        <button ${isSelf ? "disabled" : ""}>
          ${u.active ? "Deactivate" : "Activate"}
        </button>
      </td>
    `;

    /* ================= ROLE CHANGE ================= */
    tr.querySelector("select").addEventListener("change", async e => {
      try {
        await adminSetUserRole({
          userId: uid,
          role: e.target.value
        });
        loadUsers();
      } catch (err) {
        alert(err.message || "Role update failed");
        loadUsers();
      }
    });

    /* ================= ACTIVE TOGGLE ================= */
    tr.querySelector("button").addEventListener("click", async () => {
      try {
        await adminSetUserActive({
          userId: uid,
          active: !u.active // ✅ critical toggle fix
        });
        loadUsers();
      } catch (err) {
        alert(err.message || "Status update failed");
        loadUsers();
      }
    });

    userTable.appendChild(tr);
  });

  /* 📊 ADMIN ANALYTICS */
  userCountEl.textContent = total;
  activeCountEl.textContent = active;
  inactiveCountEl.textContent = inactive;
}

/* =========================================================
   LOAD AUDIT LOGS (READ-ONLY, SAFE)
========================================================= */
async function loadAuditLogs() {
  const q = query(
    collection(db, "admin_logs"),
    orderBy("at", "desc"),
    limit(50)
  );

  const snap = await getDocs(q);
  auditTable.innerHTML = "";

  if (snap.empty) {
    auditTable.innerHTML =
      `<tr><td colspan="5">No audit logs found.</td></tr>`;
    return;
  }

  snap.forEach(docSnap => {
    const log = docSnap.data();

    /* 🛡 SAFE TIMESTAMP HANDLING */
    const time = log.at?.toDate
      ? log.at.toDate().toLocaleString()
      : "—";

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${time}</td>
      <td><strong>${log.action}</strong></td>
      <td>${log.targetUser}</td>
      <td>${log.role ?? log.active}</td>
      <td>${log.by}</td>
    `;
    auditTable.appendChild(tr);
  });
}

/* =========================================================
   LOGOUT
========================================================= */
document.getElementById("logoutBtn").onclick = async () => {
  await signOut(auth);
  location.href = "./login.html";
};
