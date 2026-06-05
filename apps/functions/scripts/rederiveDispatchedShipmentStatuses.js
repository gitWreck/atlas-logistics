"use strict";

/**
 * One-time repair: re-derive shipment + piece statuses for dispatched hub trips.
 *
 * Fixes rows where the trip is IN_TRANSIT but pieces still show LOADED_TO_TRIP
 * and/or the shipment master status is IN_TRANSIT when it should be PARTIALLY_IN_TRANSIT.
 *
 * Usage:
 *   DRY_RUN=1 node scripts/rederiveDispatchedShipmentStatuses.js
 *   TRIP_ID=TRIP-HUB-20260604-0014 node scripts/rederiveDispatchedShipmentStatuses.js
 */

const admin = require("firebase-admin");
const {
  packageOnTrip,
  applyLinehaulInTransit,
  buildShipmentSnapshot,
  normalizePackageRow,
} = require("../src/packages/tripPackageOperations");
const { isHubTransferTrip } = require("../src/trips/manifestStatus");

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();
const DRY_RUN = process.env.DRY_RUN === "1";
const TRIP_ID = String(process.env.TRIP_ID || "").trim();

async function repairTrip(tripDoc) {
  const tripId = tripDoc.id;
  const trip = tripDoc.data() || {};

  if (!isHubTransferTrip(trip)) return { skipped: true, reason: "not hub trip" };
  if (String(trip.status || "").toUpperCase() !== "IN_TRANSIT") {
    return { skipped: true, reason: "trip not IN_TRANSIT" };
  }
  if (!trip.dispatchedAt && !trip.startedAt) {
    return { skipped: true, reason: "trip not dispatched" };
  }

  const tripShipSnap = await tripDoc.ref.collection("trip_shipments").get();
  let updated = 0;

  for (const tripShipDoc of tripShipSnap.docs) {
    const shipmentId = tripShipDoc.id;
    const shipmentRef = db.collection("shipments").doc(shipmentId);
    const shipmentSnap = await shipmentRef.get();
    if (!shipmentSnap.exists) continue;

    const shipmentData = shipmentSnap.data() || {};
    const oldPackages = Array.isArray(shipmentData.packages)
      ? shipmentData.packages.map(normalizePackageRow)
      : [];

    const hasTripPackages = oldPackages.some((pkg) => packageOnTrip(pkg, tripId));
    if (!hasTripPackages) continue;

    const nowIso = new Date().toISOString();
    const updatedPackages = oldPackages.map((pkg) =>
      applyLinehaulInTransit(pkg, { tripId, nowIso }),
    );
    const snapshot = buildShipmentSnapshot(updatedPackages, {
      previousStatus: shipmentData.status,
    });

    const oldStatus = String(shipmentData.status || "").toUpperCase();
    const changed =
      oldStatus !== snapshot.status ||
      JSON.stringify(oldPackages.map((p) => p.status)) !==
        JSON.stringify(snapshot.packages.map((p) => p.status));

    console.log(
      `${DRY_RUN ? "[DRY_RUN] " : ""}${shipmentId}: ${oldStatus} -> ${snapshot.status}`,
    );

    if (!changed) continue;

    if (!DRY_RUN) {
      const batch = db.batch();
      batch.update(shipmentRef, {
        status: snapshot.status,
        packages: snapshot.packages,
        packageBreakdown: snapshot.packageBreakdown,
        currentTripIds: snapshot.currentTripIds,
        currentTripId: snapshot.currentTripId,
        "totals.loaded": snapshot.totals.loaded,
        "totals.received": snapshot.totals.received,
        "totals.delivered": snapshot.totals.delivered,
        "totals.pending": snapshot.totals.pending,
        "totals.totalContentQty": snapshot.totals.totalContentQty,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      batch.update(tripShipDoc.ref, {
        status: snapshot.status,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      await batch.commit();
    }

    updated += 1;
  }

  return { updated };
}

async function main() {
  let tripDocs = [];

  if (TRIP_ID) {
    const snap = await db.collection("truck_trips").doc(TRIP_ID).get();
    if (!snap.exists) {
      throw new Error(`Trip not found: ${TRIP_ID}`);
    }
    tripDocs = [snap];
  } else {
    const snap = await db
      .collection("truck_trips")
      .where("status", "==", "IN_TRANSIT")
      .get();
    tripDocs = snap.docs;
  }

  let totalUpdated = 0;
  for (const tripDoc of tripDocs) {
    const result = await repairTrip(tripDoc);
    if (result.updated) totalUpdated += result.updated;
  }

  console.log(
    `${DRY_RUN ? "Dry run complete" : "Repair complete"}: ${totalUpdated} shipment(s) updated.`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
