/* =========================================================
   Package status migration
   ---------------------------------------------------------
   Normalizes legacy package.status values to location-specific
   codes and backfills shipment.packageBreakdown + derived status.

   Usage (from apps/functions):
     DRY_RUN=1 node scripts/migratePackageStatuses.js
     LIMIT=200 node scripts/migratePackageStatuses.js
     node scripts/migratePackageStatuses.js
========================================================= */

const admin = require("firebase-admin");
const {
  normalizePackageStatusCode,
  resolveOdionganPoolStatus,
  PACKAGE_STATUS,
} = require("../src/packages/packageStatus");
const { buildShipmentSnapshot } = require("../src/packages/tripPackageOperations");

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

const DRY_RUN = process.env.DRY_RUN === "1";
const LIMIT = Number(process.env.LIMIT || 200);
const START_AFTER = process.env.START_AFTER || null;
const BATCH_MAX_OPS = 400;

function migratePackageRow(pkg = {}) {
  const raw = String(pkg.status || "").trim().toUpperCase();
  let next = { ...pkg };

  if (raw === "AVAILABLE_AT_WAREHOUSE") {
    next.status = resolveOdionganPoolStatus(pkg, {
      released: pkg.availableForDelivery === true,
    });
  } else if (raw === "RETURNED_RECEIVED_AT_HUB") {
    next.status = PACKAGE_STATUS.RETURNED_RECEIVED_AT_ODIONGAN;
  } else if (raw === "RECEIVED") {
    next.status = PACKAGE_STATUS.RECEIVED_AT_DIVISORIA;
  } else if (raw === "LOADED") {
    next.status = normalizePackageStatusCode(raw, pkg);
  } else {
    next.status = normalizePackageStatusCode(raw, pkg);
  }

  return next;
}

async function migratePackageStatuses() {
  console.log("Package status migration started");
  console.log("DRY_RUN:", DRY_RUN, "LIMIT:", LIMIT, "START_AFTER:", START_AFTER);

  let examined = 0;
  let updated = 0;
  let skipped = 0;

  let query = db.collection("shipments").orderBy(admin.firestore.FieldPath.documentId());

  if (START_AFTER) {
    query = query.startAfter(START_AFTER);
  }

  const snap = await query.limit(LIMIT).get();
  console.log("Documents fetched:", snap.size);

  let batch = db.batch();
  let ops = 0;

  for (const docSnap of snap.docs) {
    examined += 1;
    const data = docSnap.data() || {};
    const packages = Array.isArray(data.packages) ? data.packages : [];

    if (packages.length === 0) {
      skipped += 1;
      continue;
    }

    const migratedPackages = packages.map(migratePackageRow);
    const changed = migratedPackages.some(
      (pkg, index) => pkg.status !== packages[index]?.status,
    );
    const needsBreakdown = !data.packageBreakdown;

    if (!changed && !needsBreakdown) {
      skipped += 1;
      continue;
    }

    const snapshot = buildShipmentSnapshot(migratedPackages, {
      previousStatus: data.status,
    });

    const updatePayload = {
      packages: snapshot.packages,
      packageBreakdown: snapshot.packageBreakdown,
      status: snapshot.status,
      currentTripIds: snapshot.currentTripIds,
      currentTripId: snapshot.currentTripId,
      "totals.totalItems": snapshot.totals.totalItems,
      "totals.totalContentQty": snapshot.totals.totalContentQty,
      "totals.loaded": snapshot.totals.loaded,
      "totals.pending": snapshot.totals.pending,
      "totals.received": snapshot.totals.received,
      "totals.delivered": snapshot.totals.delivered,
      "totals.missing": snapshot.totals.missing,
      "totals.damaged": snapshot.totals.damaged,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedBy: "migratePackageStatuses",
    };

    updated += 1;
    console.log(
      `[${DRY_RUN ? "DRY" : "WRITE"}] ${docSnap.id} -> ${snapshot.status}`,
    );

    if (!DRY_RUN) {
      batch.update(docSnap.ref, updatePayload);
      ops += 1;

      if (ops >= BATCH_MAX_OPS) {
        await batch.commit();
        batch = db.batch();
        ops = 0;
      }
    }
  }

  if (!DRY_RUN && ops > 0) {
    await batch.commit();
  }

  const lastId = snap.docs.length ? snap.docs[snap.docs.length - 1].id : null;

  console.log("Done.", { examined, updated, skipped, lastId });
  if (lastId && snap.size === LIMIT) {
    console.log(`Next page: START_AFTER=${lastId} node scripts/migratePackageStatuses.js`);
  }
}

migratePackageStatuses().catch((error) => {
  console.error("Migration failed:", error);
  process.exit(1);
});
