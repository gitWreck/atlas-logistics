"use strict";

/**
 * ======================================================
 * generateTripManifest.js (Option B — Manifest Lock)
 * ======================================================
 * ✅ Generates a trip-level manifest when ALL trip_packages are fully loaded
 * ✅ Requires admin/manager
 * ✅ Blocks if any pendingCount > 0
 * ✅ Writes:
 *   - manifests/{manifestId}
 *   - truck_trips/{tripDocId}.manifestLocked = true
 *   - truck_trips/{tripDocId}/manifest_events/{eventId}
 *   - admin_logs
 * ✅ Returns:
 *   { manifestId, tripDocId, generatedAt, generatedBy, pdfUrl, hash }
 */

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const crypto = require("crypto");
const { requireRole } = require("../../_shared");

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

/* ===============================
   Helpers
================================ */

function requireString(v, field) {
  if (typeof v !== "string" || !v.trim()) {
    throw new HttpsError("invalid-argument", `${field} required`);
  }
  return v.trim();
}

/**
 * Stable stringify (sorted keys) to create deterministic hash
 */
function stableStringify(obj) {
  const seen = new WeakSet();
  const sorter = (value) => {
    if (value === null || typeof value !== "object") return value;
    if (seen.has(value)) return "[Circular]";
    seen.add(value);

    if (Array.isArray(value)) return value.map(sorter);

    const keys = Object.keys(value).sort();
    const out = {};
    for (const k of keys) out[k] = sorter(value[k]);
    return out;
  };
  return JSON.stringify(sorter(obj));
}

function sha256Hex(s) {
  return crypto.createHash("sha256").update(s, "utf8").digest("hex");
}

/* ===============================
   Main callable
================================ */

exports.generateTripManifest = onCall(
  { region: "asia-southeast1" },
  async (req) => {
    // 🔐 Role guard
    await requireRole(req, ["admin", "manager"]);

    const tripDocId = requireString(req.data?.tripDocId, "tripDocId");

    const uid = req.auth.uid;

    // pull user name (nice for PDF + logs)
    const userSnap = await db.collection("users").doc(uid).get();
    const user = userSnap.exists ? userSnap.data() : {};
    const generatedByName =
      String(user.name || user.fullName || user.displayName || "").trim() ||
      null;

    const tripRef = db.collection("truck_trips").doc(tripDocId);
    const pkgsRef = tripRef.collection("trip_packages");

    return db.runTransaction(async (tx) => {
      const tripSnap = await tx.get(tripRef);
      if (!tripSnap.exists) throw new HttpsError("not-found", "Trip not found");

      const trip = tripSnap.data() || {};

      // Block if trip closed
      const tripClosed =
        trip.active === false ||
        String(trip.status || "").toUpperCase() === "COMPLETED" ||
        !!trip.completedAt;

      if (tripClosed) {
        throw new HttpsError("failed-precondition", "Trip already closed");
      }

      // Block if already locked
      if (trip.manifestLocked === true && trip.manifestId) {
        return {
          ok: true,
          alreadyLocked: true,
          tripDocId,
          manifestId: trip.manifestId,
        };
      }

      // Read all trip packages
      const pkgsSnap = await tx.get(pkgsRef);
      if (pkgsSnap.empty) {
        throw new HttpsError(
          "failed-precondition",
          "Trip has no packages. Nothing to manifest.",
        );
      }

      // Validate packages: pendingCount MUST exist AND be 0
      const items = [];
      const blockers = [];

      let totalPackages = 0;
      let totalItems = 0;

      pkgsSnap.forEach((doc) => {
        const p = doc.data() || {};
        totalPackages += 1;

        const trackingDocId = doc.id;
        const trackingNumber = p.trackingNumber || null;

        const packageCount = Number(p.packageCount || p.totalItems || 0);
        const loadedCount = Number(p.loadedCount || 0);

        const hasPending = typeof p.pendingCount === "number";
        const pendingCount = hasPending ? Number(p.pendingCount || 0) : null;

        // Black-box requirement: pendingCount must exist
        if (!hasPending) {
          blockers.push({
            trackingDocId,
            trackingNumber,
            reason: "MISSING_PENDINGCOUNT",
          });
          return;
        }

        // Must be fully accounted
        if (pendingCount > 0) {
          blockers.push({
            trackingDocId,
            trackingNumber,
            reason: "PENDING_ITEMS_BLOCK",
            pendingCount,
          });
          return;
        }

        // Optional strictness: if packageCount exists, loadedCount should be >= packageCount
        // (some systems allow loadedCount == packageCount exactly; we tolerate >=)
        if (Number.isFinite(packageCount) && packageCount > 0) {
          if (loadedCount < packageCount) {
            blockers.push({
              trackingDocId,
              trackingNumber,
              reason: "NOT_FULLY_LOADED",
              packageCount,
              loadedCount,
            });
            return;
          }
          totalItems += packageCount;
        } else {
          // If no packageCount, still allow (but totals less meaningful)
          totalItems += Math.max(0, loadedCount);
        }

        items.push({
          trackingDocId,
          trackingNumber,
          route: p.route || null,
          senderName: p.senderName || null,
          receiverName: p.receiverName || null,

          packageCount:
            Number.isFinite(packageCount) && packageCount > 0
              ? packageCount
              : null,
          loadedCount,
          pendingCount,

          // optional metadata if present
          packageType: p.packageType || null,
          weightKg: typeof p.weightKg === "number" ? p.weightKg : null,

          loadedAt: p.lastUpdatedAt || null,
          loadedBy: p.lastUpdatedBy || null,
          loadedRole: p.lastUpdatedRole || null,
        });
      });

      if (blockers.length) {
        throw new HttpsError(
          "failed-precondition",
          "Cannot generate manifest",
          {
            reason: "MANIFEST_BLOCKED",
            tripDocId,
            blockers,
          },
        );
      }

      // Build manifest payload (hashable)
      const nowTs = admin.firestore.Timestamp.now();
      const generatedAtISO = nowTs.toDate().toISOString();

      const manifestId = `MANIFEST-${tripDocId}-${nowTs.seconds}`;

      const payload = {
        manifestId,
        tripDocId,

        trip: {
          tripCode: trip.tripCode || trip.tripId || null,
          truckPlate: trip.truckPlate || trip.plateNumber || null,
          driverName: trip.driverName || null,
          driverUid: trip.driverUid || null,

          origin: trip.origin || trip.originWarehouse || null,
          destination: trip.destination || trip.destinationHub || null,
          route: trip.route || null,
        },

        generatedAt: generatedAtISO,
        generatedBy: uid,
        generatedByName,

        totals: {
          totalPackages,
          totalItems,
        },

        items, // ledger list
      };

      const hash = sha256Hex(stableStringify(payload));

      // Firestore write targets
      const manifestRef = db.collection("manifests").doc(manifestId);
      const manifestEventRef = pkgsRef.parent
        .collection("manifest_events")
        .doc(); // truck_trips/{trip}/manifest_events
      const adminLogRef = db.collection("admin_logs").doc();

      // Write manifest doc
      tx.set(manifestRef, {
        ...payload,
        hash,
        status: "LOCKED",
        pdfUrl: null, // set later if/when you generate a PDF into Storage
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // Lock trip
      tx.update(tripRef, {
        manifestLocked: true,
        manifestId,
        manifestHash: hash,
        manifestGeneratedAt: admin.firestore.FieldValue.serverTimestamp(),
        manifestGeneratedBy: uid,
        lastUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
        lastUpdatedBy: uid,
      });

      // Manifest events (trip-scoped)
      tx.set(manifestEventRef, {
        type: "MANIFEST_LOCKED",
        manifestId,
        hash,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        createdBy: uid,
        createdByName: generatedByName,
      });

      // Audit log (admin_logs)
      tx.set(adminLogRef, {
        action: "GENERATE_TRIP_MANIFEST",
        tripDocId,
        manifestId,
        hash,
        totalPackages,
        totalItems,
        actorId: uid,
        actorName: generatedByName,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      return {
        ok: true,
        tripDocId,
        manifestId,
        generatedAt: generatedAtISO,
        generatedBy: uid,
        pdfUrl: null,
        hash,
      };
    });
  },
);
