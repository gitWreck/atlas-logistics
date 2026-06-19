"use strict";

/**
 * Backfill hubReceivedOnTrip + resync trip_shipments counters for hub trips.
 * Use when hub receive scans did not link labels to trip packageBarcodes.
 *
 * Usage:
 *   DRY_RUN=1 TRIP_ID=TRIP-HUB-20260616-0006 node scripts/repairTripPackageLinks.js
 *   TRIP_ID=TRIP-HUB-20260616-0006 node scripts/repairTripPackageLinks.js
 *   TRIP_ID=TRIP-HUB-20260616-0006 SHIPMENT_ID=AT-20260615-SHP-078442 node scripts/repairTripPackageLinks.js
 */

const admin = require("firebase-admin");
const { FieldValue } = require("firebase-admin/firestore");
const { initAdminApp, resolveTripDocRef } = require("./initAdmin");
const { syncTripShipment } = require("./syncTripShipmentCounters");

initAdminApp();

const db = admin.firestore();
const DRY_RUN = process.env.DRY_RUN === "1";
const TRIP_ID = String(process.env.TRIP_ID || "").trim();
const SHIPMENT_FILTER = String(process.env.SHIPMENT_ID || "")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);

function getPackageIdentity(pkg = {}) {
  return String(pkg.packageId || pkg.trackingNumber || "").trim();
}

function needsHubTripLink(pkg = {}, tripId = "", tripBarcodes = new Set()) {
  const packageId = getPackageIdentity(pkg);
  if (!packageId || tripBarcodes.has(packageId)) return false;
  if (String(pkg.hubReceivedOnTrip || "").trim() === tripId) return false;
  if (!pkg.hubReceivedAt) return false;

  const receivedQty = Number(pkg.receivedQty) || 0;
  const loadedQty = Number(pkg.loadedQty) || 0;
  return receivedQty > 0 || loadedQty > 0;
}

async function repairShipmentPackages(tripRef, tripId, shipmentDocId) {
  const shipmentRef = db.collection("shipments").doc(shipmentDocId);
  const shipmentSnap = await shipmentRef.get();
  if (!shipmentSnap.exists) {
    console.log(`Skip missing shipment ${shipmentDocId}`);
    return { shipmentDocId, patched: 0 };
  }

  const tripShipmentSnap = await tripRef
    .collection("trip_shipments")
    .doc(shipmentDocId)
    .get();
  const tripShipment = tripShipmentSnap.data() || {};
  const tripBarcodes = new Set(
    (tripShipment.packageBarcodes || []).filter(Boolean).map(String),
  );
  const shipment = shipmentSnap.data() || {};
  const packages = Array.isArray(shipment.packages) ? shipment.packages : [];

  let patched = 0;
  const nextPackages = packages.map((pkg) => {
    if (!needsHubTripLink(pkg, tripId, tripBarcodes)) return pkg;
    patched += 1;
    return {
      ...pkg,
      hubReceivedOnTrip: tripId,
    };
  });

  if (patched === 0) {
    console.log(`  ${shipmentDocId}: no package rows needed hubReceivedOnTrip`);
    return { shipmentDocId, patched: 0 };
  }

  console.log(
    `  ${shipmentDocId}: backfill hubReceivedOnTrip on ${patched} package row(s)`,
  );

  if (!DRY_RUN) {
    await shipmentRef.update({
      packages: nextPackages,
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: "repairTripPackageLinks",
    });
  }

  return { shipmentDocId, patched };
}

async function main() {
  if (!TRIP_ID) {
    throw new Error("TRIP_ID is required.");
  }

  const tripRef = await resolveTripDocRef(db, TRIP_ID);
  if (!tripRef) {
    throw new Error(`Trip not found: ${TRIP_ID}`);
  }

  const tripSnap = await tripRef.get();
  const trip = tripSnap.data() || {};
  const manifestId = trip.manifestId;

  let shipmentDocIds = [];
  if (manifestId) {
    const manifestSnap = await db.collection("manifests").doc(manifestId).get();
    const manifest = manifestSnap.data() || {};
    shipmentDocIds = (manifest.shipments || [])
      .map((row) => row.trackingShipmentId || row.shipmentId || row.id)
      .filter(Boolean);
  }

  if (shipmentDocIds.length === 0) {
    const tripShipSnap = await tripRef.collection("trip_shipments").get();
    shipmentDocIds = tripShipSnap.docs.map((doc) => doc.id);
  }

  if (SHIPMENT_FILTER.length > 0) {
    shipmentDocIds = shipmentDocIds.filter((id) => SHIPMENT_FILTER.includes(id));
  }

  console.log(
    `${DRY_RUN ? "[DRY_RUN] " : ""}Repair trip package links for ${TRIP_ID} (${shipmentDocIds.length} shipment(s))`,
  );

  let totalPatched = 0;
  for (const shipmentDocId of shipmentDocIds) {
    const result = await repairShipmentPackages(tripRef, TRIP_ID, shipmentDocId);
    totalPatched += result.patched;

    if (!DRY_RUN && (result.patched > 0 || SHIPMENT_FILTER.length > 0)) {
      await syncTripShipment(tripRef, TRIP_ID, shipmentDocId, "auto");
    }
  }

  if (!DRY_RUN && totalPatched === 0 && SHIPMENT_FILTER.length === 0) {
    for (const shipmentDocId of shipmentDocIds) {
      await syncTripShipment(tripRef, TRIP_ID, shipmentDocId, "auto");
    }
  }

  console.log(
    `Done. ${totalPatched} package row(s) ${DRY_RUN ? "would be " : ""}patched.`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
