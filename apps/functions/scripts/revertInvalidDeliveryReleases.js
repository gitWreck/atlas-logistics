"use strict";

/**
 * Repair shipments where release marked every piece RELEASED_FOR_DELIVERY
 * even though only some were hub-received at Odiongan.
 *
 * Usage:
 *   DRY_RUN=1 SHIPMENT_ID=AT-20260605-SHP-295493 node scripts/revertInvalidDeliveryReleases.js
 *   SHIPMENT_ID=... node scripts/revertInvalidDeliveryReleases.js
 */

const admin = require("firebase-admin");
const { buildDerivedShipmentSnapshot } = require("../src/packages/shipmentStatus");
const {
  isEligiblePieceForDeliveryRelease,
} = require("../src/warehouse/packageDeliveryOperations");
const { PACKAGE_STATUS } = require("../src/packages/packageStatus");

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

const DRY_RUN = process.env.DRY_RUN === "1";
const SHIPMENT_ID = String(process.env.SHIPMENT_ID || "").trim();

function revertPackage(pkg = {}) {
  const status = String(pkg.status || "").toUpperCase();
  if (
    status !== PACKAGE_STATUS.RELEASED_FOR_DELIVERY &&
    pkg.availableForDelivery !== true
  ) {
    return pkg;
  }

  if (isEligiblePieceForDeliveryRelease(pkg)) {
    return pkg;
  }

  const loadedQty = Number(pkg.loadedQty) || 0;
  const receivedQty = Number(pkg.receivedQty) || 0;
  const onTrip = String(pkg.currentTripId || pkg.loadedOnTrip || "").trim();

  let nextStatus = PACKAGE_STATUS.RECEIVED_AT_DIVISORIA;
  if (onTrip || loadedQty > 0) {
    nextStatus =
      String(pkg.status || "").toUpperCase() === PACKAGE_STATUS.IN_TRANSIT
        ? PACKAGE_STATUS.IN_TRANSIT
        : PACKAGE_STATUS.LOADED_TO_TRIP;
  } else if (receivedQty > 0) {
    nextStatus = PACKAGE_STATUS.ARRIVED_AT_ODIONGAN;
  }

  return {
    ...pkg,
    status: nextStatus,
    availableForDelivery: false,
    releasedToDeliveryOpsAt: null,
    updatedAt: new Date().toISOString(),
  };
}

async function repairShipment(docSnap) {
  const data = docSnap.data() || {};
  const packages = Array.isArray(data.packages) ? data.packages : [];
  const repaired = packages.map(revertPackage);

  const changed =
    JSON.stringify(packages.map((p) => p.status)) !==
    JSON.stringify(repaired.map((p) => p.status));

  if (!changed) {
    console.log(`Skip ${docSnap.id}: nothing to repair`);
    return false;
  }

  const snapshot = buildDerivedShipmentSnapshot(repaired, {
    previousStatus: data.status,
  });

  console.log(
    `${DRY_RUN ? "[DRY_RUN] " : ""}${docSnap.id}: ${data.status} -> ${snapshot.status}`,
  );
  repaired.forEach((pkg) => {
    console.log(`  ${pkg.packageId}: ${pkg.status}`);
  });

  if (!DRY_RUN) {
    await docSnap.ref.update({
      packages: snapshot.packages,
      packageBreakdown: snapshot.packageBreakdown,
      status: snapshot.status,
      availableForDelivery: snapshot.availableForDelivery,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  }

  return true;
}

async function main() {
  if (!SHIPMENT_ID) {
    throw new Error("Set SHIPMENT_ID to the shipment document id or public code query.");
  }

  let docSnap = await db.collection("shipments").doc(SHIPMENT_ID).get();
  if (!docSnap.exists) {
    const q = await db
      .collection("shipments")
      .where("shipmentId", "==", SHIPMENT_ID)
      .limit(1)
      .get();
    if (q.empty) throw new Error(`Shipment not found: ${SHIPMENT_ID}`);
    docSnap = q.docs[0];
  }

  const repaired = await repairShipment(docSnap);
  console.log(repaired ? "Repair done." : "No changes.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
