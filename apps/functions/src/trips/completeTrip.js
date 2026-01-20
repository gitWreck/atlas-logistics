"use strict";

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

/* ======================================================
   HELPERS
====================================================== */
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

async function assertAdminOrManager(tx, uid) {
  const userRef = db.collection("users").doc(uid);
  const snap = await tx.get(userRef);

  if (!snap.exists) throw new HttpsError("permission-denied", "User not found");
  const u = snap.data() || {};
  if (u.active !== true) throw new HttpsError("permission-denied", "Inactive user");

  const role = String(u.role || "").toLowerCase();
  if (role !== "admin" && role !== "manager") {
    throw new HttpsError("permission-denied", "Admin or Manager only");
  }
  return role;
}

function normalizeStatus(s) {
  return String(s || "").trim().toUpperCase();
}

function isDeliveredStatus(status) {
  const s = normalizeStatus(status);
  return s === "DELIVERED" || s === "DELIVERED_COMPLETE" || s === "COMPLETED";
}

function isDelayedStatus(status) {
  const s = normalizeStatus(status);
  return s === "DELAYED";
}

/* ======================================================
   COMPLETE TRIP — VERIFIED DELIVERY LOCK
====================================================== */
exports.completeTrip = onCall(
  { region: "asia-southeast1" },
  async (req) => {
    const uid = requireAuth(req);
    const tripDocId = requireString(req.data?.tripDocId, "tripDocId");

    const tripRef = db.collection("truck_trips").doc(tripDocId);
    const pkgsRef = tripRef.collection("trip_packages");

    return db.runTransaction(async (tx) => {
      const role = await assertAdminOrManager(tx, uid);

      const tripSnap = await tx.get(tripRef);
      if (!tripSnap.exists) throw new HttpsError("not-found", "Trip not found");

      const trip = tripSnap.data() || {};
      if (trip.active === false || normalizeStatus(trip.status) === "COMPLETED") {
        throw new HttpsError("failed-precondition", "Trip already closed");
      }

      const pkgsSnap = await tx.get(pkgsRef);
      if (pkgsSnap.empty) {
        throw new HttpsError("failed-precondition", "Trip has no packages");
      }

      const blockers = [];
      let totalPackages = 0;
      let totalCount = 0;
      let totalDelivered = 0;
      let anyDelayed = false;

      pkgsSnap.forEach((doc) => {
        const p = doc.data() || {};
        totalPackages++;

        const packageCount = Number(p.packageCount || 0);
        const deliveredCount = Number(p.deliveredCount || 0);
        const hasPendingCount = typeof p.pendingCount === "number";

        if (!Number.isFinite(packageCount) || packageCount <= 0) {
          blockers.push({
            packageId: doc.id,
            trackingNumber: p.trackingNumber || null,
            reason: "MISSING_OR_INVALID_PACKAGECOUNT",
            packageCount,
            deliveredCount,
            pendingCount: p.pendingCount ?? null,
          });
          return;
        }

        if (!hasPendingCount) {
          blockers.push({
            packageId: doc.id,
            trackingNumber: p.trackingNumber || null,
            reason: "MISSING_PENDINGCOUNT",
            packageCount,
            deliveredCount,
            pendingCount: null,
          });
          return;
        }

        const pendingCount = Number(p.pendingCount);
        totalCount += packageCount;
        totalDelivered += Math.max(0, deliveredCount);

        const status = p.status;
        const delayReason = p.delayReason || null;
        const delayClearedAt = p.delayClearedAt || null;

        if (pendingCount > 0) {
          blockers.push({
            packageId: doc.id,
            trackingNumber: p.trackingNumber || null,
            pendingCount,
            status,
            reason: delayReason,
          });
          return;
        }

        if (!isDeliveredStatus(status)) {
          if (isDelayedStatus(status)) anyDelayed = true;
          blockers.push({
            packageId: doc.id,
            trackingNumber: p.trackingNumber || null,
            pendingCount,
            status,
            reason: delayReason,
            delayClearedAt,
          });
        }
      });

      if (blockers.length) {
        throw new HttpsError("failed-precondition", "Trip cannot be closed", {
          reason: anyDelayed ? "DELAY_BLOCK" : "PENDING_OR_STATUS_BLOCK",
          tripDocId,
          blockers,
        });
      }

      // ✅ Close trip
      tx.update(tripRef, {
        active: false,
        status: "COMPLETED",
        completedAt: admin.firestore.FieldValue.serverTimestamp(),
        lastUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
        lastUpdatedBy: uid,
        lastUpdatedRole: role,
      });

      tx.set(db.collection("admin_logs").doc(), {
        action: "COMPLETE_TRIP",
        tripDocId,
        actorId: uid,
        actorRole: role,
        totalPackages,
        totalCount,
        totalDelivered,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      return {
        success: true,
        tripDocId,
        totalPackages,
        totalCount,
        totalDelivered,
        status: "COMPLETED",
      };
    });
  }
);
