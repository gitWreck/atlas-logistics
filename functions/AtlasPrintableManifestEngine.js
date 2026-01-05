"use strict";

/**
 * generateTripManifest.js
 *
 * OFFICIAL TRIP SHIPPING MANIFEST (Server-Generated Snapshot + Hash)
 *
 * What it does:
 * 1) Loads trip + trip_packages
 * 2) Requires SUM(pendingCount) === 0 (no pending items) before locking
 * 3) Builds a deterministic snapshot + SHA-256 hash
 * 4) Writes /manifests/{manifestId} with snapshot + hash
 * 5) Writes /manifest_events audit record
 * 6) Locks trip: manifestLocked=true, manifestId, manifestHash, manifestCreatedAt
 * 7) Returns printableHtml grouped by destination + manifest metadata
 *
 * Collections assumed:
 * - truck_trips/{tripDocId}
 * - truck_trips/{tripDocId}/trip_packages/{tripPackageId}
 * - manifests/{manifestId}
 * - manifest_events/{eventId}
 */

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const crypto = require("crypto");

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

/** -----------------------------
 * Helpers
 * ------------------------------*/

// Basic role guard (adjust to your users schema)
async function getUserRole(uid) {
  const uref = db.collection("users").doc(uid);
  const usnap = await uref.get();
  if (!usnap.exists) return null;
  return usnap.data()?.role || null;
}

function assertStaffRole(role) {
  const ok = role === "admin" || role === "manager";
  if (!ok) throw new HttpsError("permission-denied", "Admin/Manager only.");
}

// Deterministic stringify (stable key order)
function stableStringify(obj) {
  const allKeys = [];
  JSON.stringify(obj, (key, value) => (allKeys.push(key), value));
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

/**
 * Derive destination for printing.
 * Priority:
 * 1) explicit fields on trip_package: destination / destinationCode
 * 2) parse route like "DIVI-CAL" -> "CAL"
 * 3) fallback "UNKNOWN"
 */
function getDestinationKey(pkg) {
  const d =
    pkg.destinationCode ||
    pkg.destination ||
    pkg.dest ||
    pkg.to ||
    null;

  if (d) return String(d).trim().toUpperCase();

  const route = pkg.route || pkg.tripRoute || "";
  const m = String(route).toUpperCase().match(/([A-Z]{2,})\s*-\s*([A-Z]{2,})/);
  if (m && m[2]) return m[2];

  // Sometimes route stored like "DIVI-CAL" without spaces
  const m2 = String(route).toUpperCase().match(/^([A-Z]{2,})-([A-Z]{2,})$/);
  if (m2 && m2[2]) return m2[2];

  return "UNKNOWN";
}

/**
 * Build printable HTML grouped by destination.
 * NOTE: uses simple CSS designed for A4 print.
 */
function buildPrintableHtml({ trip, grouped, manifest }) {
  const now = new Date().toISOString();

  const groupsHtml = Object.keys(grouped)
    .sort()
    .map((dest) => {
      const rows = grouped[dest]
        .map((p, idx) => {
          const tn = p.trackingNumber || "";
          const customer = p.customerName || "";
          const route = p.route || "";
          const received = safeNum(p.receivedCount ?? p.itemsReceived ?? p.receivedItems);
          const loaded = safeNum(p.loadedCount ?? p.itemsLoaded ?? p.loadedItems);
          const pending = safeNum(p.pendingCount ?? p.itemsPending ?? p.pendingItems);
          const total = safeNum(p.totalCount ?? p.itemsTotal ?? p.totalItems ?? p.packageCount);

          return `
            <tr>
              <td class="mono">${idx + 1}</td>
              <td class="mono">${tn}</td>
              <td>${customer}</td>
              <td class="mono">${route}</td>
              <td class="num">${total}</td>
              <td class="num">${received}</td>
              <td class="num">${loaded}</td>
              <td class="num">${pending}</td>
            </tr>
          `;
        })
        .join("");

      return `
        <section class="section">
          <div class="sectionHead">
            <div class="sectionTitle">DESTINATION: <span class="mono">${dest}</span></div>
            <div class="sectionMeta">Items: ${grouped[dest].length}</div>
          </div>

          <table class="tbl">
            <thead>
              <tr>
                <th>#</th>
                <th>Tracking #</th>
                <th>Customer</th>
                <th>Route</th>
                <th>Total</th>
                <th>Received</th>
                <th>Loaded</th>
                <th>Pending</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </section>
      `;
    })
    .join("");

  // Optional verification URL (you can host verify.html in public/)
  const verifyUrl = `https://atlas-tracking.web.app/verify.html?manifestId=${encodeURIComponent(
    manifest.manifestId
  )}`;

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>ATLAS Official Trip Shipping Manifest</title>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <style>
    @page { size: A4; margin: 14mm; }
    body { font-family: Arial, Helvetica, sans-serif; color: #0b1020; }
    .wrap { max-width: 900px; margin: 0 auto; }
    .topbar { display:flex; justify-content:space-between; align-items:flex-start; gap:12px; }
    .brand { display:flex; gap:10px; align-items:center; }
    .logoBox{
      width:56px;height:56px;border:2px solid #0b1020;border-radius:12px;
      display:flex;align-items:center;justify-content:center;font-weight:800;
    }
    h1 { margin: 0; font-size: 18px; letter-spacing: .3px; }
    .sub { margin-top:4px; font-size:12px; opacity:.85; }
    .metaGrid { margin-top:10px; display:grid; grid-template-columns: 1fr 1fr; gap:8px; }
    .card { border:1px solid #cfd6e4; border-radius:12px; padding:10px; }
    .kv { display:flex; justify-content:space-between; gap:10px; font-size:12px; }
    .kv b { font-weight:700; }
    .mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace; }
    .hash { word-break: break-all; font-size:11px; }
    .notice { margin-top:10px; padding:10px; border-left:4px solid #2563eb; background:#eef4ff; border-radius:10px; font-size:12px; }
    .section { margin-top:14px; page-break-inside: avoid; }
    .sectionHead { display:flex; justify-content:space-between; align-items:center; margin-bottom:6px; }
    .sectionTitle { font-weight:800; font-size:13px; }
    .sectionMeta { font-size:12px; opacity:.8; }
    table { width:100%; border-collapse: collapse; }
    th, td { border:1px solid #d9e2f2; padding:6px 8px; font-size:11px; }
    thead th { background:#f4f7ff; text-align:left; }
    td.num { text-align:right; }
    .footer { margin-top:14px; display:flex; justify-content:space-between; gap:12px; align-items:flex-end; }
    .sign { width: 48%; border-top:1px solid #333; padding-top:6px; font-size:12px; }
    .qrBox { text-align:right; }
    .qrHint { font-size:11px; opacity:.75; margin-top:6px; }
    @media print {
      .noPrint { display:none; }
    }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="topbar">
      <div class="brand">
        <div class="logoBox">ATLAS</div>
        <div>
          <h1>OFFICIAL TRIP SHIPPING MANIFEST</h1>
          <div class="sub">Generated: <span class="mono">${now}</span></div>
        </div>
      </div>

      <div class="card qrBox">
        <div class="kv"><span><b>Manifest ID</b></span><span class="mono">${manifest.manifestId}</span></div>
        <div class="kv"><span><b>Verify URL</b></span><span class="mono" style="font-size:11px">${verifyUrl}</span></div>
        <div class="qrHint">Use the verification page to validate hash integrity.</div>
      </div>
    </div>

    <div class="metaGrid">
      <div class="card">
        <div class="kv"><span><b>Trip ID</b></span><span class="mono">${trip.tripDocId || ""}</span></div>
        <div class="kv"><span><b>Trip #</b></span><span class="mono">${trip.tripNumber || trip.tripNumberDisplay || ""}</span></div>
        <div class="kv"><span><b>Driver</b></span><span>${trip.driverName || ""}</span></div>
        <div class="kv"><span><b>Origin</b></span><span>${trip.origin || ""}</span></div>
        <div class="kv"><span><b>Destination</b></span><span>${trip.destination || ""}</span></div>
      </div>

      <div class="card">
        <div class="kv"><span><b>Total Packages</b></span><span class="mono">${manifest.totalPackages}</span></div>
        <div class="kv"><span><b>Total Loaded</b></span><span class="mono">${manifest.totalLoaded}</span></div>
        <div class="kv"><span><b>Total Pending</b></span><span class="mono">${manifest.totalPending}</span></div>
        <div style="margin-top:8px;">
          <div style="font-size:12px; font-weight:800;">Integrity Hash (SHA-256)</div>
          <div class="hash mono">${manifest.manifestHash}</div>
        </div>
      </div>
    </div>

    <div class="notice">
      This manifest is a locked snapshot of the trip’s cargo ledger. Any later edits to trip items should result in a <b>hash mismatch</b>.
      Verification must be performed using the stored manifest snapshot and hash.
    </div>

    ${groupsHtml}

    <div class="footer">
      <div class="sign">Driver Signature / Date</div>
      <div class="sign">Port / Checkpoint Verification</div>
    </div>

    <div class="noPrint" style="margin-top:16px;">
      <button onclick="window.print()">Print</button>
    </div>
  </div>
</body>
</html>`;
}

/** -----------------------------
 * MAIN FUNCTION
 * ------------------------------*/

exports.generateTripManifest = onCall(async (req) => {
  const uid = req.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Login required.");

  const role = await getUserRole(uid);
  assertStaffRole(role);

  const tripDocId = String(req.data?.tripDocId || "").trim();
  if (!tripDocId) throw new HttpsError("invalid-argument", "tripDocId is required.");

  const tripRef = db.collection("truck_trips").doc(tripDocId);
  const pkgsRef = tripRef.collection("trip_packages");

  // Transaction ensures we lock consistently with the snapshot we hash
  return await db.runTransaction(async (tx) => {
    const tripSnap = await tx.get(tripRef);
    if (!tripSnap.exists) throw new HttpsError("not-found", "Trip not found.");

    const trip = tripSnap.data() || {};
    const alreadyLocked = !!trip.manifestLocked;
    if (alreadyLocked) {
      throw new HttpsError("failed-precondition", "Trip already locked / has a manifest.");
    }

    const pkgsSnap = await tx.get(pkgsRef);
    const pkgs = pkgsSnap.docs.map((d) => ({
      tripPackageId: d.id,
      ...d.data(),
    }));

    // Compute totals
    const totalPending = pkgs.reduce((a, p) => a + safeNum(p.pendingCount), 0);
    const totalLoaded = pkgs.reduce((a, p) => a + safeNum(p.loadedCount ?? p.itemsLoaded ?? p.loadedItems), 0);

    // Hard rule: must be fully loaded
    if (totalPending !== 0) {
      throw new HttpsError(
        "failed-precondition",
        `Cannot lock manifest. pendingCount must be 0. Current totalPending=${totalPending}`
      );
    }

    // Group by destination for printing
    const grouped = {};
    for (const p of pkgs) {
      const destKey = getDestinationKey(p);
      if (!grouped[destKey]) grouped[destKey] = [];
      grouped[destKey].push(p);
    }

    // Canonical snapshot for hashing (sort to ensure deterministic)
    const canonicalPackages = pkgs
      .map((p) => ({
        trackingNumber: p.trackingNumber || "",
        customerName: p.customerName || "",
        route: p.route || "",
        destinationKey: getDestinationKey(p),
        totalCount: safeNum(p.packageCount ?? p.totalCount ?? p.itemsTotal ?? p.totalItems),
        receivedCount: safeNum(p.receivedCount ?? p.itemsReceived ?? p.receivedItems),
        loadedCount: safeNum(p.loadedCount ?? p.itemsLoaded ?? p.loadedItems),
        pendingCount: safeNum(p.pendingCount ?? p.itemsPending ?? p.pendingItems),
        status: p.status || "",
      }))
      .sort((a, b) => String(a.trackingNumber).localeCompare(String(b.trackingNumber)));

    const canonicalTrip = {
      tripDocId,
      tripNumber: trip.tripNumber || trip.tripNo || trip.trip || "",
      driverId: trip.driverId || "",
      driverName: trip.driverName || "",
      origin: trip.origin || "",
      destination: trip.destination || "",
      route: trip.route || "",
      startedAt: trip.startedAt || null,
    };

    const snapshot = {
      trip: canonicalTrip,
      packages: canonicalPackages,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    const hashInput = stableStringify({
      trip: canonicalTrip,
      packages: canonicalPackages,
    });

    const manifestHash = sha256Hex(hashInput);

    const manifestId = `M-${tripDocId}-${Date.now()}`;
    const manifestRef = db.collection("manifests").doc(manifestId);

    const manifestData = {
      manifestId,
      tripDocId,
      tripNumber: canonicalTrip.tripNumber,
      driverName: canonicalTrip.driverName,
      origin: canonicalTrip.origin,
      destination: canonicalTrip.destination,
      route: canonicalTrip.route,
      totalPackages: canonicalPackages.length,
      totalLoaded,
      totalPending,
      manifestHash,
      hashAlgo: "SHA-256",
      lockedByUid: uid,
      lockedByRole: role,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      snapshot: {
        // Store the snapshot values directly (timestamps excluded in hash)
        trip: canonicalTrip,
        packages: canonicalPackages,
      },
      // optional fields your UI may already expect
      pdfUrl: null,
      printable: true,
    };

    // Audit event
    const evtRef = db.collection("manifest_events").doc();
    const evtData = {
      type: "MANIFEST_LOCKED",
      tripDocId,
      manifestId,
      byUid: uid,
      byRole: role,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      meta: {
        totalPackages: canonicalPackages.length,
        totalLoaded,
        totalPending,
      },
    };

    // Lock trip
    tx.set(manifestRef, manifestData);
    tx.set(evtRef, evtData);
    tx.update(tripRef, {
      manifestLocked: true,
      manifestId,
      manifestHash,
      manifestCreatedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Build printable HTML
    const printableHtml = buildPrintableHtml({
      trip: canonicalTrip,
      grouped,
      manifest: {
        manifestId,
        manifestHash,
        totalPackages: canonicalPackages.length,
        totalLoaded,
        totalPending,
      },
    });

    return {
      ok: true,
      manifestId,
      manifestHash,
      totalPackages: canonicalPackages.length,
      totalLoaded,
      totalPending,
      printableHtml, // UI can open in new tab and print
      verifyUrl: `https://atlas-tracking.web.app/verify.html?manifestId=${encodeURIComponent(manifestId)}`,
    };
  });
});
