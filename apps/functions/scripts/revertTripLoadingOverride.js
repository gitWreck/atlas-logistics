"use strict";

/**
 * Repair accidental updateTripStatus → LOADING on a reconciled / in-progress hub trip.
 *
 * The force-update only stamps shipment master status to LOADING; package rows
 * (DELIVERED, OUT_FOR_DELIVERY, etc.) are usually still correct. This script:
 *   1. Re-derives each shipment status from its packages[]
 *   2. Syncs trip_shipments summary rows
 *   3. Restores truck_trips.status from the last MANUAL_OVERRIDE → LOADING event
 *
 * Usage (from apps/functions):
 *   DRY_RUN=1 TRIP_ID=TRIP-HUB-20260618-0001 node scripts/revertTripLoadingOverride.js
 *   TRIP_ID=TRIP-HUB-20260618-0001 node scripts/revertTripLoadingOverride.js
 *
 * Optional:
 *   RESTORE_TRIP_STATUS=ARRIVED   — force trip status instead of reading trip_events
 *   SKIP_TRIP_RESTORE=1           — only fix shipments, not the trip doc
 *
 * Auth: FIREBASE_SERVICE_ACCOUNT_KEY (web .env.local) or GOOGLE_APPLICATION_CREDENTIALS
 */

const admin = require("firebase-admin");
const { FieldValue } = require("firebase-admin/firestore");
const { collectActiveTripIds } = require("../src/packages/tripPackageOperations");
const { buildDerivedShipmentSnapshot } = require("../src/packages/shipmentStatus");
const { initAdminApp, resolveTripDocRef } = require("./initAdmin");

initAdminApp();
const db = admin.firestore();

const DRY_RUN = process.env.DRY_RUN === "1";
const TRIP_ID = String(process.env.TRIP_ID || "").trim();
const FORCE_TRIP_STATUS = String(process.env.RESTORE_TRIP_STATUS || "")
  .trim()
  .toUpperCase();
const SKIP_TRIP_RESTORE = process.env.SKIP_TRIP_RESTORE === "1";

function eventTimestampMs(value) {
  if (!value) return 0;
  if (typeof value.toMillis === "function") return value.toMillis();
  if (value._seconds) return value._seconds * 1000;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

async function resolveRestoreTripStatus(tripRef, tripData = {}) {
  if (FORCE_TRIP_STATUS) return FORCE_TRIP_STATUS;

  const eventsSnap = await tripRef.collection("trip_events").get();
  const candidates = eventsSnap.docs
    .map((doc) => doc.data() || {})
    .filter(
      (event) =>
        String(event.type || "") === "STATUS_CHANGE" &&
        String(event.newStatus || "").toUpperCase() === "LOADING" &&
        String(event.method || "").toUpperCase() === "MANUAL_OVERRIDE" &&
        event.oldStatus,
    )
    .sort((a, b) => eventTimestampMs(b.at) - eventTimestampMs(a.at));

  if (candidates.length > 0) {
    return String(candidates[0].oldStatus || "").toUpperCase();
  }

  if (tripData.reconciledAt) return "ARRIVED";
  if (tripData.dispatchedAt && !tripData.arrivedAt) return "IN_TRANSIT";
  if (tripData.arrivedAt) return "ARRIVED";
  if (tripData.manifestLocked) return "LOADED";

  return null;
}

async function repairShipmentOnTrip(tripRef, shipmentDoc) {
  const data = shipmentDoc.data() || {};
  const packages = Array.isArray(data.packages) ? data.packages : [];

  if (!packages.length) {
    return { skipped: true, reason: "no packages" };
  }

  const snapshot = buildDerivedShipmentSnapshot(packages, {
    previousStatus: data.status,
  });
  const activeTripIds = collectActiveTripIds(snapshot.packages);
  const oldStatus = String(data.status || "").toUpperCase();
  const newStatus = String(snapshot.status || "").toUpperCase();

  const packagesChanged =
    JSON.stringify(packages) !== JSON.stringify(snapshot.packages);

  if (oldStatus === newStatus && !packagesChanged) {
    console.log(`  ${shipmentDoc.id}: unchanged (${oldStatus})`);
    return { updated: false, newStatus };
  }

  console.log(
    `  ${DRY_RUN ? "[DRY_RUN] " : ""}${shipmentDoc.id}: ${oldStatus} -> ${newStatus}`,
  );

  if (!DRY_RUN) {
    const updates = {
      status: snapshot.status,
      packages: snapshot.packages,
      packageBreakdown: snapshot.packageBreakdown,
      currentTripIds: activeTripIds,
      currentTripId: activeTripIds.length === 1 ? activeTripIds[0] : null,
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: "revertTripLoadingOverride",
    };
    if (snapshot.availableForDelivery !== undefined) {
      updates.availableForDelivery = snapshot.availableForDelivery;
    }

    await shipmentDoc.ref.update(updates);

    const tripShipRef = tripRef.collection("trip_shipments").doc(shipmentDoc.id);
    const tripShipSnap = await tripShipRef.get();
    if (tripShipSnap.exists) {
      await tripShipRef.update({
        status: snapshot.status,
        updatedAt: FieldValue.serverTimestamp(),
      });
    }
  }

  return { updated: true, newStatus };
}

async function main() {
  if (!TRIP_ID) {
    throw new Error("Set TRIP_ID (trip doc id or tripId code).");
  }

  const tripRef = await resolveTripDocRef(db, TRIP_ID);
  if (!tripRef) {
    throw new Error(`Trip not found: ${TRIP_ID}`);
  }

  const tripSnap = await tripRef.get();
  const trip = tripSnap.data() || {};
  const tripCode = trip.tripId || tripSnap.id;

  console.log("Revert trip LOADING override");
  console.log(`  trip: ${tripCode}`);
  console.log(`  current trip status: ${trip.status || "unknown"}`);
  console.log(`  dry run: ${DRY_RUN ? "yes" : "no"}`);

  const tripShipSnap = await tripRef.collection("trip_shipments").get();
  const shipmentSnaps = await Promise.all(
    tripShipSnap.docs.map((doc) =>
      db.collection("shipments").doc(doc.id).get(),
    ),
  );

  let updatedShipments = 0;
  for (const shipmentSnap of shipmentSnaps) {
    if (!shipmentSnap.exists) {
      console.log(`  skip missing shipment ${shipmentSnap.id}`);
      continue;
    }
    const result = await repairShipmentOnTrip(tripRef, shipmentSnap);
    if (result.updated) updatedShipments += 1;
  }

  let restoredTripStatus = null;
  if (!SKIP_TRIP_RESTORE) {
    restoredTripStatus = await resolveRestoreTripStatus(tripRef, trip);
    if (!restoredTripStatus) {
      console.log(
        "  Could not infer prior trip status — set RESTORE_TRIP_STATUS=ARRIVED (or COMPLETED) manually.",
      );
    } else if (
      String(trip.status || "").toUpperCase() !== restoredTripStatus
    ) {
      console.log(
        `${DRY_RUN ? "[DRY_RUN] " : ""}trip status: ${trip.status || "?"} -> ${restoredTripStatus}`,
      );
      if (!DRY_RUN) {
        await tripRef.update({
          status: restoredTripStatus,
          updatedAt: FieldValue.serverTimestamp(),
          updatedBy: "revertTripLoadingOverride",
        });
      }
    } else {
      console.log(`  trip status already ${restoredTripStatus}`);
    }
  }

  console.log("");
  console.log(`Shipments updated: ${updatedShipments}`);
  console.log(
    restoredTripStatus
      ? `Trip status target: ${restoredTripStatus}`
      : "Trip status: not changed",
  );
  console.log(DRY_RUN ? "Dry run complete." : "Done.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
