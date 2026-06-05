"use strict";

/**
 * Re-derive shipment master status from package rows (fixes stale LOADED / IN_TRANSIT stamps).
 *
 * Usage:
 *   DRY_RUN=1 SHIPMENT_ID=AT-20260605-SHP-622065 node scripts/rederiveShipmentStatusesFromPackages.js
 *   DRY_RUN=1 TRIP_ID=TRIP-HUB-20260605-0001 node scripts/rederiveShipmentStatusesFromPackages.js
 */

const admin = require("firebase-admin");
const {
  buildShipmentSnapshot,
  normalizePackageRow,
} = require("../src/packages/tripPackageOperations");

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();
const DRY_RUN = process.env.DRY_RUN === "1";
const SHIPMENT_ID = String(process.env.SHIPMENT_ID || "").trim();
const TRIP_ID = String(process.env.TRIP_ID || "").trim();

async function repairShipment(shipmentDoc) {
  const data = shipmentDoc.data() || {};
  const packages = Array.isArray(data.packages)
    ? data.packages.map(normalizePackageRow)
    : [];

  if (!packages.length) {
    return { skipped: true, reason: "no packages" };
  }

  const snapshot = buildShipmentSnapshot(packages, {
    previousStatus: data.status,
  });
  const oldStatus = String(data.status || "").toUpperCase();
  const newStatus = String(snapshot.status || "").toUpperCase();

  if (oldStatus === newStatus) {
    console.log(`${shipmentDoc.id}: unchanged (${oldStatus})`);
    return { updated: false };
  }

  console.log(
    `${DRY_RUN ? "[DRY_RUN] " : ""}${shipmentDoc.id}: ${oldStatus} -> ${newStatus}`,
  );

  if (!DRY_RUN) {
    await shipmentDoc.ref.update({
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
  }

  return { updated: true };
}

async function main() {
  let shipmentDocs = [];

  if (SHIPMENT_ID) {
    const snap = await db.collection("shipments").doc(SHIPMENT_ID).get();
    if (!snap.exists) {
      const query = await db
        .collection("shipments")
        .where("shipmentId", "==", SHIPMENT_ID)
        .limit(1)
        .get();
      if (query.empty) throw new Error(`Shipment not found: ${SHIPMENT_ID}`);
      shipmentDocs = query.docs;
    } else {
      shipmentDocs = [snap];
    }
  } else if (TRIP_ID) {
    const tripShipSnap = await db
      .collection("truck_trips")
      .doc(TRIP_ID)
      .collection("trip_shipments")
      .get();
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
