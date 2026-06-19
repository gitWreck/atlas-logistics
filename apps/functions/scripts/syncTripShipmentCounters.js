"use strict";

/**
 * Sync truck_trips/{tripId}/trip_shipments counters from root shipment package rows.
 * Use after manual hub-receive / rederive repairs so bulk release & handoff match reality.
 *
 * Usage:
 *   DRY_RUN=1 TRIP_ID=TRIP-HUB-20260616-0001 SHIPMENT_ID=AT-20260615-SHP-768856 node scripts/syncTripShipmentCounters.js
 *   TRIP_ID=TRIP-HUB-20260616-0001 SHIPMENT_ID=AT-20260615-SHP-768856 node scripts/syncTripShipmentCounters.js
 *
 * Sync every shipment on a trip:
 *   DRY_RUN=1 TRIP_ID=TRIP-HUB-20260616-0001 node scripts/syncTripShipmentCounters.js
 *
 * Optional:
 *   SCOPE=auto|linked|hub_received|manifest
 *     auto         — linked pieces first; if none, all hub-received (default)
 *     linked       — only pieces tied to trip via loadedOnTrip/currentTripId/packageBarcodes
 *     hub_received — all hub-received pieces on the shipment
 *     manifest     — every package row on the shipment (whole manifest assignment)
 */

const admin = require("firebase-admin");
const { FieldValue } = require("firebase-admin/firestore");
const { normalizeQty } = require("../src/utilities/packageHelpers");
const {
  PACKAGE_STATUS,
  normalizePackageStatus,
} = require("../src/packages/packageStatus");
const {
  buildShipmentSnapshot,
  normalizePackageRow,
  sumLoadedQty,
  sumReceivedQty,
  sumMissingQty,
  sumDamagedQty,
  sumTotalQty,
  packageLinkedToTrip,
} = require("../src/packages/tripPackageOperations");
const { initAdminApp, resolveTripDocRef } = require("./initAdmin");

initAdminApp();

const db = admin.firestore();
const DRY_RUN = process.env.DRY_RUN === "1";
const TRIP_ID = String(process.env.TRIP_ID || "").trim();
const SHIPMENT_IDS = String(process.env.SHIPMENT_ID || "")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);
const SCOPE = String(process.env.SCOPE || "auto").trim().toLowerCase();

const LOADED_ON_TRUCK_STATUSES = new Set([
  PACKAGE_STATUS.IN_TRANSIT,
  PACKAGE_STATUS.LOADED_TO_TRIP,
  PACKAGE_STATUS.LOADED,
  PACKAGE_STATUS.PARTIALLY_LOADED,
  PACKAGE_STATUS.OUT_FOR_DELIVERY,
]);

const HUB_RECEIVED_STATUSES = new Set([
  PACKAGE_STATUS.ARRIVED_AT_ODIONGAN,
  PACKAGE_STATUS.AVAILABLE_AT_ODIONGAN_WAREHOUSE,
  PACKAGE_STATUS.RELEASED_FOR_DELIVERY,
  PACKAGE_STATUS.READY_FOR_DELIVERY,
  PACKAGE_STATUS.RETURNED_RECEIVED_AT_ODIONGAN,
  PACKAGE_STATUS.RETURNED_RECEIVED_AT_HUB,
]);

function getPackageIdentity(pkg = {}) {
  return String(pkg.packageId || pkg.trackingNumber || "").trim();
}

function pieceQty(pkg = {}) {
  return Math.max(normalizeQty(pkg.quantity, 1), 1);
}

function isHubReceivedPiece(pkg = {}) {
  const status = normalizePackageStatus(pkg);
  if (HUB_RECEIVED_STATUSES.has(status)) return true;
  if (pkg.hubReceivedAt) return true;
  const receivedQty = normalizeQty(pkg.receivedQty, 0);
  const loadedQty = normalizeQty(pkg.loadedQty, 0);
  return receivedQty > 0 && !LOADED_ON_TRUCK_STATUSES.has(status) && loadedQty === 0;
}

function isOnTruckPiece(pkg = {}) {
  const status = normalizePackageStatus(pkg);
  if (LOADED_ON_TRUCK_STATUSES.has(status)) return true;
  return normalizeQty(pkg.loadedQty, 0) > 0;
}

function packageLinkedToTripForScope(pkg = {}, tripId = "", barcodeSet = new Set()) {
  return packageLinkedToTrip(pkg, tripId, barcodeSet);
}

function resolveTripScopedPackages(
  packages = [],
  tripShipment = {},
  tripId = "",
  scope = "auto",
) {
  const normalized = packages.map(normalizePackageRow);
  const barcodeSet = new Set(
    (tripShipment.packageBarcodes || []).filter(Boolean).map(String),
  );

  const linked = normalized.filter((pkg) =>
    packageLinkedToTripForScope(pkg, tripId, barcodeSet),
  );
  if (linked.length > 0 || scope === "linked") {
    return linked;
  }

  const hubReceived = normalized.filter(isHubReceivedPiece);
  if (scope === "hub_received") return hubReceived;
  if (scope === "manifest") return normalized;
  if (scope === "auto" && hubReceived.length > 0) return hubReceived;

  return linked;
}

function classifyPieceForTripCounters(pkg = {}) {
  const status = normalizePackageStatus(pkg);
  const qty = pieceQty(pkg);

  if (
    status === PACKAGE_STATUS.DELIVERED ||
    status === PACKAGE_STATUS.COMPLETED
  ) {
    return { bucket: "received", qty };
  }

  if (status === PACKAGE_STATUS.MISSING || normalizeQty(pkg.missingQty, 0) > 0) {
    return { bucket: "missing", qty };
  }
  if (status === PACKAGE_STATUS.DAMAGED || normalizeQty(pkg.damagedQty, 0) > 0) {
    return { bucket: "damaged", qty };
  }
  if (isHubReceivedPiece(pkg)) {
    const receivedQty = Math.min(
      Math.max(normalizeQty(pkg.receivedQty, 0), qty),
      qty,
    );
    return { bucket: "received", qty: receivedQty > 0 ? receivedQty : qty };
  }
  if (isOnTruckPiece(pkg)) {
    const loadedQty = Math.min(
      Math.max(normalizeQty(pkg.loadedQty, 0), qty),
      qty,
    );
    return { bucket: "loaded", qty: loadedQty > 0 ? loadedQty : qty };
  }

  return { bucket: "unknown", qty: 0 };
}

function summarizeTripScopedPackages(scopedPackages = []) {
  let loadedCount = 0;
  let receivedCount = 0;
  let missingCount = 0;
  let damagedCount = 0;

  scopedPackages.forEach((pkg) => {
    const { bucket, qty } = classifyPieceForTripCounters(pkg);
    if (bucket === "missing") missingCount += qty;
    else if (bucket === "damaged") damagedCount += qty;
    else if (bucket === "received") receivedCount += qty;
    else if (bucket === "loaded") loadedCount += qty;
  });

  const totalItems = sumTotalQty(scopedPackages);
  const pendingCount = Math.max(
    totalItems - loadedCount - receivedCount - missingCount - damagedCount,
    0,
  );
  const packageBarcodes = scopedPackages.map(getPackageIdentity).filter(Boolean);

  return {
    totalItems,
    loadedCount,
    receivedCount,
    missingCount,
    damagedCount,
    pendingCount,
    packageBarcodes,
    deliveredCount: receivedCount,
  };
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

function countersChanged(before = {}, after = {}) {
  const keys = [
    "totalItems",
    "loadedCount",
    "receivedCount",
    "missingCount",
    "damagedCount",
    "pendingCount",
    "status",
  ];
  if (keys.some((key) => (before[key] ?? null) !== (after[key] ?? null))) {
    return true;
  }

  const beforeBarcodes = JSON.stringify(before.packageBarcodes || []);
  const afterBarcodes = JSON.stringify(after.packageBarcodes || []);
  return beforeBarcodes !== afterBarcodes;
}

async function syncTripShipment(tripRef, tripId, shipmentDocId, scope) {
  const tripShipmentRef = tripRef.collection("trip_shipments").doc(shipmentDocId);
  const [tripShipmentSnap, shipmentSnap] = await Promise.all([
    tripShipmentRef.get(),
    resolveShipmentDoc(shipmentDocId),
  ]);

  if (!tripShipmentSnap.exists) {
    console.log(`${shipmentDocId}: skipped (no trip_shipments row on ${tripId})`);
    return { updated: false };
  }

  if (!shipmentSnap.exists) {
    console.log(`${shipmentDocId}: skipped (root shipment missing)`);
    return { updated: false };
  }

  const tripShipment = tripShipmentSnap.data() || {};
  const shipment = shipmentSnap.data() || {};
  const packages = Array.isArray(shipment.packages) ? shipment.packages : [];
  const scopedPackages = resolveTripScopedPackages(
    packages,
    tripShipment,
    tripId,
    scope,
  );

  if (!scopedPackages.length) {
    console.log(`${shipmentDocId}: skipped (no trip-scoped packages; try SCOPE=hub_received or manifest)`);
    return { updated: false };
  }

  const stats = summarizeTripScopedPackages(scopedPackages);
  const snapshot = buildShipmentSnapshot(packages, {
    previousStatus: shipment.status,
    isHubReceive: true,
  });

  const next = {
    status: snapshot.status,
    totalItems: stats.totalItems,
    pendingCount: stats.pendingCount,
    loadedCount: stats.loadedCount,
    receivedCount: stats.receivedCount,
    deliveredCount: stats.deliveredCount,
    missingCount: stats.missingCount,
    damagedCount: stats.damagedCount,
    packageBarcodes: stats.packageBarcodes,
  };

  const before = {
    status: tripShipment.status,
    totalItems: tripShipment.totalItems,
    loadedCount: tripShipment.loadedCount,
    receivedCount: tripShipment.receivedCount ?? tripShipment.deliveredCount,
    missingCount: tripShipment.missingCount,
    damagedCount: tripShipment.damagedCount,
    pendingCount: tripShipment.pendingCount,
    packageBarcodes: tripShipment.packageBarcodes || [],
  };

  if (!countersChanged(before, next)) {
    console.log(`${shipmentDocId}: unchanged`);
    return { updated: false };
  }

  console.log(
    `${DRY_RUN ? "[DRY_RUN] " : ""}${shipmentDocId}: trip_shipments ${tripId}`,
  );
  console.log(
    `  received ${before.receivedCount ?? 0} -> ${next.receivedCount}, loaded ${before.loadedCount ?? 0} -> ${next.loadedCount}, total ${before.totalItems ?? 0} -> ${next.totalItems}, status ${before.status || "?"} -> ${next.status}`,
  );
  console.log(
    `  packageBarcodes ${(before.packageBarcodes || []).length} -> ${next.packageBarcodes.length} (scope=${scope}, pieces=${scopedPackages.length})`,
  );

  if (!DRY_RUN) {
    await tripShipmentRef.set(
      {
        ...next,
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: "syncTripShipmentCounters.js",
      },
      { merge: true },
    );
  }

  return { updated: true };
}

async function main() {
  if (!TRIP_ID) {
    throw new Error("Set TRIP_ID to the truck trip document id or public trip code.");
  }

  const tripRef = await resolveTripDocRef(db, TRIP_ID);
  if (!tripRef) {
    throw new Error(`Trip not found: ${TRIP_ID}`);
  }

  const tripSnap = await tripRef.get();
  const tripId = tripSnap.id;

  let shipmentDocIds = SHIPMENT_IDS;
  if (!shipmentDocIds.length) {
    const tripShipSnap = await tripRef.collection("trip_shipments").get();
    shipmentDocIds = tripShipSnap.docs.map((doc) => doc.id);
  }

  if (!shipmentDocIds.length) {
    throw new Error(`No trip_shipments rows found for trip ${tripId}`);
  }

  let updated = 0;
  for (const shipmentDocId of shipmentDocIds) {
    const result = await syncTripShipment(tripRef, tripId, shipmentDocId, SCOPE);
    if (result.updated) updated += 1;
  }

  console.log(
    `${DRY_RUN ? "Dry run complete" : "Sync complete"}: ${updated} trip_shipments row(s) updated on ${tripId}.`,
  );
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

module.exports = {
  syncTripShipment,
  resolveTripScopedPackages,
  summarizeTripScopedPackages,
};
