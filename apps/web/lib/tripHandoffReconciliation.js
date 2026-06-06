import { adminDb } from "@/lib/firebase-admin";
import { evaluateTripLifecycleAfterReconciliation } from "@/app/utility/tripLifecycle";

const toNumber = (value, fallback = 0) => {
  const num = Number(value);
  return Number.isFinite(num) && num >= 0 ? num : fallback;
};

const ON_TRUCK_PIECE_STATUSES = new Set([
  "LOADED",
  "LOADED_TO_TRIP",
  "IN_TRANSIT",
  "PARTIALLY_LOADED",
  "OUT_FOR_DELIVERY",
]);

const UNLOADED_AT_HUB_PIECE_STATUSES = new Set([
  "ARRIVED_AT_ODIONGAN",
  "AVAILABLE_AT_ODIONGAN_WAREHOUSE",
  "RELEASED_FOR_DELIVERY",
  "RECEIVED_AT_DIVISORIA",
  "RECEIVED",
  "AVAILABLE_AT_WAREHOUSE",
]);

function pieceQuantity(pkg = {}) {
  const qty = Number(pkg.quantity);
  return Number.isFinite(qty) && qty > 0 ? qty : 1;
}

function countPiecesByStatus(packages = [], statusSet) {
  return packages.reduce((sum, pkg) => {
    const status = String(pkg.status || "").toUpperCase();
    return statusSet.has(status) ? sum + pieceQuantity(pkg) : sum;
  }, 0);
}

function resolveExpectedPieceCount(item = {}, tripShipment = {}, shipment = {}) {
  const tripTotal = toNumber(tripShipment.totalItems, 0);
  if (tripTotal > 0) return tripTotal;

  const manifestLoaded = toNumber(item.loadedCount, -1);
  if (manifestLoaded > 0) return manifestLoaded;

  const tripLoaded = toNumber(tripShipment.loadedCount, 0);
  const tripReceived = toNumber(
    tripShipment.receivedCount ?? tripShipment.deliveredCount,
    0,
  );
  const tripDerivedTotal = tripLoaded + tripReceived;
  if (tripDerivedTotal > 0) return tripDerivedTotal;

  const packages = Array.isArray(shipment.packages) ? shipment.packages : [];
  const onTruck = countPiecesByStatus(packages, ON_TRUCK_PIECE_STATUSES);
  const atHub = countPiecesByStatus(packages, UNLOADED_AT_HUB_PIECE_STATUSES);
  if (onTruck + atHub > 0) return onTruck + atHub;

  const manifestTotal = toNumber(item.totalCount, 0);
  if (manifestTotal > 0) return manifestTotal;

  return toNumber(
    shipment.totals?.totalContentQty ?? shipment.totals?.totalItems,
    0,
  );
}

async function buildReconciliationRow(tripRef, tripId, item, shipmentDocId) {
  if (!shipmentDocId) return null;

  const [tripShipmentSnap, shipmentSnap] = await Promise.all([
    tripRef.collection("trip_shipments").doc(shipmentDocId).get(),
    adminDb.collection("shipments").doc(shipmentDocId).get(),
  ]);

  const tripShipment = tripShipmentSnap.data() || {};
  const shipment = shipmentSnap.data() || {};
  const expectedCount = resolveExpectedPieceCount(item, tripShipment, shipment);
  const remainingLoaded = toNumber(tripShipment.loadedCount, 0);
  const receivedAtHub = toNumber(
    tripShipment.receivedCount ?? tripShipment.deliveredCount,
    0,
  );
  const unloadedCount =
    receivedAtHub > 0
      ? Math.min(
          receivedAtHub,
          expectedCount > 0 ? expectedCount : receivedAtHub,
        )
      : Math.max(expectedCount - remainingLoaded, 0);
  const isMissing = remainingLoaded > 0 || !tripShipmentSnap.exists;

  return {
    id: shipmentDocId,
    shipmentId: shipment.shipmentId || item?.shipmentId || shipmentDocId,
    recipientName:
      shipment.recipient?.name || item?.receiverName || "Unknown recipient",
    destination:
      shipment.recipient?.city ||
      shipment.destination ||
      shipment.destinationCode ||
      "Unknown destination",
    expectedCount,
    unloadedCount,
    remainingLoaded,
    missing: isMissing,
    currentTripId: shipment.currentTripId || tripId,
    status: shipment.status || tripShipment.status || null,
  };
}

async function reconcileFromLockedManifest(tripRef, tripId, manifestId) {
  const manifestSnap = await adminDb.collection("manifests").doc(manifestId).get();

  if (!manifestSnap.exists) {
    return { error: "Manifest not found", status: 404 };
  }

  const manifest = manifestSnap.data() || {};
  const manifestShipments = Array.isArray(manifest.shipments)
    ? manifest.shipments
    : [];

  const rows = await Promise.all(
    manifestShipments.map((item) => {
      const shipmentDocId =
        item.trackingShipmentId || item.shipmentId || item.id || null;
      return buildReconciliationRow(tripRef, tripId, item, shipmentDocId);
    }),
  );

  return {
    manifestId,
    source: "locked_manifest",
    shipments: rows.filter(Boolean),
  };
}

async function reconcileFromTripShipments(tripRef, tripId) {
  const tripShipmentSnap = await tripRef.collection("trip_shipments").get();

  if (tripShipmentSnap.empty) {
    return {
      error:
        "Trip has no shipments to reconcile. Add shipments to the trip manifest first.",
      status: 400,
    };
  }

  const rows = await Promise.all(
    tripShipmentSnap.docs.map((docSnap) => {
      const data = docSnap.data() || {};
      const shipmentDocId =
        data.trackingShipmentId || docSnap.id || data.shipmentId || null;
      return buildReconciliationRow(tripRef, tripId, data, shipmentDocId);
    }),
  );

  return {
    manifestId: null,
    source: "trip_shipments",
    shipments: rows.filter(Boolean),
  };
}

/**
 * Load trip + manifest rows and evaluate lifecycle (Step 1.1).
 */
export async function runTripHandoffReconciliation(tripId) {
  const tripRef = adminDb.collection("truck_trips").doc(tripId);
  const tripSnap = await tripRef.get();

  if (!tripSnap.exists) {
    return { error: "Trip not found", status: 404 };
  }

  const trip = { id: tripSnap.id, ...tripSnap.data() };
  const manifestId = trip.manifestId;

  let result = manifestId
    ? await reconcileFromLockedManifest(tripRef, tripId, manifestId)
    : await reconcileFromTripShipments(tripRef, tripId);

  if (result.error && manifestId) {
    const fallback = await reconcileFromTripShipments(tripRef, tripId);
    if (!fallback.error) result = fallback;
  }

  if (result.error) {
    return { error: result.error, status: result.status || 400 };
  }

  const shipments = result.shipments || [];
  const missingShipments = shipments.filter((item) => item.missing);
  const unloadedShipments = shipments.filter((item) => !item.missing);
  const lifecycleEval = evaluateTripLifecycleAfterReconciliation(trip, shipments);

  return {
    tripId,
    trip,
    manifestId: result.manifestId,
    source: result.source,
    tripStatus: trip.status || null,
    ready: lifecycleEval.reconciliation.ready,
    totals: {
      manifestShipments: lifecycleEval.reconciliation.manifestShipments,
      unloadedShipments: lifecycleEval.reconciliation.unloadedShipments,
      missingShipments: lifecycleEval.reconciliation.missingShipments,
      manifestPieces: lifecycleEval.reconciliation.manifestPieces,
      unloadedPieces: lifecycleEval.reconciliation.unloadedPieces,
      onTruckPieces: lifecycleEval.reconciliation.onTruckPieces,
    },
    lifecycle: {
      recommendedNextStatus: lifecycleEval.recommendedNextStatus,
      canPromoteToArrived: lifecycleEval.arrived.promote,
      promotionReason: lifecycleEval.arrived.reason,
      promotionMessage: lifecycleEval.arrived.message || null,
      canReleaseForDelivery: lifecycleEval.release.eligible,
      releaseBlockReason: lifecycleEval.release.reason || null,
    },
    lifecycleEval,
    shipments,
    unloadedShipments,
    missingShipments,
  };
}

export function formatHandoffReconciliationResponse(payload) {
  if (payload.error) return payload;

  return {
    tripId: payload.tripId,
    manifestId: payload.manifestId,
    source: payload.source,
    tripStatus: payload.tripStatus,
    ready: payload.ready,
    totals: payload.totals,
    lifecycle: payload.lifecycle,
    shipments: payload.shipments,
    unloadedShipments: payload.unloadedShipments,
    missingShipments: payload.missingShipments,
    promoted: payload.promoted || false,
    promotionSkippedReason: payload.promotionSkippedReason || null,
  };
}
