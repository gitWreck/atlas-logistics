"use strict";

/**
 * Re-derive shipment master status + breakdown from package rows.
 * Also repairs common stale rows (e.g. ARRIVED_AT_ODIONGAN but still on trip).
 *
 * Usage:
 *   DRY_RUN=1 SHIPMENT_ID=AT-20260615-SHP-768856 node scripts/rederiveShipmentStatusesFromPackages.js
 *   SHIPMENT_ID=AT-20260615-SHP-078442,AT-20260615-SHP-768856 node scripts/rederiveShipmentStatusesFromPackages.js
 *   DRY_RUN=1 TRIP_ID=TRIP-HUB-20260616-0006 node scripts/rederiveShipmentStatusesFromPackages.js
 */

const admin = require("firebase-admin");
const { FieldValue } = require("firebase-admin/firestore");
const {
  PACKAGE_STATUS,
  normalizePackageStatus,
  ODIONGAN_WAREHOUSE,
} = require("../src/packages/packageStatus");
const {
  buildShipmentSnapshot,
  normalizePackageRow,
  packageOnTrip,
  sumLoadedQty,
  sumReceivedQty,
  sumMissingQty,
  sumDamagedQty,
  sumTotalQty,
} = require("../src/packages/tripPackageOperations");
const { buildDerivedShipmentSnapshot } = require("../src/packages/shipmentStatus");
const { initAdminApp, resolveTripDocRef } = require("./initAdmin");

initAdminApp();

const db = admin.firestore();
const DRY_RUN = process.env.DRY_RUN === "1";
const SHIPMENT_IDS = String(process.env.SHIPMENT_ID || "")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);
const TRIP_ID = String(process.env.TRIP_ID || "").trim();

function getPackageIdentity(pkg = {}) {
  return String(pkg.packageId || pkg.trackingNumber || "").trim();
}

function repairStaleOdionganPackageRow(pkg = {}) {
  const normalized = normalizePackageRow(pkg);
  const status = normalizePackageStatus(normalized);
  if (status !== PACKAGE_STATUS.ARRIVED_AT_ODIONGAN) {
    return normalized;
  }

  const stillOnTrip = Boolean(
    String(normalized.currentTripId || normalized.loadedOnTrip || "").trim(),
  );
  const needsReceivedQty =
    normalizePackageRow(normalized).receivedQty < normalized.quantity;
  const needsLoadedClear = normalized.loadedQty > 0;

  if (!stillOnTrip && !needsReceivedQty && !needsLoadedClear) {
    return normalized;
  }

  return {
    ...normalized,
    loadedQty: 0,
    receivedQty: normalized.quantity,
    currentTripId: null,
    loadedOnTrip: null,
    custodyOwnerType: normalized.custodyOwnerType || "WAREHOUSE",
    custodyOwnerId: normalized.custodyOwnerId || ODIONGAN_WAREHOUSE,
    hubReceivedAt: normalized.hubReceivedAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function collectTripIds(data = {}, packages = []) {
  const tripIds = new Set();
  const currentTripId = String(data.currentTripId || "").trim();
  if (currentTripId) tripIds.add(currentTripId);

  packages.forEach((pkg) => {
    const tripId = String(pkg.currentTripId || pkg.loadedOnTrip || "").trim();
    if (tripId) tripIds.add(tripId);
  });

  return [...tripIds];
}

function summarizeTripPackages(packages = []) {
  return {
    totalQty: sumTotalQty(packages),
    loadedQty: sumLoadedQty(packages),
    receivedQty: sumReceivedQty(packages),
    missingQty: sumMissingQty(packages),
    damagedQty: sumDamagedQty(packages),
    packageBarcodes: packages.map(getPackageIdentity).filter(Boolean),
  };
}

function snapshotChanged(data = {}, snapshot = {}, repairedPackages = []) {
  const oldPackages = Array.isArray(data.packages) ? data.packages : [];
  const oldStatus = String(data.status || "").toUpperCase();
  const newStatus = String(snapshot.status || "").toUpperCase();

  if (oldStatus !== newStatus) return true;
  if (JSON.stringify(oldPackages) !== JSON.stringify(repairedPackages)) {
    return true;
  }
  if (
    JSON.stringify(data.packageBreakdown || null) !==
    JSON.stringify(snapshot.packageBreakdown || null)
  ) {
    return true;
  }

  const oldTripId = String(data.currentTripId || "").trim() || null;
  const newTripId = snapshot.currentTripId || null;
  return oldTripId !== newTripId;
}

async function syncTripShipment(shipmentDocId, tripId, snapshot, beforePackages = []) {
  const tripRef = await resolveTripDocRef(db, tripId);
  if (!tripRef) {
    console.log(`  trip ${tripId}: not found, skipped trip_shipments sync`);
    return;
  }

  const tripScopedBefore = new Set(
    beforePackages
      .filter((pkg) => packageOnTrip(pkg, tripId))
      .map(getPackageIdentity)
      .filter(Boolean),
  );

  const tripPackages = snapshot.packages.filter((pkg) =>
    tripScopedBefore.has(getPackageIdentity(pkg)),
  );

  const tripStats = summarizeTripPackages(tripPackages);
  const pendingCount = Math.max(
    tripStats.totalQty -
      tripStats.loadedQty -
      tripStats.receivedQty -
      tripStats.missingQty -
      tripStats.damagedQty,
    0,
  );

  const tripShipmentRef = tripRef.collection("trip_shipments").doc(shipmentDocId);
  const tripShipmentSnap = await tripShipmentRef.get();
  if (!tripShipmentSnap.exists) {
    console.log(`  trip ${tripId}: no trip_shipments/${shipmentDocId}, skipped`);
    return;
  }

  const oldTripStatus = String(tripShipmentSnap.data()?.status || "").toUpperCase();
  console.log(
    `  trip ${tripId}: trip_shipments ${oldTripStatus} -> ${String(snapshot.status || "").toUpperCase()}`,
  );

  if (!DRY_RUN) {
    await tripShipmentRef.update({
      status: snapshot.status,
      totalItems: tripStats.totalQty,
      pendingCount,
      loadedCount: tripStats.loadedQty,
      deliveredCount: tripStats.receivedQty,
      receivedCount: tripStats.receivedQty,
      missingCount: tripStats.missingQty,
      damagedCount: tripStats.damagedQty,
      packageBarcodes: tripStats.packageBarcodes,
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: "rederiveShipmentStatusesFromPackages.js",
    });
  }
}

async function repairShipment(shipmentDoc) {
  const data = shipmentDoc.data() || {};
  const beforePackages = Array.isArray(data.packages)
    ? data.packages.map(normalizePackageRow)
    : [];

  if (!beforePackages.length) {
    console.log(`${shipmentDoc.id}: skipped (no packages)`);
    return { updated: false };
  }

  const repairedPackages = beforePackages.map(repairStaleOdionganPackageRow);
  const snapshot = buildShipmentSnapshot(repairedPackages, {
    previousStatus: data.status,
    isHubReceive: true,
  });
  const derivedSnapshot = buildDerivedShipmentSnapshot(repairedPackages, {
    previousStatus: data.status,
  });

  const oldStatus = String(data.status || "").toUpperCase();
  const newStatus = String(derivedSnapshot.status || snapshot.status || "").toUpperCase();
  const poolFlagChanged =
    Boolean(data.availableForDelivery) !==
    (derivedSnapshot.availableForDelivery === true);

  if (
    !snapshotChanged(data, snapshot, repairedPackages) &&
    !poolFlagChanged &&
    oldStatus === newStatus
  ) {
    console.log(`${shipmentDoc.id}: unchanged (${oldStatus})`);
    return { updated: false };
  }

  console.log(
    `${DRY_RUN ? "[DRY_RUN] " : ""}${shipmentDoc.id}: ${oldStatus} -> ${newStatus}`,
  );

  repairedPackages.forEach((pkg, index) => {
    const before = beforePackages[index];
    const beforeStatus = normalizePackageStatus(before);
    const afterStatus = normalizePackageStatus(pkg);
    if (
      beforeStatus !== afterStatus ||
      JSON.stringify(before) !== JSON.stringify(pkg)
    ) {
      console.log(
        `  ${getPackageIdentity(pkg)}: ${beforeStatus} -> ${afterStatus}`,
      );
    }
  });

  const tripIds = collectTripIds(data, beforePackages);

  if (!DRY_RUN) {
    const shipmentUpdate = {
      status: derivedSnapshot.status || snapshot.status,
      packages: derivedSnapshot.packages || snapshot.packages,
      packageBreakdown: derivedSnapshot.packageBreakdown || snapshot.packageBreakdown,
      availableForDelivery: derivedSnapshot.availableForDelivery === true,
      currentTripIds: snapshot.currentTripIds,
      currentTripId: snapshot.currentTripId,
      "totals.totalItems": snapshot.totals.totalItems,
      "totals.totalContentQty": snapshot.totals.totalContentQty,
      "totals.loaded": snapshot.totals.loaded,
      "totals.received": snapshot.totals.received,
      "totals.delivered": snapshot.totals.delivered,
      "totals.pending": snapshot.totals.pending,
      "totals.missing": snapshot.totals.missing,
      "totals.damaged": snapshot.totals.damaged,
      updatedAt: FieldValue.serverTimestamp(),
    };

    if (
      snapshot.status === "ARRIVED" ||
      snapshot.status === "PARTIALLY_ARRIVED"
    ) {
      shipmentUpdate.custodyOwnerType = "WAREHOUSE";
      shipmentUpdate.custodyOwnerId = ODIONGAN_WAREHOUSE;
      shipmentUpdate.currentLocationState = ODIONGAN_WAREHOUSE;
    }

    await shipmentDoc.ref.update(shipmentUpdate);

    for (const tripId of tripIds) {
      await syncTripShipment(
        shipmentDoc.id,
        tripId,
        snapshot,
        beforePackages,
      );
    }
  } else {
    for (const tripId of tripIds) {
      await syncTripShipment(
        shipmentDoc.id,
        tripId,
        snapshot,
        beforePackages,
      );
    }
  }

  return { updated: true };
}

async function resolveShipmentDoc(shipmentId) {
  const directSnap = await db.collection("shipments").doc(shipmentId).get();
  if (directSnap.exists) return directSnap;

  const query = await db
    .collection("shipments")
    .where("shipmentId", "==", shipmentId)
    .limit(1)
    .get();
  if (!query.empty) return query.docs[0];

  throw new Error(`Shipment not found: ${shipmentId}`);
}

async function main() {
  let shipmentDocs = [];

  if (SHIPMENT_IDS.length) {
    shipmentDocs = await Promise.all(
      SHIPMENT_IDS.map((shipmentId) => resolveShipmentDoc(shipmentId)),
    );
  } else if (TRIP_ID) {
    const tripRef = await resolveTripDocRef(db, TRIP_ID);
    if (!tripRef) throw new Error(`Trip not found: ${TRIP_ID}`);
    const tripShipSnap = await tripRef.collection("trip_shipments").get();
    const shipmentSnaps = await Promise.all(
      tripShipSnap.docs.map((doc) =>
        db.collection("shipments").doc(doc.id).get(),
      ),
    );
    shipmentDocs = shipmentSnaps.filter((snap) => snap.exists);
  } else {
    throw new Error("Set SHIPMENT_ID or TRIP_ID");
  }

  let updated = 0;
  for (const shipmentDoc of shipmentDocs) {
    const result = await repairShipment(shipmentDoc);
    if (result.updated) updated += 1;
  }

  console.log(
    `${DRY_RUN ? "Dry run complete" : "Repair complete"}: ${updated} shipment(s) updated.`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
