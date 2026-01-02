"use strict";

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const { writeAuditLog } = require("../_shared");

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

/* ======================================================
   HELPERS
====================================================== */
function requireAuth(req) {
  if (!req.auth?.uid) {
    throw new HttpsError("unauthenticated", "Login required");
  }
  return req.auth.uid;
}

function requireString(v, field) {
  if (typeof v !== "string" || !v.trim()) {
    throw new HttpsError("invalid-argument", `${field} required`);
  }
  return v.trim();
}

function requirePosInt(v, field) {
  const n = Number(v);
  if (!Number.isInteger(n) || n <= 0) {
    throw new HttpsError("invalid-argument", `${field} must be a positive integer`);
  }
  return n;
}

async function assertAdminOrManager(tx, uid) {
  const snap = await tx.get(db.collection("users").doc(uid));
  if (!snap.exists) {
    throw new HttpsError("permission-denied", "User not found");
  }
  const u = snap.data() || {};
  if (u.active !== true) {
    throw new HttpsError("permission-denied", "Inactive user");
  }

  const role = String(u.role || "").toLowerCase();
  if (role !== "admin" && role !== "manager") {
    throw new HttpsError("permission-denied", "Admin or Manager only");
  }
  return role;
}

/* ======================================================
   transitionPackageStatus (internal)
====================================================== */
let transitionInternal;
try {
  transitionInternal =
    require("./transitionPackageStatus").transitionPackageStatusInternal;
} catch (e) {
  transitionInternal = null;
}

async function transition(tx, args) {
  if (!transitionInternal) {
    throw new HttpsError(
      "failed-precondition",
      "transitionPackageStatusInternal not exported"
    );
  }
  return transitionInternal(tx, args);
}

/* ======================================================
   UNLOAD ITEMS (Black-Box Recorded)
====================================================== */
exports.unloadItemsFromTrip = onCall(
  { region: "asia-southeast1" },
  async (req) => {
    const uid = requireAuth(req);

    const tripDocId = requireString(req.data?.tripDocId, "tripDocId");
    const packageId = requireString(req.data?.packageId, "packageId");
    const unloadCount = requirePosInt(req.data?.unloadCount, "unloadCount");

    const reason =
      typeof req.data?.reason === "string" && req.data.reason.trim()
        ? req.data.reason.trim()
        : null;

    const tripRef = db.collection("truck_trips").doc(tripDocId);
    const pkgRef = tripRef.collection("trip_packages").doc(packageId);

    return db.runTransaction(async (tx) => {
      const role = await assertAdminOrManager(tx, uid);

      if (role === "manager" && !reason) {
        throw new HttpsError(
          "invalid-argument",
          "Unload reason required for managers"
        );
      }

      const [tripSnap, pkgSnap] = await Promise.all([
        tx.get(tripRef),
        tx.get(pkgRef),
      ]);

      if (!tripSnap.exists) throw new HttpsError("not-found", "Trip not found");
      if (!pkgSnap.exists)
        throw new HttpsError("not-found", "Trip package not found");

      const trip = tripSnap.data() || {};
      if (trip.active === false || String(trip.status).toUpperCase() === "COMPLETED") {
        throw new HttpsError("failed-precondition", "Trip already closed");
      }

      const pkg = pkgSnap.data() || {};
      const loaded = Number(pkg.loadedCount || 0);
      const pending = Number(pkg.pendingCount || 0);

      if (loaded <= 0) {
        throw new HttpsError(
          "failed-precondition",
          "No loaded items available to unload"
        );
      }

      const actualUnload = Math.min(unloadCount, loaded);

      /* ========= BEFORE SNAPSHOT ========= */
      const before = {
        loadedCount: loaded,
        pendingCount: pending,
        status: pkg.status || null
      };

      const newLoaded = loaded - actualUnload;
      const newPending = pending + actualUnload;

      let nextStatus = "PARTIALLY_LOADED";
      if (newLoaded === 0) nextStatus = "RECEIVED";

      /* ========= UPDATE COUNTS ========= */
      tx.update(pkgRef, {
        loadedCount: newLoaded,
        pendingCount: newPending,
        lastUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
        lastUpdatedBy: uid,
        lastUpdatedRole: role,
      });

      tx.update(tripRef, {
        totalLoaded: admin.firestore.FieldValue.increment(-actualUnload),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      /* ========= STATUS TRANSITION ========= */
      await transition(tx, {
        uid,
        role,
        tripDocId,
        packageId,
        nextStatus,
        remarks: reason || `Unloaded ${actualUnload} item(s)`,
      });

      /* ========= AFTER SNAPSHOT ========= */
      const after = {
        loadedCount: newLoaded,
        pendingCount: newPending,
        status: nextStatus
      };

      /* ========= BLACK-BOX AUDIT ========= */
      await writeAuditLog(tx, {
        trackingDocId: packageId,
        tripDocId,
        action: "UNLOAD_ITEMS",
        before,
        after,
        uid,
        role,
        extra: {
          unloaded: actualUnload,
          reason
        }
      });

      return {
        success: true,
        unloaded: actualUnload,
        loadedAfter: newLoaded,
        pendingAfter: newPending,
      };
    });
  }
);
