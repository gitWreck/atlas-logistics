"use strict";

/**
 * Mark shipment piece(s) as hub-received at Odiongan (admin repair).
 *
 * Usage:
 *   DRY_RUN=1 SHIPMENT_ID=AT-20260615-SHP-078442 node scripts/markShipmentArrivedAtOdiongan.js
 *   SHIPMENT_ID=AT-20260615-SHP-078442 node scripts/markShipmentArrivedAtOdiongan.js
 *
 * Single piece only:
 *   SHIPMENT_ID=AT-20260615-SHP-768856 PACKAGE_IDS=AT-20260615-SHP-768856-13 node scripts/markShipmentArrivedAtOdiongan.js
 *
 * Multiple shipments (comma-separated):
 *   SHIPMENT_ID=AT-20260615-SHP-078442,AT-20260615-SHP-768856 node scripts/markShipmentArrivedAtOdiongan.js
 *
 * Optional:
 *   TRIP_ID=TRIP-HUB-20260616-0006   (defaults to shipment.currentTripId)
 *   NOTE="Manual hub receive repair"
 */

const admin = require("firebase-admin");
const { FieldValue } = require("firebase-admin/firestore");
const { normalizeQty } = require("../src/utilities/packageHelpers");
const {
  PACKAGE_STATUS,
  normalizePackageStatus,
  TERMINAL_STATUSES,
  ODIONGAN_WAREHOUSE,
} = require("../src/packages/packageStatus");
const {
  applyLinehaulUnloadAtHub,
  buildShipmentSnapshot,
  normalizePackageRow,
  packageOnTrip,
  sumLoadedQty,
  sumReceivedQty,
  sumMissingQty,
  sumDamagedQty,
  sumTotalQty,
} = require("../src/packages/tripPackageOperations");
const { initAdminApp, resolveTripDocRef } = require("./initAdmin");

initAdminApp();

const db = admin.firestore();
const DRY_RUN = process.env.DRY_RUN === "1";
const SHIPMENT_IDS = String(process.env.SHIPMENT_ID || "")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);
const PACKAGE_IDS = new Set(
  String(process.env.PACKAGE_IDS || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean),
);
const TRIP_ID_OVERRIDE = String(process.env.TRIP_ID || "").trim();
const NOTE =
  String(process.env.NOTE || "").trim() ||
  "Manual repair: marked arrived at Odiongan";

const HUB_ARRIVAL_ELIGIBLE = new Set([
  PACKAGE_STATUS.IN_TRANSIT,
  PACKAGE_STATUS.LOADED_TO_TRIP,
  PACKAGE_STATUS.LOADED,
  PACKAGE_STATUS.PARTIALLY_LOADED,
]);

const AT_ODIONGAN_POOL = new Set([
  PACKAGE_STATUS.ARRIVED_AT_ODIONGAN,
  PACKAGE_STATUS.AVAILABLE_AT_ODIONGAN_WAREHOUSE,
  PACKAGE_STATUS.RETURNED_RECEIVED_AT_ODIONGAN,
  PACKAGE_STATUS.RETURNED_RECEIVED_AT_HUB,
]);

function getPackageIdentity(pkg = {}) {
  return String(pkg.packageId || pkg.trackingNumber || "").trim();
}

function shouldTargetPackage(pkg = {}) {
  const identity = getPackageIdentity(pkg);
  if (PACKAGE_IDS.size > 0) {
    return PACKAGE_IDS.has(identity);
  }
  return true;
}

function isEligibleForHubArrival(pkg = {}) {
  const status = normalizePackageStatus(pkg);
  if (TERMINAL_STATUSES.has(status)) return false;
  if (AT_ODIONGAN_POOL.has(status)) return false;
  if (HUB_ARRIVAL_ELIGIBLE.has(status)) return true;

  const onTrip = String(pkg.currentTripId || pkg.loadedOnTrip || "").trim();
  return Boolean(onTrip);
}

function markPieceArrivedAtOdiongan(pkg = {}, { tripId, nowIso } = {}) {
  const normalized = normalizePackageRow(pkg);
  const status = normalizePackageStatus(normalized);

  if (AT_ODIONGAN_POOL.has(status)) {
    return { pkg: normalized, changed: false, reason: "already at Odiongan" };
  }
  if (TERMINAL_STATUSES.has(status)) {
    return { pkg: normalized, changed: false, reason: "terminal status" };
  }
  if (!isEligibleForHubArrival(normalized)) {
    return { pkg: normalized, changed: false, reason: `ineligible (${status})` };
  }

  if (tripId && packageOnTrip(normalized, tripId)) {
    return {
      pkg: applyLinehaulUnloadAtHub(normalized, { tripId, nowIso }),
      changed: true,
      reason: "unloaded from trip",
    };
  }

  return {
    pkg: {
      ...normalized,
      status: PACKAGE_STATUS.ARRIVED_AT_ODIONGAN,
      loadedQty: 0,
      receivedQty: normalized.quantity,
      currentTripId: null,
      loadedOnTrip: null,
      custodyOwnerType: "WAREHOUSE",
      custodyOwnerId: ODIONGAN_WAREHOUSE,
      hubReceivedAt: normalized.hubReceivedAt || nowIso,
      updatedAt: nowIso,
    },
    changed: true,
    reason: "forced hub receive",
  };
}

async function resolveShipmentDoc(shipmentId) {
  const directSnap = await db.collection("shipments").doc(shipmentId).get();
  if (directSnap.exists) return directSnap;

  const byPublicId = await db
    .collection("shipments")
    .where("shipmentId", "==", shipmentId)
    .limit(1)
    .get();
  if (!byPublicId.empty) return byPublicId.docs[0];

  const byBarcode = await db
    .collection("shipments")
    .where("packageBarcodes", "array-contains", shipmentId)
    .limit(1)
    .get();
  if (!byBarcode.empty) return byBarcode.docs[0];

  throw new Error(`Shipment not found: ${shipmentId}`);
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

async function repairShipment(docSnap) {
  const data = docSnap.data() || {};
  const tripId =
    TRIP_ID_OVERRIDE ||
    String(data.currentTripId || "").trim() ||
    null;
  const nowIso = new Date().toISOString();
  const oldPackages = Array.isArray(data.packages)
    ? data.packages.map(normalizePackageRow)
    : [];

  if (!oldPackages.length) {
    console.log(`${docSnap.id}: skipped (no packages)`);
    return { updated: false };
  }

  const tripScopedBefore = new Set(
    oldPackages
      .filter((pkg) => !tripId || packageOnTrip(pkg, tripId))
      .map(getPackageIdentity)
      .filter(Boolean),
  );

  let changedCount = 0;
  const repairedPackages = oldPackages.map((pkg) => {
    if (!shouldTargetPackage(pkg)) return pkg;

    const result = markPieceArrivedAtOdiongan(pkg, { tripId, nowIso });
    if (result.changed) changedCount += 1;

    console.log(
      `  ${getPackageIdentity(pkg) || "(unknown)"}: ${normalizePackageStatus(pkg)} -> ${normalizePackageStatus(result.pkg)} (${result.reason})`,
    );

    return result.pkg;
  });

  if (changedCount === 0) {
    console.log(`${docSnap.id}: nothing to update`);
    return { updated: false };
  }

  const snapshot = buildShipmentSnapshot(repairedPackages, {
    previousStatus: data.status,
    isHubReceive: true,
  });

  const oldStatus = String(data.status || "").toUpperCase();
  const newStatus = String(snapshot.status || "").toUpperCase();

  console.log(
    `${DRY_RUN ? "[DRY_RUN] " : ""}${docSnap.id}: ${oldStatus} -> ${newStatus} (${changedCount} piece(s))`,
  );

  if (DRY_RUN) {
    return { updated: true, dryRun: true, tripId };
  }

  const shipmentUpdate = {
    packages: snapshot.packages,
    status: snapshot.status,
    packageBreakdown: snapshot.packageBreakdown,
    currentTripIds: snapshot.currentTripIds,
    currentTripId: snapshot.currentTripId,
    custodyOwnerType: "WAREHOUSE",
    custodyOwnerId: ODIONGAN_WAREHOUSE,
    currentLocationState: ODIONGAN_WAREHOUSE,
    "totals.totalItems": snapshot.totals.totalItems,
    "totals.totalContentQty": snapshot.totals.totalContentQty,
    "totals.loaded": snapshot.totals.loaded,
    "totals.received": snapshot.totals.received,
    "totals.delivered": snapshot.totals.delivered,
    "totals.pending": snapshot.totals.pending,
    "totals.missing": snapshot.totals.missing,
    "totals.damaged": snapshot.totals.damaged,
    updatedAt: FieldValue.serverTimestamp(),
    statusHistory: FieldValue.arrayUnion({
      status: snapshot.status,
      at: new Date(),
      by: "markShipmentArrivedAtOdiongan.js",
      note: NOTE,
      location: ODIONGAN_WAREHOUSE,
    }),
  };

  await docSnap.ref.update(shipmentUpdate);

  if (tripId) {
    const tripRef = await resolveTripDocRef(db, tripId);
    if (tripRef) {
      const tripPackages = snapshot.packages.filter((pkg) => {
        const identity = getPackageIdentity(pkg);
        return tripScopedBefore.has(identity);
      });
      const tripStats = summarizeTripPackages(tripPackages);
      const pendingCount = Math.max(
        tripStats.totalQty -
          tripStats.loadedQty -
          tripStats.receivedQty -
          tripStats.missingQty -
          tripStats.damagedQty,
        0,
      );

      await tripRef
        .collection("trip_shipments")
        .doc(docSnap.id)
        .set(
          {
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
            updatedBy: "markShipmentArrivedAtOdiongan.js",
          },
          { merge: true },
        );
    }
  }

  return { updated: true, tripId };
}

async function main() {
  if (!SHIPMENT_IDS.length) {
    throw new Error("Set SHIPMENT_ID to one or more shipment codes.");
  }

  let updated = 0;
  for (const shipmentId of SHIPMENT_IDS) {
    const docSnap = await resolveShipmentDoc(shipmentId);
    const result = await repairShipment(docSnap);
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
