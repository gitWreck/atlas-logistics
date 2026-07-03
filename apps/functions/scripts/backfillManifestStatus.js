/* =========================================================
   Backfill manifestStatus on truck_trips (and linked manifests)
   ---------------------------------------------------------
   Derives manifestStatus from legacy fields for in-flight trips.

   Usage (from apps/functions):
     DRY_RUN=1 node scripts/backfillManifestStatus.js
     TRIP_ID=TRIP-HUB-20260604-0014 node scripts/backfillManifestStatus.js
     node scripts/backfillManifestStatus.js
========================================================= */

const admin = require("firebase-admin");
const {
  MANIFEST_STATUS,
  resolveManifestStatus,
} = require("../src/trips/manifestStatus");
const { initAdminApp, resolveTripDocRef } = require("./initAdmin");

initAdminApp();
const db = admin.firestore();

const DRY_RUN = process.env.DRY_RUN === "1";
const TRIP_ID = process.env.TRIP_ID || null;
const LIMIT = Number(process.env.LIMIT || 200);

function deriveManifestStatus(trip = {}) {
  if (trip.manifestStatus && trip.manifestStatus !== "OPEN_FOR_EDIT") {
    return resolveManifestStatus(trip);
  }

  if (trip.reconciledAt) return MANIFEST_STATUS.RECONCILED;
  if (trip.receivingStartedAt) return MANIFEST_STATUS.RECEIVING_IN_PROGRESS;
  if (trip.manifestLocked === true) return MANIFEST_STATUS.LOCKED;
  return MANIFEST_STATUS.OPEN;
}

async function main() {
  let docs = [];

  if (TRIP_ID) {
    const tripRef = await resolveTripDocRef(db, TRIP_ID);
    if (!tripRef) {
      console.error(`Trip not found: ${TRIP_ID}`);
      process.exit(1);
    }
    const snap = await tripRef.get();
    docs = [snap];
  } else {
    const snap = await db.collection("truck_trips").limit(LIMIT).get();
    docs = snap.docs;
  }

  console.log(
    `${DRY_RUN ? "[DRY RUN] " : ""}Processing ${docs.length} trip(s)...`,
  );

  let updated = 0;
  let skipped = 0;

  for (const doc of docs) {
    const trip = doc.data() || {};
    const nextStatus = deriveManifestStatus(trip);
    const currentStatus = resolveManifestStatus(trip);
    const manifestLocked = [
      MANIFEST_STATUS.LOCKED,
      MANIFEST_STATUS.RECEIVING_IN_PROGRESS,
      MANIFEST_STATUS.RECONCILED,
    ].includes(nextStatus);

    if (currentStatus === nextStatus && trip.manifestLocked === manifestLocked) {
      skipped += 1;
      continue;
    }

    console.log(
      `${doc.id}: ${currentStatus} -> ${nextStatus} (manifestLocked=${manifestLocked})`,
    );

    if (!DRY_RUN) {
      const batch = db.batch();
      batch.update(doc.ref, {
        manifestStatus: nextStatus,
        manifestLocked,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      if (trip.manifestId) {
        const manifestRef = db.collection("manifests").doc(trip.manifestId);
        batch.update(manifestRef, {
          status: nextStatus,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }

      await batch.commit();
    }

    updated += 1;
  }

  console.log(`Done. updated=${updated} skipped=${skipped}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
