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

async function loadTripManifestShipments(db, tripDocId) {
  const TRIP_SCOPED_STATUSES = new Set([
    "LOADED",
    "LOADED_TO_TRIP",
    "IN_TRANSIT",
    "OUT_FOR_DELIVERY",
    "ARRIVED_AT_ODIONGAN",
    "AVAILABLE_AT_ODIONGAN_WAREHOUSE",
    "RELEASED_FOR_DELIVERY",
    "AVAILABLE_FOR_DELIVERY",
    "READY_FOR_DELIVERY",
    "LOADED_TO_DELIVERY_VEHICLE",
    "DELIVERED",
    "COMPLETED",
    "FAILED_DELIVERY",
    "RETURNED_TO_WAREHOUSE",
    "RETURNED_RECEIVED_AT_HUB",
    "RETURNED_RECEIVED_AT_ODIONGAN",
  ]);

  function packageBelongsToTrip(pkg, tripId, tripBarcodeSet) {
    const packageTripId = pkg.currentTripId || pkg.loadedOnTrip || null;
    const packageId = pkg.packageId || pkg.trackingNumber || null;

    if (packageTripId) return packageTripId === tripId;
    if (!packageId || !tripBarcodeSet.has(String(packageId))) return false;

    const loadedQty = Math.min(Number(pkg.loadedQty) || 0, pieceQty(pkg));
    const receivedQty = Math.min(Number(pkg.receivedQty) || 0, pieceQty(pkg));
    if (loadedQty > 0 || receivedQty > 0) return true;

    return TRIP_SCOPED_STATUSES.has(normalizeStatus(pkg.status));
  }

  const tripShipmentsSnap = await db
    .collection("truck_trips")
    .doc(tripDocId)
    .collection("trip_shipments")
    .get();

  if (!tripShipmentsSnap.empty) {
    const shipmentIds = tripShipmentsSnap.docs.map((doc) => doc.id);
    const rootSnaps = await db.getAll(
      ...shipmentIds.map((id) => db.collection("shipments").doc(id)),
    );

    const rootMap = {};
    rootSnaps.forEach((snap) => {
      if (snap.exists) rootMap[snap.id] = snap.data();
    });

    return tripShipmentsSnap.docs.map((doc) => {
      const data = doc.data() || {};
      const root = rootMap[doc.id] || {};
      const rootPackages = Array.isArray(root.packages) ? root.packages : [];
      const tripBarcodeSet = new Set(
        (data.packageBarcodes || []).filter(Boolean).map(String),
      );
      const tripPackages = rootPackages.filter((pkg) =>
        packageBelongsToTrip(pkg, tripDocId, tripBarcodeSet),
      );
      const visiblePackages =
        tripPackages.length > 0 || tripBarcodeSet.size > 0
          ? tripPackages
          : rootPackages;

      return {
        id: doc.id,
        ...data,
        shipmentId: data.shipmentId || root.shipmentId || doc.id,
        originCode: root.originCode || data.originCode || null,
        destinationCode: root.destinationCode || data.destinationCode || null,
        destinationCity: root.destinationCity || data.destinationCity || null,
        destination: root.destination || data.destination || null,
        recipient: root.recipient || data.recipient || null,
        receiverName: root.recipient?.name || data.receiverName || null,
        packages: visiblePackages,
        proofOfDelivery: root.proofOfDelivery || null,
      };
    });
  }

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

function buildDeliveryManifestShipments(shipments = []) {
  const rows = [];

  shipments.forEach((shipment) => {
    const packages = Array.isArray(shipment.packages) ? shipment.packages : [];
    const contents = [];
    let deliveredCount = 0;
    let failedCount = 0;
    let returnedCount = 0;

    packages.forEach((pkg) => {
      const status = normalizeStatus(pkg.status);
      let outcome = null;
      if (status === "DELIVERED" || status === "COMPLETED") outcome = "DELIVERED";
      else if (status === "FAILED_DELIVERY") outcome = "FAILED_DELIVERY";
      else if (
        [
          "RETURNED_TO_WAREHOUSE",
          "RETURNED_RECEIVED_AT_HUB",
          "RETURNED_RECEIVED_AT_ODIONGAN",
        ].includes(status)
      ) {
        outcome = "RETURNED_TO_WAREHOUSE";
      }
      if (!outcome) return;

      const qty = pieceQty(pkg);
      if (outcome === "DELIVERED") deliveredCount += qty;
      if (outcome === "FAILED_DELIVERY") failedCount += qty;
      if (outcome === "RETURNED_TO_WAREHOUSE") returnedCount += qty;

      contents.push({
        packageId:
          pkg.packageId || pkg.trackingNumber || pkg.pieceId || pkg.barcode || null,
        description: pkg.description || "Standard Pkg",
        status: outcome,
        quantity: qty,
      });
    });

    if (!contents.length) return;

    const originCode = shipment.originCode || "ORG";
    const destCode = shipment.destinationCode || "DEST";

    rows.push({
      trackingShipmentId: shipment.id || null,
      shipmentId: shipment.shipmentId || shipment.id,
      route: `${originCode} -> ${destCode}`,
      destinationLabel:
        shipment.destinationCity ||
        shipment.destination ||
        shipment.recipient?.city ||
        destCode,
      receiverName: shipment.recipient?.name || shipment.receiverName || null,
      deliveredCount,
      failedCount,
      returnedCount,
      totalOutcomeCount: deliveredCount + failedCount + returnedCount,
      contents,
    });
  });

  return rows.sort((a, b) => String(a.shipmentId).localeCompare(String(b.shipmentId)));
}

function buildDeliveryManifestPayload({
  tripDocId,
  trip,
  shippingManifestId,
  shippingManifestHash,
  stats,
  shipments = [],
  actorId,
  actorName,
  completedAtMs,
}) {
  const manifestId = `DELIVERY-MANIFEST-${tripDocId}-${completedAtMs}`;
  const shipmentLedger = buildDeliveryManifestShipments(shipments);

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
    shipments: shipmentLedger,
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
  const preloadedShipments = await loadTripManifestShipments(db, tripDocId);
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
      shipments: preloadedShipments,
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
