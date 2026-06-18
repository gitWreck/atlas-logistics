"use strict";

const admin = require("firebase-admin");
const { stableStringify, sha256Hex } = require("../utilities/helpers");
const { writeCustodyAuditLog } = require("../utilities/custodyAuditLog");

const DELIVERY_MANIFEST_VERSION = "DELIVERY-v1.0";

const HUB_RECEIVED_STATUSES = new Set([
  "ARRIVED_AT_ODIONGAN",
  "AVAILABLE_AT_ODIONGAN_WAREHOUSE",
  "RELEASED_FOR_DELIVERY",
  "AVAILABLE_FOR_DELIVERY",
  "READY_FOR_DELIVERY",
  "LOADED_TO_DELIVERY_VEHICLE",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
  "COMPLETED",
  "FAILED_DELIVERY",
  "RETURNED_TO_WAREHOUSE",
  "RETURNED_RECEIVED_AT_HUB",
  "RETURNED_RECEIVED_AT_ODIONGAN",
]);

function pieceQty(pkg = {}) {
  const qty = Number(pkg.quantity);
  return Number.isFinite(qty) && qty > 0 ? qty : 1;
}

function normalizeStatus(value) {
  return String(value || "").trim().toUpperCase();
}

function packageHasPod(pkg = {}, shipment = {}) {
  if (pkg.proofPhotoUrl || pkg.podPhotoUrl || pkg.podUrl) return true;
  const pod = shipment.proofOfDelivery;
  if (Array.isArray(pod) && pod.length > 0) return true;
  return typeof pod === "string" && pod.trim().length > 0;
}

function aggregateDeliveryStatsFromShipments(shipments = [], shippingTotals = null) {
  const stats = {
    totalReceived: 0,
    totalDelivered: 0,
    totalFailed: 0,
    totalReturned: 0,
    podCaptured: 0,
    totalShipments: shipments.length,
  };

  shipments.forEach((shipment) => {
    const packages = Array.isArray(shipment.packages) ? shipment.packages : [];

    packages.forEach((pkg) => {
      const qty = pieceQty(pkg);
      const status = normalizeStatus(pkg.status);

      const receivedAtHub =
        HUB_RECEIVED_STATUSES.has(status) ||
        Boolean(pkg.hubReceivedAt) ||
        Number(pkg.receivedQty) > 0;

      if (receivedAtHub) {
        stats.totalReceived += qty;
      }

      if (status === "DELIVERED" || status === "COMPLETED") {
        stats.totalDelivered += qty;
        if (packageHasPod(pkg, shipment)) {
          stats.podCaptured += qty;
        }
      } else if (status === "FAILED_DELIVERY") {
        stats.totalFailed += qty;
      } else if (
        [
          "RETURNED_TO_WAREHOUSE",
          "RETURNED_RECEIVED_AT_HUB",
          "RETURNED_RECEIVED_AT_ODIONGAN",
        ].includes(status)
      ) {
        stats.totalReturned += qty;
      }
    });
  });

  if (
    shippingTotals?.totalItems &&
    stats.totalReceived === 0 &&
    stats.totalDelivered + stats.totalFailed + stats.totalReturned > 0
  ) {
    stats.totalReceived = Number(shippingTotals.totalItems);
  }

  if (stats.totalReceived === 0 && shippingTotals?.totalItems) {
    stats.totalReceived = Number(shippingTotals.totalItems);
  }

  return stats;
}

async function loadTripShipments(db, tripDocId) {
  const snap = await db
    .collection("shipments")
    .where("currentTripId", "==", tripDocId)
    .get();

  return snap.docs.map((docSnap) => ({
    id: docSnap.id,
    ...docSnap.data(),
  }));
}

async function loadShippingManifestTotals(db, shippingManifestId) {
  if (!shippingManifestId) return null;
  const snap = await db.collection("manifests").doc(shippingManifestId).get();
  if (!snap.exists) return null;
  return snap.data()?.totals || null;
}

function buildDeliveryManifestPayload({
  tripDocId,
  trip,
  shippingManifestId,
  shippingManifestHash,
  stats,
  actorId,
  actorName,
  completedAtMs,
}) {
  const manifestId = `DELIVERY-MANIFEST-${tripDocId}-${completedAtMs}`;

  return {
    manifestId,
    type: "DELIVERY",
    tripId: tripDocId,
    tripCode: trip.tripId || tripDocId,
    status: "COMPLETED",
    version: DELIVERY_MANIFEST_VERSION,
    shippingManifestId: shippingManifestId || null,
    shippingManifestReference: shippingManifestId || null,
    shippingManifestHash: shippingManifestHash || null,
    trip: {
      tripCode: trip.tripId || null,
      origin: trip.origin || null,
      destination: trip.destination || null,
      route: trip.route || null,
      deliveryHub: trip.destination || "Odiongan Hub",
    },
    meta: {
      completedAtMs,
      completedBy: actorId || null,
      completedByName: actorName || trip.updatedBy || "System",
    },
    totals: {
      totalPackagesReceived: stats.totalReceived,
      totalDelivered: stats.totalDelivered,
      totalFailedDelivery: stats.totalFailed,
      totalReturnedToWarehouse: stats.totalReturned,
      podCaptured: stats.podCaptured,
      totalShipments: stats.totalShipments,
    },
    verifyUrl: `https://atlastransport.ph/verify/${tripDocId}-DELIVERY`,
  };
}

async function sealTripDeliveryManifest({
  db,
  tripDocId,
  actorId = null,
  actorName = null,
  actorRole = null,
}) {
  const tripRef = db.collection("truck_trips").doc(tripDocId);
  const preloadedShipments = await loadTripShipments(db, tripDocId);
  const preTripSnap = await tripRef.get();
  const preTrip = preTripSnap.exists ? preTripSnap.data() || {} : {};
  const preloadedShippingTotals = await loadShippingManifestTotals(db, preTrip.manifestId);

  return db.runTransaction(async (tx) => {
    const tripSnap = await tx.get(tripRef);
    if (!tripSnap.exists) {
      return { ok: false, reason: "TRIP_NOT_FOUND" };
    }

    const trip = tripSnap.data() || {};

    if (trip.deliveryManifestId) {
      return {
        ok: true,
        alreadySealed: true,
        manifestId: trip.deliveryManifestId,
      };
    }

    const status = normalizeStatus(trip.status);
    if (status !== "COMPLETED" && status !== "DELIVERED") {
      return { ok: false, reason: "TRIP_NOT_COMPLETED" };
    }

    const shippingTotals = preloadedShippingTotals;
    const stats = aggregateDeliveryStatsFromShipments(
      preloadedShipments,
      shippingTotals,
    );
    const completedAtMs = Date.now();

    const payload = buildDeliveryManifestPayload({
      tripDocId,
      trip,
      shippingManifestId: trip.manifestId || null,
      shippingManifestHash: trip.manifestHash || null,
      stats,
      actorId: actorId || trip.lastUpdatedBy || trip.autoCompletedBy || null,
      actorName: actorName || trip.updatedBy || null,
      completedAtMs,
    });

    const hash = sha256Hex(stableStringify(payload));
    const manifestRef = db.collection("manifests").doc(payload.manifestId);
    const nowTs = admin.firestore.FieldValue.serverTimestamp();

    tx.set(manifestRef, {
      ...payload,
      hash,
      createdAt: nowTs,
      pdfUrl: null,
    });

    tx.update(tripRef, {
      deliveryManifestId: payload.manifestId,
      deliveryManifestHash: hash,
      deliveryManifestVersion: DELIVERY_MANIFEST_VERSION,
      deliveryManifestCompletedAt: nowTs,
      deliveryManifestCompletedBy:
        actorId || trip.lastUpdatedBy || trip.autoCompletedBy || null,
      updatedAt: nowTs,
    });

    const manifestEventRef = tripRef.collection("manifest_events").doc();
    tx.set(manifestEventRef, {
      type: "DELIVERY_MANIFEST_COMPLETED",
      manifestId: payload.manifestId,
      hash,
      createdAt: nowTs,
      createdBy: actorId || null,
    });

    writeCustodyAuditLog({
      db,
      tx,
      action: "SEAL_DELIVERY_MANIFEST",
      tripId: tripDocId,
      tripDocId,
      targetId: tripDocId,
      targetCollection: "truck_trips",
      actorId: actorId || null,
      actorName: actorName || trip.updatedBy || null,
      actorRole: actorRole || null,
      reason: "Trip delivery manifest sealed on completion",
      previousValue: { deliveryManifestId: null },
      newValue: {
        deliveryManifestId: payload.manifestId,
        hash,
        totals: payload.totals,
      },
      note: `Delivery manifest sealed: ${stats.totalDelivered} delivered, ${stats.totalFailed} failed, ${stats.totalReturned} returned.`,
    });

    return {
      ok: true,
      manifestId: payload.manifestId,
      hash,
      totals: payload.totals,
    };
  });
}

module.exports = {
  DELIVERY_MANIFEST_VERSION,
  aggregateDeliveryStatsFromShipments,
  buildDeliveryManifestPayload,
  sealTripDeliveryManifest,
};
