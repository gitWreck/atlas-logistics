"use strict";

/**
 * Repair shipments/manifests left in a loaded state after trip cancellation.
 *
 * Usage:
 *   DRY_RUN=1 TRIP_ID=TRIP-HUB-20260704-0002 node scripts/repairCancelledTripLoadState.js
 *   TRIP_ID=TRIP-HUB-20260704-0002 node scripts/repairCancelledTripLoadState.js
 *   DRY_RUN=1 ALL_CANCELLED=1 node scripts/repairCancelledTripLoadState.js
 */

const admin = require("firebase-admin");
const { FieldValue } = require("firebase-admin/firestore");
const { normalizeQty } = require("../src/utilities/packageHelpers");
const {
  packageOnTrip,
  buildShipmentSnapshot,
  normalizePackageRow,
} = require("../src/packages/tripPackageOperations");
const { initAdminApp, resolveTripDocRef } = require("./initAdmin");

initAdminApp();

const db = admin.firestore();
const DRY_RUN = process.env.DRY_RUN === "1";
const TRIP_ID = String(process.env.TRIP_ID || "").trim();
const ALL_CANCELLED = process.env.ALL_CANCELLED === "1";

function deriveResetPackageStatus(pkg = {}) {
  const quantity = Math.max(normalizeQty(pkg.quantity, 1), 1);
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const missingQty = clamp(normalizeQty(pkg.missingQty, 0), 0, quantity);
  const damagedQty = clamp(normalizeQty(pkg.damagedQty, 0), 0, quantity);

  if (damagedQty > 0) return "DAMAGED";
  if (missingQty > 0) return "MISSING";
  return "RECEIVED";
}

function resetPackagesDetachedFromTrip(packages = [], tripId) {
  return packages.map((pkg) => {
    if (!packageOnTrip(pkg, tripId)) {
      return pkg;
    }

    const normalized = normalizePackageRow(pkg);
    const quantity = Math.max(normalizeQty(normalized.quantity, 1), 1);
    const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
    const missingQty = clamp(normalizeQty(normalized.missingQty, 0), 0, quantity);
    const damagedQty = clamp(normalizeQty(normalized.damagedQty, 0), 0, quantity);
    const resetPkg = {
      ...normalized,
      quantity,
      loadedQty: 0,
      receivedQty: 0,
      missingQty,
      damagedQty,
      currentTripId: null,
      loadedOnTrip: null,
      loadedAt: null,
      loadedBy: null,
      loadedByRole: null,
      loadedByUid: null,
      loadedAtLocation: null,
      deliveredAt: null,
      deliveredBy: null,
      updatedAt: new Date().toISOString(),
      updatedBy: "repairCancelledTripLoadState.js",
    };

    return {
      ...resetPkg,
      status: deriveResetPackageStatus(resetPkg),
    };
  });
}

async function repairTrip(tripRef) {
  const tripId = tripRef.id;
  const tripSnap = await tripRef.get();
  if (!tripSnap.exists) return { tripId, repairedShipments: 0, repairedManifests: 0 };

  const trip = tripSnap.data() || {};
  if (String(trip.status || "").toUpperCase() !== "CANCELLED") {
    console.log(`${tripId}: skipped (status=${trip.status})`);
    return { tripId, repairedShipments: 0, repairedManifests: 0 };
  }

  const manifestSnap = await tripRef.collection("trip_shipments").get();
  const shipmentIds = new Set(manifestSnap.docs.map((doc) => doc.id));
  let repairedShipments = 0;
  let repairedManifests = 0;

  for (const shipmentId of shipmentIds) {
    const shipmentRef = db.collection("shipments").doc(shipmentId);
    const shipmentSnap = await shipmentRef.get();
    if (!shipmentSnap.exists) continue;

    const data = shipmentSnap.data() || {};
    const beforePackages = data.packages || [];
    const updatedPackages = resetPackagesDetachedFromTrip(beforePackages, tripId);
    const hasPackageChanges =
      JSON.stringify(beforePackages) !== JSON.stringify(updatedPackages);

    if (hasPackageChanges) {
      const snapshot = buildShipmentSnapshot(updatedPackages, {
        previousStatus: data.status,
      });
      const fullyDetached = (snapshot.currentTripIds || []).length === 0;

      console.log(
        `${DRY_RUN ? "[DRY_RUN] " : ""}${shipmentId}: reset packages detached from ${tripId} (${data.status} -> ${snapshot.status})`,
      );

      if (!DRY_RUN) {
        const update = {
          packages: snapshot.packages,
          status: snapshot.status,
          packageBreakdown: snapshot.packageBreakdown,
          availableForDelivery: snapshot.packageBreakdown?.available > 0,
          currentTripIds: snapshot.currentTripIds,
          currentTripId: snapshot.currentTripId,
          "totals.pending": snapshot.totals.pending,
          "totals.loaded": snapshot.totals.loaded,
          "totals.delivered": snapshot.totals.delivered,
          "totals.received": snapshot.totals.received,
          "totals.missing": snapshot.totals.missing,
          "totals.damaged": snapshot.totals.damaged,
          "totals.totalContentQty": snapshot.totals.totalContentQty,
          "totals.totalItems": snapshot.totals.totalItems,
          updatedAt: FieldValue.serverTimestamp(),
          updatedBy: "repairCancelledTripLoadState.js",
        };

        if (String(data.currentTruckTripId || "") === tripId) {
          update.currentTruckTripId = null;
        }
        if (fullyDetached) {
          update.assignedToTripAt = null;
        }

        await shipmentRef.update(update);
      }

      repairedShipments += 1;
    }
  }

  for (const manifestDoc of manifestSnap.docs) {
    const manifest = manifestDoc.data() || {};
    const loadedCount = normalizeQty(manifest.loadedCount, 0);
    const status = String(manifest.status || "").toUpperCase();
    const needsManifestRepair = loadedCount > 0 || status !== "CANCELLED";

    if (!needsManifestRepair) continue;

    console.log(
      `${DRY_RUN ? "[DRY_RUN] " : ""}${tripId}/trip_shipments/${manifestDoc.id}: ${status} loaded=${loadedCount} -> CANCELLED loaded=0`,
    );

    if (!DRY_RUN) {
      const totalItems = normalizeQty(manifest.totalItems, 0);
      await manifestDoc.ref.update({
        status: "CANCELLED",
        loadedCount: 0,
        pendingCount: totalItems,
        deliveredCount: 0,
        receivedCount: 0,
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: "repairCancelledTripLoadState.js",
      });
    }

    repairedManifests += 1;
  }

  const needsTripCounterRepair =
    normalizeQty(trip.totalLoaded, 0) > 0 || normalizeQty(trip.itemPending, 0) === 0;

  if (needsTripCounterRepair) {
    console.log(
      `${DRY_RUN ? "[DRY_RUN] " : ""}${tripId}: totalLoaded ${trip.totalLoaded} -> 0`,
    );
    if (!DRY_RUN) {
      await tripRef.update({
        totalLoaded: 0,
        itemPending: normalizeQty(trip.totalItems, 0),
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: "repairCancelledTripLoadState.js",
      });
    }
  }

  return { tripId, repairedShipments, repairedManifests };
}

async function main() {
  let tripRefs = [];

  if (TRIP_ID) {
    const tripRef = await resolveTripDocRef(db, TRIP_ID);
    if (!tripRef) throw new Error(`Trip not found: ${TRIP_ID}`);
    tripRefs = [tripRef];
  } else if (ALL_CANCELLED) {
    const snap = await db
      .collection("truck_trips")
      .where("status", "==", "CANCELLED")
      .get();
    tripRefs = snap.docs.map((doc) => doc.ref);
  } else {
    throw new Error("Set TRIP_ID or ALL_CANCELLED=1");
  }

  let totalShipments = 0;
  let totalManifests = 0;

  for (const tripRef of tripRefs) {
    const result = await repairTrip(tripRef);
    totalShipments += result.repairedShipments;
    totalManifests += result.repairedManifests;
  }

  console.log(
    `${DRY_RUN ? "Dry run complete" : "Repair complete"}: ${totalShipments} shipment(s), ${totalManifests} manifest row(s).`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
