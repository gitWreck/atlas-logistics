"use strict";

/**
 * ======================================================
 * transitionPackageStatus.js (FINAL 15/10 — Option B)
 * ======================================================
 * ✅ Single authoritative package transition state machine
 * ✅ Delay-aware (WEATHER / RORO) — manual only
 * ✅ Trip-aware: package cannot outrun truck trip status
 * ✅ Idempotent + safe against double-click delivery
 * ✅ Updates trip_packages fields used by UI:
 *    - status, statusIndex
 *    - deliveredCount, deliveryProgress
 *    - delayReason, delayStartedAt, delayClearedAt
 *    - deliveredAt, deliveredBy, deliveredByName
 * ✅ Append-only status_events under trip_package
 * ✅ Writes admin_logs audit record (server-only)
 * ✅ Structured errors for UI
 *
 * EXPECTED DATA MODEL (your screenshots):
 * truck_trips/{tripDocId}
 *   trip_packages/{tripPackageId}
 *     status_events/{eventId}
 *
 * trip_packages doc should include:
 *  - packageCount (int)
 *  - deliveredCount (int)
 *  - deliveryProgress (0..1)
 *  - status (string)
 *  - statusIndex (int)
 *  - delayReason (string|null)
 *  - delayStartedAt (timestamp|null)
 *  - delayClearedAt (timestamp|null)
 *  - deliveredAt (timestamp|null)
 *  - deliveredBy (string|null)
 *  - deliveredByName (string|null)
 *
 * NOTE:
 * - This function is MANUAL trigger only (admin/manager/checker).
 */

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

/* ======================================================
   STATUS FLOW (AUTHORITATIVE)
====================================================== */
// Keep this consistent with your UI flow.
const STATUS_FLOW = [
  "Created",
  "Loaded",
  "In Transit",
  "Delayed",
  "Out for Delivery",
  "Delivered",
];

const DELAY_REASONS = ["WEATHER", "RORO"];

// Used to keep truck + package aligned.
// (If your truck status names differ, map them in truckStatusToPackageStatusIndex)
const TRUCK_ALLOWED_STATUSES = [
  "Created",
  "Loaded",
  "In Transit",
  "Arrived at Port",
  "Boarded RORO Vessel",
  "Out for Delivery",
  "Delivered",
];

/* ======================================================
   HELPERS
====================================================== */
function idxOfStatus(s) {
  return STATUS_FLOW.indexOf(String(s || "").trim());
}

function normStatus(s) {
  return String(s || "").trim();
}

function upper(s) {
  return String(s || "")
    .trim()
    .toUpperCase();
}

function asPosInt(v, fallback = 0) {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : fallback;
}

function clamp01(x) {
  if (!Number.isFinite(x)) return 0;
  return Math.max(0, Math.min(1, x));
}

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

function optionalString(v) {
  return typeof v === "string" ? v.trim() : "";
}

function structuredError(code, message, data) {
  throw new HttpsError(code, message, data || {});
}

async function loadActiveUser(tx, uid) {
  const userRef = db.collection("users").doc(uid);
  const snap = await tx.get(userRef);
  if (!snap.exists) {
    structuredError("permission-denied", "User record missing", { uid });
  }
  const u = snap.data() || {};
  if (u.active !== true) {
    structuredError("permission-denied", "User inactive", { uid });
  }
  const role = String(u.role || "").toLowerCase();
  const name = String(u.name || u.fullName || u.displayName || "").trim();
  return { role, name };
}

function assertRoleAllowed(role, allowed) {
  if (!allowed.includes(role)) {
    structuredError("permission-denied", "Role not allowed", {
      role,
      allowed,
    });
  }
}

/**
 * Map truck status -> max package statusIndex allowed.
 * This prevents a checker from setting a package to Delivered while truck is still In Transit.
 *
 * Adjust mapping if you change truck statuses.
 */
function truckStatusToPackageMaxIndex(truckStatus) {
  const s = normStatus(truckStatus);

  // Keep these aligned to your operational stages.
  // If truck has finer stages, we compress them into package stages.
  if (s === "Created") return idxOfStatus("Created");
  if (s === "Loaded") return idxOfStatus("Loaded");
  if (s === "In Transit") return idxOfStatus("In Transit");

  // Port stages still considered "In Transit" for packages until "Out for Delivery"
  if (s === "Arrived at Port") return idxOfStatus("In Transit");
  if (s === "Boarded RORO Vessel") return idxOfStatus("In Transit");

  if (s === "Out for Delivery") return idxOfStatus("Out for Delivery");
  if (s === "Delivered") return idxOfStatus("Delivered");

  // Unknown truck status -> be safe: do not allow package to outrun "In Transit"
  return idxOfStatus("In Transit");
}

function isTerminal(status) {
  return normStatus(status) === "Delivered";
}

function isDelayToggle(fromStatus, toStatus) {
  return (
    (normStatus(fromStatus) === "In Transit" &&
      normStatus(toStatus) === "Delayed") ||
    (normStatus(fromStatus) === "Delayed" &&
      normStatus(toStatus) === "In Transit")
  );
}

/* ======================================================
   MAIN
====================================================== */
exports.transitionPackageStatus = onCall(
  { region: "asia-southeast1" },
  async (req) => {
    const uid = requireAuth(req);

    // ---- Inputs
    const tripDocId = requireString(req.data?.tripDocId, "tripDocId");
    const tripPackageId = requireString(
      req.data?.tripPackageId,
      "tripPackageId",
    ); // doc id under trip_packages
    const toStatus = requireString(req.data?.toStatus, "toStatus");
    const remarks = optionalString(req.data?.remarks);
    const delayReason =
      req.data?.delayReason != null ? upper(req.data.delayReason) : null;

    // ---- Refs
    const tripRef = db.collection("truck_trips").doc(tripDocId);
    const pkgRef = tripRef.collection("trip_packages").doc(tripPackageId);

    // Do everything in a txn
    return db.runTransaction(async (tx) => {
      // ---- Load user
      const { role, name } = await loadActiveUser(tx, uid);

      // ---- Load trip + package
      const [tripSnap, pkgSnap] = await Promise.all([
        tx.get(tripRef),
        tx.get(pkgRef),
      ]);

      if (!tripSnap.exists) {
        structuredError("not-found", "Trip not found", { tripDocId });
      }
      if (!pkgSnap.exists) {
        structuredError("not-found", "Trip package not found", {
          tripDocId,
          tripPackageId,
        });
      }

      const trip = tripSnap.data() || {};
      const pkg = pkgSnap.data() || {};

      // ---- Trip must be active
      if (
        trip.active === false ||
        String(trip.status || "").toUpperCase() === "COMPLETED"
      ) {
        structuredError("failed-precondition", "Trip already closed", {
          reason: "TRIP_CLOSED",
          tripDocId,
          tripStatus: trip.status || null,
        });
      }

      // ---- Validate status
      const fromStatus = normStatus(pkg.status || "Created");
      const to = normStatus(toStatus);

      const fromIdx = idxOfStatus(fromStatus);
      const toIdx = idxOfStatus(to);

      if (toIdx === -1) {
        structuredError("invalid-argument", "Invalid toStatus", {
          toStatus: to,
          allowed: STATUS_FLOW,
        });
      }

      if (fromIdx === -1) {
        structuredError(
          "failed-precondition",
          "Package has invalid current status",
          {
            fromStatus,
            allowed: STATUS_FLOW,
          },
        );
      }

      // ---- Terminal lock
      if (isTerminal(fromStatus)) {
        structuredError(
          "failed-precondition",
          "Delivered packages are immutable",
          {
            reason: "TERMINAL_LOCK",
            fromStatus,
            tripDocId,
            tripPackageId,
          },
        );
      }

      // ---- Idempotency (no-op)
      if (fromStatus === to) {
        return {
          ok: true,
          noop: true,
          tripDocId,
          tripPackageId,
          fromStatus,
          toStatus: to,
        };
      }

      // ==================================================
      // ROLE × STATUS RULES (your desired policy)
      // ==================================================
      // Delay set/clear: Admin/Manager only
      if (to === "Delayed") {
        assertRoleAllowed(role, ["admin", "manager"]);
      }
      if (fromStatus === "Delayed" && to === "In Transit") {
        assertRoleAllowed(role, ["admin", "manager"]);
      }

      // Delivered: Checker allowed (and Admin/Manager optionally)
      // If you want ONLY checker, change allowed to ["checker"].
      if (to === "Delivered") {
        assertRoleAllowed(role, ["checker", "admin", "manager"]);
      }

      // Other forward statuses: Admin/Manager
      if (
        ["Created", "Loaded", "In Transit", "Out for Delivery"].includes(to)
      ) {
        // Created is usually system-set; but allow admin/manager to fix.
        assertRoleAllowed(role, ["admin", "manager", "checker"]); // keep tolerant
      }

      // ==================================================
      // DELAY RULES (manual only)
      // ==================================================
      if (to === "Delayed") {
        if (!delayReason || !DELAY_REASONS.includes(delayReason)) {
          structuredError(
            "invalid-argument",
            "delayReason must be WEATHER or RORO",
            {
              delayReason,
              allowed: DELAY_REASONS,
            },
          );
        }
      }

      // Cannot deliver while delayed
      if (to === "Delivered" && fromStatus === "Delayed") {
        structuredError("failed-precondition", "Cannot deliver while delayed", {
          reason: "DELAY_BLOCK",
          tripDocId,
          tripPackageId,
          fromStatus,
        });
      }

      // ==================================================
      // STATUS ORDER VALIDATION
      // ==================================================
      // Allowed:
      // - strict forward progression by +1
      // - Delay toggle: In Transit <-> Delayed
      const delayToggle = isDelayToggle(fromStatus, to);

      if (!delayToggle) {
        if (toIdx !== fromIdx + 1) {
          structuredError(
            "failed-precondition",
            `Illegal transition ${fromStatus} → ${to}`,
            {
              reason: "ILLEGAL_TRANSITION",
              fromStatus,
              toStatus: to,
              tripDocId,
              tripPackageId,
            },
          );
        }
      }

      // ==================================================
      // TRIP-AWARE GUARD: package cannot outrun trip
      // ==================================================
      const tripStatus = normStatus(trip.status || "Created");
      if (!TRUCK_ALLOWED_STATUSES.includes(tripStatus)) {
        // We don't hard-fail; we safely clamp based on mapping default.
      }
      const maxPkgIdx = truckStatusToPackageMaxIndex(tripStatus);

      // Special-case: delay status is allowed even if truck is "In Transit"
      // BUT not allowed if truck hasn't reached "In Transit" yet.
      if (to === "Delayed" && maxPkgIdx < idxOfStatus("In Transit")) {
        structuredError(
          "failed-precondition",
          "Cannot set delay before trip is In Transit",
          {
            reason: "TRIP_NOT_READY_FOR_DELAY",
            tripStatus,
            tripDocId,
          },
        );
      }

      // For non-delay statuses, enforce max index
      if (to !== "Delayed" && toIdx > maxPkgIdx) {
        structuredError(
          "failed-precondition",
          "Package cannot outrun truck trip status",
          {
            reason: "TRIP_AHEAD_BLOCK",
            tripStatus,
            maxAllowedPackageStatus: STATUS_FLOW[maxPkgIdx] || null,
            attempted: to,
            tripDocId,
            tripPackageId,
          },
        );
      }

      // Also: if truck itself is currently delayed, block moving package forward (unless clearing delay)
      const tripDelayReason = trip.delayReason ? upper(trip.delayReason) : null;
      const tripDelayClearedAt = trip.delayClearedAt || null;
      const tripIsDelayed = !!tripDelayReason && !tripDelayClearedAt;

      if (tripIsDelayed) {
        // Allow only: setting package to Delayed OR no-op
        if (to !== "Delayed") {
          structuredError(
            "failed-precondition",
            "Trip is delayed — package progression blocked",
            {
              reason: "TRIP_DELAY_BLOCK",
              tripStatus,
              tripDelayReason,
              tripDocId,
              tripPackageId,
            },
          );
        }
      }

      // ==================================================
      // COUNTS + PROGRESS (idempotent delivery)
      // ==================================================
      const packageCount = asPosInt(pkg.packageCount, 0); // expected >= 1
      const prevDeliveredCount = Number.isFinite(pkg.deliveredCount)
        ? Number(pkg.deliveredCount)
        : 0;

      // Delivery idempotency lock
      if (to === "Delivered") {
        // If already deliveredAt exists, block (prevents double click)

        // ✅ VERIFIED DELIVERY LOCK (Black Box rule)
        // Delivered is ONLY allowed when all items are accounted for:
        // pendingCount must be 0 (everything loaded must either be delivered or reconciled via partial/unload).
        const pendingCount = Number.isFinite(pkg.pendingCount)
          ? Number(pkg.pendingCount)
          : null;

        if (pendingCount === null) {
          structuredError(
            "failed-precondition",
            "Cannot mark Delivered — pendingCount missing (enable item accounting)",
            {
              reason: "MISSING_PENDINGCOUNT",
              tripDocId,
              tripPackageId,
            },
          );
        }

        if (pendingCount > 0) {
          structuredError(
            "failed-precondition",
            `Cannot mark Delivered — ${pendingCount} item(s) not accounted for`,
            {
              reason: "PENDING_ITEMS_BLOCK",
              tripDocId,
              tripPackageId,
              pendingCount,
            },
          );
        }

        if (pkg.deliveredAt) {
          structuredError("failed-precondition", "Already delivered", {
            reason: "ALREADY_DELIVERED",
            tripDocId,
            tripPackageId,
            deliveredAt: pkg.deliveredAt,
          });
        }

        if (packageCount <= 0) {
          structuredError(
            "failed-precondition",
            "packageCount missing — cannot compute delivery progress",
            {
              reason: "MISSING_PACKAGECOUNT",
              tripDocId,
              tripPackageId,
            },
          );
        }
      }

      // ==================================================
      // APPLY UPDATE
      // ==================================================
      const now = admin.firestore.FieldValue.serverTimestamp();
      const concreteNow = admin.firestore.Timestamp.now(); // for status_events consistent timestamp snapshot

      const update = {
        status: to,
        statusIndex: toIdx,
        lastUpdatedAt: now,
        lastUpdatedBy: uid,
        lastUpdatedRole: role,
      };

      // Delay fields
      if (to === "Delayed") {
        update.delayReason = delayReason;
        update.delayStartedAt = now;
        update.delayClearedAt = null;
      }

      // Delay cleared
      if (fromStatus === "Delayed" && to === "In Transit") {
        update.delayClearedAt = now;
        // keep reason for history (optional). If you want to clear reason too, uncomment:
        // update.delayReason = null;
      }

      // Delivery fields + counts/progress
      let deliveredCountAfter = prevDeliveredCount;
      let deliveryProgressAfter = Number.isFinite(pkg.deliveryProgress)
        ? Number(pkg.deliveryProgress)
        : 0;

      if (to === "Delivered") {
        deliveredCountAfter = Math.min(
          packageCount,
          prevDeliveredCount + packageCount,
        ); // typically package-level = whole package
        // In your screenshots, deliveredCount was 0; packageCount was 8.
        // If your deliveredCount means "items delivered inside this package set", you might want +packageCount:
        deliveredCountAfter = Math.min(
          packageCount,
          prevDeliveredCount + packageCount,
        );

        deliveryProgressAfter = clamp01(deliveredCountAfter / packageCount);

        update.deliveredAt = now;
        update.deliveredBy = uid;
        update.deliveredByName = name || null;

        update.deliveredCount = deliveredCountAfter;
        update.deliveryProgress = deliveryProgressAfter;
      }

      // If you want progress to update on other transitions (optional)
      if (
        to !== "Delivered" &&
        packageCount > 0 &&
        Number.isFinite(prevDeliveredCount)
      ) {
        update.deliveryProgress = clamp01(prevDeliveredCount / packageCount);
      }

      // ==================================================
      // WRITE EVENT + AUDIT
      // ==================================================
      const eventRef = pkgRef.collection("status_events").doc();
      const adminLogRef = db.collection("admin_logs").doc();

      tx.update(pkgRef, update);

      tx.set(eventRef, {
        fromStatus,
        toStatus: to,
        statusIndex: toIdx,

        // actor
        actorUid: uid,
        actorRole: role,
        actorName: name || null,

        // delay
        delayReason:
          to === "Delayed"
            ? delayReason
            : pkg.delayReason
              ? upper(pkg.delayReason)
              : null,

        // remarks
        remarks: remarks || "",

        createdAt: concreteNow,
      });

      tx.set(adminLogRef, {
        action: "TRANSITION_PACKAGE_STATUS",
        tripDocId,
        tripPackageId,
        fromStatus,
        toStatus: to,
        toStatusIndex: toIdx,

        tripStatus: tripStatus || null,
        tripDelayReason: tripDelayReason || null,

        delayReason: to === "Delayed" ? delayReason : null,

        // delivery numbers (if relevant)
        packageCount: packageCount || null,
        deliveredCountBefore: prevDeliveredCount,
        deliveredCountAfter:
          to === "Delivered" ? deliveredCountAfter : prevDeliveredCount,
        deliveryProgressAfter:
          to === "Delivered"
            ? deliveryProgressAfter
            : (update.deliveryProgress ?? null),

        remarks: remarks || null,

        actorId: uid,
        actorRole: role,
        actorName: name || null,

        createdAt: concreteNow,
      });

      return {
        ok: true,
        tripDocId,
        tripPackageId,
        fromStatus,
        toStatus: to,
        statusIndex: toIdx,
        delayReason: to === "Delayed" ? delayReason : null,
        deliveredCount:
          to === "Delivered" ? deliveredCountAfter : prevDeliveredCount,
        deliveryProgress:
          to === "Delivered"
            ? deliveryProgressAfter
            : (update.deliveryProgress ?? pkg.deliveryProgress ?? 0),
      };
    });
  },
);
