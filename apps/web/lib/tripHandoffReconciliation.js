import { adminDb } from "@/lib/firebase-admin";
import { evaluateTripLifecycleAfterReconciliation } from "@/app/utility/tripLifecycle";

const toNumber = (value, fallback = 0) => {
  const num = Number(value);
  return Number.isFinite(num) && num >= 0 ? num : fallback;
};

async function buildReconciliationRow(tripRef, tripId, item, shipmentDocId) {
  if (!shipmentDocId) return null;

  const [tripShipmentSnap, shipmentSnap] = await Promise.all([
    tripRef.collection("trip_shipments").doc(shipmentDocId).get(),
    adminDb.collection("shipments").doc(shipmentDocId).get(),
  ]);

  const tripShipment = tripShipmentSnap.data() || {};
  const shipment = shipmentSnap.data() || {};
  const expectedCount = toNumber(
    item?.loadedCount ??
      item?.totalCount ??
      tripShipment.totalItems ??
      shipment.totals?.totalContentQty,
    0,
  );
  const remainingLoaded = toNumber(tripShipment.loadedCount, 0);
  const unloadedCount = Math.max(expectedCount - remainingLoaded, 0);
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
