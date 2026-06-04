/* =========================================================
   Backfill trip auto-completion
   ---------------------------------------------------------
   Closes hub/delivery trips stuck at ARRIVED/UNLOADING when all
   manifest shipments are already processed.

   Usage (from apps/functions):
     DRY_RUN=1 node scripts/backfillAutoCompleteTrips.js
     TRIP_ID=TRIP-HUB-20260604-0003 node scripts/backfillAutoCompleteTrips.js
     node scripts/backfillAutoCompleteTrips.js
========================================================= */

const admin = require("firebase-admin");
const { tryAutoCompleteTrip } = require("../src/trips/autoCompleteTrip");

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

const DRY_RUN = process.env.DRY_RUN === "1";
const TRIP_ID = process.env.TRIP_ID || null;
const LIMIT = Number(process.env.LIMIT || 100);

const CANDIDATE_STATUSES = new Set([
  "ARRIVED",
  "UNLOADING",
  "IN_TRANSIT",
  "OUT_FOR_DELIVERY",
]);

async function main() {
  let docs = [];

  if (TRIP_ID) {
    const snap = await db.collection("truck_trips").doc(TRIP_ID).get();
    if (!snap.exists) {
      console.error(`Trip not found: ${TRIP_ID}`);
      process.exit(1);
    }
    docs = [snap];
  } else {
    const snap = await db
      .collection("truck_trips")
      .limit(LIMIT * 3)
      .get();
    docs = snap.docs
      .filter((doc) =>
        CANDIDATE_STATUSES.has(String(doc.data()?.status || "").toUpperCase()),
      )
      .slice(0, LIMIT);
  }

  console.log(
    `${DRY_RUN ? "[DRY RUN] " : ""}Evaluating ${docs.length} trip(s)...`,
  );

  let completed = 0;
  let skipped = 0;

  for (const doc of docs) {
    const trip = doc.data() || {};
    const tripId = doc.id;

    if (DRY_RUN) {
      const rowsSnap = await doc.ref.collection("trip_shipments").get();
      const rows = rowsSnap.docs.map((row) => ({
        id: row.id,
        ...row.data(),
      }));
      const {
        shouldPromoteTripToCompleted,
      } = require("../src/trips/tripLifecycle");
      const decision = shouldPromoteTripToCompleted(trip, rows);
      console.log(
        `${tripId} status=${trip.status} promote=${decision.promote} reason=${decision.reason}`,
      );
      if (decision.promote) completed += 1;
      else skipped += 1;
      continue;
    }

    const result = await tryAutoCompleteTrip(tripId, {
      actorId: "backfillAutoCompleteTrips",
      actorName: "Backfill Script",
      source: "BACKFILL_AUTO_COMPLETE",
    });

    if (result.completed) {
      completed += 1;
      console.log(`COMPLETED ${tripId} (${result.reason})`);
    } else {
      skipped += 1;
      console.log(`SKIPPED ${tripId} (${result.reason})`);
    }
  }

  console.log(`Done. completed=${completed} skipped=${skipped}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
