"use strict";

/**
 * verifyTripManifest.js
 *
 * Verifies manifest integrity (anti-tamper):
 * - Loads manifests/{manifestId}
 * - Recomputes SHA-256 from snapshot (trip + packages)
 * - Compares to stored manifestHash
 * - Optionally compares snapshot packages vs live trip_packages to detect drift
 */

const { onRequest } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const crypto = require("crypto");

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

function stableStringify(obj) {
  const allKeys = [];
  JSON.stringify(obj, (k, v) => (allKeys.push(k), v));
  allKeys.sort();
  return JSON.stringify(obj, allKeys);
}

function sha256Hex(str) {
  return crypto.createHash("sha256").update(str, "utf8").digest("hex");
}

function safeNum(n) {
  const x = Number(n);
  return Number.isFinite(x) ? x : 0;
}

exports.verifyTripManifest = onRequest(async (req, res) => {
  try {
    const manifestId = String(req.query.manifestId || req.body?.manifestId || "").trim();
    if (!manifestId) {
      res.status(400).json({ ok: false, error: "manifestId is required" });
      return;
    }

    const mref = db.collection("manifests").doc(manifestId);
    const msnap = await mref.get();
    if (!msnap.exists) {
      res.status(404).json({ ok: false, error: "Manifest not found" });
      return;
    }

    const m = msnap.data() || {};
    const snapTrip = m.snapshot?.trip || null;
    const snapPkgs = m.snapshot?.packages || [];

    if (!snapTrip) {
      res.status(500).json({ ok: false, error: "Manifest snapshot missing" });
      return;
    }

    // Recompute hash from snapshot (the ONLY correct way)
    const hashInput = stableStringify({
      trip: snapTrip,
      packages: (snapPkgs || []).slice().sort((a, b) =>
        String(a.trackingNumber || "").localeCompare(String(b.trackingNumber || ""))
      ),
    });

    const recomputedHash = sha256Hex(hashInput);
    const storedHash = String(m.manifestHash || "");
    const hashMatches = recomputedHash === storedHash;

    // Optional: compare snapshot vs live trip_packages to detect drift
    let drift = null;
    try {
      const tripDocId = m.tripDocId || snapTrip.tripDocId;
      if (tripDocId) {
        const liveSnap = await db
          .collection("truck_trips")
          .doc(tripDocId)
          .collection("trip_packages")
          .get();

        const live = liveSnap.docs
          .map((d) => {
            const p = d.data() || {};
            return {
              trackingNumber: p.trackingNumber || "",
              loadedCount: safeNum(p.loadedCount ?? p.itemsLoaded ?? p.loadedItems),
              pendingCount: safeNum(p.pendingCount ?? p.itemsPending ?? p.pendingItems),
              receivedCount: safeNum(p.receivedCount ?? p.itemsReceived ?? p.receivedItems),
              totalCount: safeNum(p.packageCount ?? p.totalCount ?? p.itemsTotal ?? p.totalItems),
              status: p.status || "",
            };
          })
          .sort((a, b) => String(a.trackingNumber).localeCompare(String(b.trackingNumber)));

        const snapshotComparable = (snapPkgs || [])
          .map((p) => ({
            trackingNumber: p.trackingNumber || "",
            loadedCount: safeNum(p.loadedCount),
            pendingCount: safeNum(p.pendingCount),
            receivedCount: safeNum(p.receivedCount),
            totalCount: safeNum(p.totalCount),
            status: p.status || "",
          }))
          .sort((a, b) => String(a.trackingNumber).localeCompare(String(b.trackingNumber)));

        const liveStr = stableStringify(live);
        const snapStr = stableStringify(snapshotComparable);

        drift = {
          liveCount: live.length,
          snapshotCount: snapshotComparable.length,
          matchesSnapshot: liveStr === snapStr,
        };
      }
    } catch (e) {
      drift = { error: String(e?.message || e) };
    }

    res.json({
      ok: true,
      manifestId,
      tripDocId: m.tripDocId || snapTrip.tripDocId || null,
      storedHash,
      recomputedHash,
      hashMatches,
      drift,
      verifiedAt: new Date().toISOString(),
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err?.message || err) });
  }
});
