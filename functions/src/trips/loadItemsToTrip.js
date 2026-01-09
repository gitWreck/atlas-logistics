"use strict";

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const { writeAuditLog } = require("../../_shared");

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

function requirePosInt(n, field) {
  const x = Number(n);
  if (!Number.isInteger(x) || x <= 0) {
    throw new HttpsError("invalid-argument", `Invalid ${field}`);
  }
  return x;
}

async function assertAdminOrManager(tx, uid) {
  const snap = await tx.get(db.collection("users").doc(uid));
  if (!snap.exists || snap.data()?.active !== true) {
    throw new HttpsError("permission-denied", "Inactive user");
  }
  const role = String(snap.data().role || "").toLowerCase();
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
   LOAD ITEMS (Black-Box Recorded)
====================================================== */
exports.loadItemsToTrip = onCall({ region: "asia-southeast1" }, async (req) => {
  const uid = requireAuth(req);

  const tripDocId = requireString(req.data?.tripDocId, "tripDocId");
  const trackingDocId = requireString(req.data?.trackingDocId, "trackingDocId");
  const requested = requirePosInt(req.data?.loadCount, "loadCount");

  const tripRef = db.collection("truck_trips").doc(tripDocId);
  const trackingRef = db.collection("tracking_records").doc(trackingDocId);
  const pkgRef = tripRef.collection("trip_packages").doc(trackingDocId);

  return db.runTransaction(async (tx) => {
    const role = await assertAdminOrManager(tx, uid);

    const [tripSnap, trackingSnap, pkgSnap] = await Promise.all([
      tx.get(tripRef),
      tx.get(trackingRef),
      tx.get(pkgRef),
    ]);

    if (!tripSnap.exists) throw new HttpsError("not-found", "Trip not found");
    if (!trackingSnap.exists)
      throw new HttpsError("not-found", "Tracking not found");

    const trip = tripSnap.data();
    const tracking = trackingSnap.data();

    if (trip.active === false || trip.status === "COMPLETED") {
      throw new HttpsError("failed-precondition", "Trip already closed");
    }

    const pending = Number(tracking.pendingCount || 0);
    if (pending <= 0) {
      throw new HttpsError("failed-precondition", "No pending items to load");
    }

    const loadNow = Math.min(requested, pending);

    const pkg = pkgSnap.exists ? pkgSnap.data() : {};
    const prevLoaded = Number(pkg.loadedCount || 0);

    /* ===== BEFORE SNAPSHOT ===== */
    const before = {
      loadedCount: prevLoaded,
      pendingCount: pending,
      status: pkg.status || null,
    };

    const newLoaded = prevLoaded + loadNow;
    const newPending = pending - loadNow;

    /* ----------------------------------------------
         Update trip_packages (COUNTS ONLY)
      ---------------------------------------------- */
    if (!pkgSnap.exists) {
      tx.set(pkgRef, {
        trackingDocId,
        trackingNumber: tracking.trackingNumber || null,
        loadedCount: newLoaded,
        pendingCount: newPending,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        createdBy: uid,
        createdRole: role,
        lastUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    } else {
      tx.update(pkgRef, {
        loadedCount: newLoaded,
        pendingCount: newPending,
        lastUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }

    /* ----------------------------------------------
         Update tracking aggregates
      ---------------------------------------------- */
    tx.update(trackingRef, {
      loadedCount: Number(tracking.loadedCount || 0) + loadNow,
      pendingCount: newPending,
      currentTruckTripId: tripDocId,
      lastUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
      lastUpdatedBy: uid,
      lastUpdatedRole: role,
    });

    /* ----------------------------------------------
         Status transition
      ---------------------------------------------- */
    const nextStatus = newPending === 0 ? "FULLY_LOADED" : "PARTIALLY_LOADED";

    await transition(tx, {
      uid,
      role,
      tripDocId,
      packageId: trackingDocId,
      nextStatus,
      remarks: `Loaded ${loadNow} item(s)`,
    });

    /* ===== AFTER SNAPSHOT ===== */
    const after = {
      loadedCount: newLoaded,
      pendingCount: newPending,
      status: nextStatus,
    };

    /* ===== BLACK-BOX AUDIT ===== */
    await writeAuditLog(tx, {
      trackingDocId,
      tripDocId,
      action: "LOAD_ITEMS",
      before,
      after,
      uid,
      role,
      extra: {
        requested,
        loaded: loadNow,
      },
    });

    return {
      success: true,
      loadedNow: loadNow,
      pendingAfter: newPending,
    };
  });
});
