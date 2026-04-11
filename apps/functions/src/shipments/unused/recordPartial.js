"use strict";

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const { writeAuditLog } = require("../../../_shared");

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

/* =========================
   HELPERS
========================= */
function requireAuth(req) {
  if (!req.auth?.uid) throw new HttpsError("unauthenticated", "Login required");
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
    throw new HttpsError(
      "invalid-argument",
      `${field} must be a positive integer`,
    );
  }
  return n;
}

async function getUser(tx, uid) {
  const snap = await tx.get(db.collection("users").doc(uid));
  if (!snap.exists) throw new HttpsError("permission-denied", "User not found");
  const u = snap.data() || {};
  if (u.active !== true)
    throw new HttpsError("permission-denied", "Inactive user");
  const role = String(u.role || "").toLowerCase();
  if (!["admin", "manager", "checker"].includes(role)) {
    throw new HttpsError("permission-denied", "Admin/Manager/Checker only");
  }
  return { role, name: u.name || "" };
}

/* =========================
   recordPartial
   - reduce loadedCount
   - increase pendingCount
   - audit log
========================= */
exports.recordPartial = onCall({ region: "asia-southeast1" }, async (req) => {
  const uid = requireAuth(req);

  const tripDocId = requireString(req.data?.tripDocId, "tripDocId");
  const packageId = requireString(req.data?.packageId, "packageId"); // trip_packages doc id (your trackingDocId)
  const partialCount = requirePosInt(req.data?.partialCount, "partialCount");
  const reason = requireString(req.data?.reason, "reason");

  const tripRef = db.collection("truck_trips").doc(tripDocId);
  const pkgRef = tripRef.collection("trip_packages").doc(packageId);
  const trackingRef = db.collection("tracking_records").doc(packageId);

  return db.runTransaction(async (tx) => {
    const user = await getUser(tx, uid);

    const [tripSnap, pkgSnap, trackingSnap] = await Promise.all([
      tx.get(tripRef),
      tx.get(pkgRef),
      tx.get(trackingRef),
    ]);

    if (!tripSnap.exists) throw new HttpsError("not-found", "Trip not found");
    if (!pkgSnap.exists)
      throw new HttpsError("not-found", "Trip package not found");
    if (!trackingSnap.exists)
      throw new HttpsError("not-found", "Tracking not found");

    const trip = tripSnap.data() || {};
    if (
      trip.active === false ||
      String(trip.status || "").toUpperCase() === "COMPLETED"
    ) {
      throw new HttpsError("failed-precondition", "Trip already closed");
    }

    const pkg = pkgSnap.data() || {};
    const tracking = trackingSnap.data() || {};

    const loaded = Number(pkg.loadedCount || 0);
    const pending = Number(pkg.pendingCount || 0);

    if (loaded <= 0) {
      throw new HttpsError(
        "failed-precondition",
        "No loaded items to mark partial",
      );
    }

    const moveBack = Math.min(partialCount, loaded);

    const before = {
      loadedCount: loaded,
      pendingCount: pending,
    };

    const newLoaded = loaded - moveBack;
    const newPending = pending + moveBack;

    // Update trip_packages counts
    tx.update(pkgRef, {
      loadedCount: newLoaded,
      pendingCount: newPending,
      lastUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
      lastUpdatedBy: uid,
      lastUpdatedRole: user.role,
    });

    // Keep tracking_records aggregates consistent
    tx.update(trackingRef, {
      loadedCount: Math.max(0, Number(tracking.loadedCount || 0) - moveBack),
      pendingCount: Number(tracking.pendingCount || 0) + moveBack,
      lastUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
      lastUpdatedBy: uid,
      lastUpdatedRole: user.role,
    });

    // Optional: keep trip totalLoaded consistent if you use it
    tx.update(tripRef, {
      totalLoaded: admin.firestore.FieldValue.increment(-moveBack),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    const after = {
      loadedCount: newLoaded,
      pendingCount: newPending,
    };

    await writeAuditLog(tx, {
      action: "RECORD_PARTIAL",
      tripDocId,
      trackingDocId: packageId,
      before,
      after,
      uid,
      role: user.role,
      extra: {
        partialCountRequested: partialCount,
        partialCountApplied: moveBack,
        reason,
      },
    });

    return {
      success: true,
      movedBack: moveBack,
      loadedAfter: newLoaded,
      pendingAfter: newPending,
    };
  });
});
