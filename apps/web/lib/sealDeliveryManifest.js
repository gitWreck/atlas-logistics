import crypto from "crypto";
import { adminDb } from "@/lib/firebase-admin";
import { buildDeliveryManifestShipments } from "@/lib/deliveryManifestLedger";
import { loadTripManifestShipments } from "@/lib/tripManifestShipments";

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

function stableStringify(value) {
  return JSON.stringify(value, Object.keys(value).sort());
}

function pieceQty(pkg = {}) {
  const qty = Number(pkg.quantity);
  return Number.isFinite(qty) && qty > 0 ? qty : 1;
}

function aggregateDeliveryStats(shipments = [], shippingTotals = null) {
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
    const hasPod =
      (Array.isArray(shipment.proofOfDelivery) && shipment.proofOfDelivery.length > 0) ||
      (typeof shipment.proofOfDelivery === "string" && shipment.proofOfDelivery.trim());

    packages.forEach((pkg) => {
      const qty = pieceQty(pkg);
      const status = String(pkg.status || "").toUpperCase();

      if (
        HUB_RECEIVED_STATUSES.has(status) ||
        pkg.hubReceivedAt ||
        Number(pkg.receivedQty) > 0
      ) {
        stats.totalReceived += qty;
      }
      if (status === "DELIVERED" || status === "COMPLETED") {
        stats.totalDelivered += qty;
        if (pkg.proofPhotoUrl || pkg.podPhotoUrl || hasPod) {
          stats.podCaptured += qty;
        }
      } else if (status === "FAILED_DELIVERY") {
        stats.totalFailed += qty;
      } else if (
        ["RETURNED_TO_WAREHOUSE", "RETURNED_RECEIVED_AT_HUB", "RETURNED_RECEIVED_AT_ODIONGAN"].includes(
          status,
        )
      ) {
        stats.totalReturned += qty;
      }
    });
  });

  if (stats.totalReceived === 0 && shippingTotals?.totalItems) {
    stats.totalReceived = Number(shippingTotals.totalItems);
  }

  return stats;
}

export async function ensureDeliveryManifestSealed(tripDocId) {
  const tripRef = adminDb.collection("truck_trips").doc(tripDocId);
  const tripSnap = await tripRef.get();
  if (!tripSnap.exists) return null;

  const trip = tripSnap.data() || {};
  const status = String(trip.status || "").toUpperCase();

  if (trip.deliveryManifestId) return trip.deliveryManifestId;
  if (!["COMPLETED", "DELIVERED"].includes(status)) return null;

  let shippingTotals = null;
  if (trip.manifestId) {
    const manifestSnap = await adminDb.collection("manifests").doc(trip.manifestId).get();
    if (manifestSnap.exists) shippingTotals = manifestSnap.data()?.totals || null;
  }

  const shipments = await loadTripManifestShipments(adminDb, tripDocId);
  const stats = aggregateDeliveryStats(shipments, shippingTotals);
  const completedAtMs = Date.now();
  const manifestId = `DELIVERY-MANIFEST-${tripDocId}-${completedAtMs}`;
  const shipmentLedger = buildDeliveryManifestShipments(shipments);

  const payload = {
    manifestId,
    type: "DELIVERY",
    tripId: tripDocId,
    tripCode: trip.tripId || tripDocId,
    status: "COMPLETED",
    version: DELIVERY_MANIFEST_VERSION,
    shippingManifestId: trip.manifestId || null,
    shippingManifestReference: trip.manifestId || null,
    shippingManifestHash: trip.manifestHash || null,
    trip: {
      tripCode: trip.tripId || null,
      origin: trip.origin || null,
      destination: trip.destination || null,
      route: trip.route || null,
      deliveryHub: trip.destination || "Odiongan Hub",
    },
    meta: {
      completedAtMs,
      completedBy: trip.lastUpdatedBy || trip.autoCompletedBy || null,
      completedByName: trip.updatedBy || "System",
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

  const hash = crypto.createHash("sha256").update(stableStringify(payload)).digest("hex");
  const now = new Date();

  await adminDb.collection("manifests").doc(manifestId).set({
    ...payload,
    hash,
    createdAt: now,
    pdfUrl: null,
  });

  await tripRef.update({
    deliveryManifestId: manifestId,
    deliveryManifestHash: hash,
    deliveryManifestVersion: DELIVERY_MANIFEST_VERSION,
    deliveryManifestCompletedAt: now,
    deliveryManifestCompletedBy: trip.lastUpdatedBy || trip.autoCompletedBy || null,
  });

  return manifestId;
}
