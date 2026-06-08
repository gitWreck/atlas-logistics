import { calculateProgress } from "./utilities";
import {
  MANIFEST_STATUS,
  resolveManifestStatus,
} from "./manifestStatus";

function clampCount(value) {
  return Math.max(0, Number(value) || 0);
}

const LOADING_PHASE_TRIP_STATUSES = new Set([
  "CREATED",
  "ASSIGNED",
  "LOADING",
  "PARTIALLY_LOADED",
]);

/** Max progress while cargo is still being loaded at origin (before IN_TRANSIT). */
const LOADING_PHASE_PROGRESS_CAP = 60;

const DELIVERED_TRIP_SHIPMENT_STATUSES = new Set([
  "COMPLETED",
  "DELIVERED",
  "DELIVERED_COMPLETE",
]);

const ON_TRUCK_PIECE_STATUSES = new Set([
  "LOADED",
  "LOADED_TO_TRIP",
  "IN_TRANSIT",
  "PARTIALLY_LOADED",
  "OUT_FOR_DELIVERY",
]);

/**
 * Full shipment piece count (all labels on the master shipment).
 * Used only for per-shipment manifest rows (e.g. 1/5), not trip totals.
 */
export function resolveShipmentFullPieceTotal(shipment = {}) {
  const barcodeCount = Array.isArray(shipment.packageBarcodes)
    ? shipment.packageBarcodes.length
    : 0;
  return Math.max(
    clampCount(shipment.totals?.totalContentQty),
    clampCount(shipment.shipmentPieceTotal),
    clampCount(shipment.totalItems),
    barcodeCount > 0 ? barcodeCount : 0,
  );
}

/**
 * Pieces actually on this trip (scanned onto the truck), not warehouse remainders.
 */
export function resolveTripScopedPieceTotal(shipment = {}) {
  const loaded = clampCount(shipment.loadedCount);
  const received = clampCount(
    shipment.deliveredCount ?? shipment.receivedCount,
  );
  const missing = clampCount(shipment.missingCount);
  const damaged = clampCount(shipment.damagedCount);
  const onTrip = loaded + received + missing + damaged;

  const tripBarcodeCount = Array.isArray(shipment.packageBarcodes)
    ? shipment.packageBarcodes.filter(Boolean).length
    : 0;
  const onTripQty = Math.max(onTrip, loaded);

  if (tripBarcodeCount > 0) {
    if (onTripQty > 0 && tripBarcodeCount > onTripQty) {
      return onTripQty;
    }
    return Math.max(onTripQty, tripBarcodeCount);
  }

  if (onTrip > 0) return onTrip;

  const storedTotal = clampCount(shipment.totalItems);
  const fullShipmentTotal = resolveShipmentFullPieceTotal(shipment);

  // Legacy rows: totalItems may equal full shipment while only part was loaded.
  if (storedTotal > 0 && fullShipmentTotal > storedTotal && loaded > 0) {
    return Math.max(loaded, onTrip);
  }
  if (storedTotal > 0 && loaded > 0 && storedTotal > loaded + received) {
    return Math.max(loaded, onTrip);
  }

  return storedTotal > 0 ? storedTotal : loaded;
}

function aggregateFromTripShipments(shipments = []) {
  return shipments.reduce(
    (acc, shipment) => {
      const tripScopedTotal = resolveTripScopedPieceTotal(shipment);
      const loaded = clampCount(shipment.loadedCount);
      const received = clampCount(
        shipment.deliveredCount ?? shipment.receivedCount,
      );
      const shipmentStatus = String(shipment.status || "").toUpperCase();

      acc.tripPieceTotal += tripScopedTotal;
      acc.loaded += loaded;
      acc.received += received;
      acc.pending += clampCount(shipment.pendingCount);

      if (DELIVERED_TRIP_SHIPMENT_STATUSES.has(shipmentStatus)) {
        acc.deliveredShipments += 1;
      }

      if (tripScopedTotal > 0 && received >= tripScopedTotal) {
        acc.hubReceivedShipments += 1;
      }

      return acc;
    },
    {
      tripPieceTotal: 0,
      loaded: 0,
      received: 0,
      pending: 0,
      deliveredShipments: 0,
      hubReceivedShipments: 0,
    },
  );
}

function isFullyProcessed(count, total) {
  return total > 0 && count >= total;
}

function resolveArrivedPhaseLabel({
  isDelivery,
  count,
  total,
  deliveredShipments,
  hubReceivedShipments,
  shipmentCount,
}) {
  const allDelivered = shipmentCount > 0 && deliveredShipments >= shipmentCount;
  const allReceivedAtHub =
    shipmentCount > 0 && hubReceivedShipments >= shipmentCount;

  if (allDelivered || (isDelivery && isFullyProcessed(count, total))) {
    return "Delivered";
  }

  if (allReceivedAtHub || isFullyProcessed(count, total)) {
    return isDelivery ? "Delivered" : "Received";
  }

  return isDelivery ? "Delivered" : "Received";
}

function resolveTripTotals(trip = {}) {
  const shipments = Array.isArray(trip?.shipments) ? trip.shipments : [];
  const shipmentCount = shipments.length;

  let loaded = clampCount(trip?.totalLoaded);
  let tripPieceTotal = clampCount(trip?.totalItems);
  let received = clampCount(trip?.totalDelivered);
  let arrived = clampCount(trip?.totalArrived);
  let deliveredShipments = 0;
  let hubReceivedShipments = 0;

  if (shipmentCount > 0) {
    const agg = aggregateFromTripShipments(shipments);
    loaded = agg.loaded;
    received = Math.max(agg.received, received);
    deliveredShipments = agg.deliveredShipments;
    hubReceivedShipments = agg.hubReceivedShipments;
    tripPieceTotal = Math.max(agg.tripPieceTotal, loaded);
  } else {
    tripPieceTotal = Math.max(tripPieceTotal, loaded);
    const status = String(trip?.status || "").toUpperCase();
    if (
      loaded > 0 &&
      tripPieceTotal > loaded &&
      (trip?.manifestLocked ||
        ["IN_TRANSIT", "LOADED", "ARRIVED", "COMPLETED", "DELIVERED"].includes(
          status,
        ))
    ) {
      tripPieceTotal = loaded;
    }
  }

  return {
    loaded,
    tripPieceTotal,
    received,
    arrived,
    shipmentCount,
    deliveredShipments,
    hubReceivedShipments,
  };
}

/**
 * Trip-level package + shipment counts for statistics panels.
 * loadedPackages = labels on truck; tripPackageTotal = same scope (not warehouse remainders).
 */
export function getTripPackageStats(trip = {}) {
  const totals = resolveTripTotals(trip);
  const loadedPackages = totals.loaded;
  const tripPackageTotal = Math.max(totals.tripPieceTotal, loadedPackages);

  return {
    loadedPackages,
    tripPackageTotal,
    shipmentCount: totals.shipmentCount,
    displayLoaded:
      tripPackageTotal > 0
        ? `${loadedPackages}/${tripPackageTotal}`
        : `${loadedPackages}`,
  };
}

function resolveRemainingWarehousePieces(shipments = []) {
  return shipments.reduce((sum, shipment) => {
    const fullTotal = resolveShipmentFullPieceTotal(shipment);
    const loaded = clampCount(shipment.loadedCount);
    const received = clampCount(
      shipment.deliveredCount ?? shipment.receivedCount,
    );
    return sum + Math.max(fullTotal - loaded - received, 0);
  }, 0);
}

export function getTripLoadStatusHint(trip = {}) {
  const status = String(trip?.status || "").toUpperCase();
  const manifestStatus = resolveManifestStatus(trip);

  if (manifestStatus === MANIFEST_STATUS.RECONCILED) {
    return "Manifest reconciled. Release shipments when ready.";
  }
  if (manifestStatus === MANIFEST_STATUS.RECEIVING_IN_PROGRESS) {
    return "Receiving in progress at destination hub.";
  }
  if (manifestStatus === MANIFEST_STATUS.LOCKED) {
    return status === "IN_TRANSIT"
      ? "Manifest is locked. Trip is in transit."
      : "Manifest is locked. Start receiving at destination when arrived.";
  }
  if (["LOADING", "CREATED", "ASSIGNED", "PARTIALLY_LOADED"].includes(status)) {
    return "Manifest is open. Loading in progress.";
  }
  if (status === "LOADED") {
    return "Trip is loaded. Lock manifest before dispatch.";
  }
  if (status === "IN_TRANSIT") {
    return "Trip is in transit to destination hub.";
  }
  if (status === "ARRIVED") {
    return "Trip has arrived. Unload and reconcile at hub.";
  }
  return `Trip status: ${status || "unknown"}`;
}

/**
 * Active trip drawer — packages on truck vs warehouse remainders vs shipment count.
 */
export function aggregateTripLoadSummary(trip = {}, shipments = []) {
  const tripWithShipments =
    Array.isArray(shipments) && shipments.length > 0
      ? { ...trip, shipments }
      : trip;
  const packageStats = getTripPackageStats(tripWithShipments);
  const remainingInWarehouse = resolveRemainingWarehousePieces(shipments);
  const originWarehouse =
    trip?.origin || trip?.originName || "origin warehouse";

  return {
    loadedPackages: packageStats.loadedPackages,
    tripPackageTotal: packageStats.tripPackageTotal,
    trackingNumbers:
      packageStats.shipmentCount ||
      (Array.isArray(shipments) ? shipments.length : 0),
    remainingInWarehouse,
    tripStatus: String(trip?.status || "UNKNOWN").toUpperCase(),
    manifestStatus: resolveManifestStatus(trip),
    statusHint: getTripLoadStatusHint(trip),
    originWarehouse,
    loadedSummaryLine: `${packageStats.loadedPackages} pieces loaded across ${packageStats.shipmentCount || shipments.length} shipments`,
    remainingSummaryLine:
      remainingInWarehouse > 0
        ? `${remainingInWarehouse} pieces remain in ${originWarehouse} warehouse for next trip`
        : null,
  };
}

/**
 * Returns phase-aware trip stats for the trip board (e.g. "376/376 Loaded").
 */
export function getTripStatsDisplay(trip) {
  const status = String(trip?.status || "").toUpperCase();
  const tripType = String(trip?.tripType || "HUB_TRANSFER").toUpperCase();
  const isDelivery = tripType === "DELIVERY";

  const {
    loaded,
    tripPieceTotal,
    received,
    arrived,
    shipmentCount,
    deliveredShipments,
    hubReceivedShipments,
  } = resolveTripTotals(trip);

  const total = Math.max(tripPieceTotal, loaded);
  const processedAtHub = Math.max(received, arrived);

  if (status === "COMPLETED") {
    const processed = Math.max(processedAtHub, received, loaded);
    const count = total > 0 ? Math.min(Math.max(processed, loaded), total) : processed;
    return {
      count,
      total: total > 0 ? total : Math.max(total, processed),
      label: "Completed",
      shipmentCount,
    };
  }

  if (status === "DELIVERED") {
    const processed = Math.max(processedAtHub, loaded);
    const count = total > 0 ? Math.min(Math.max(processed, loaded), total) : processed;
    return {
      count,
      total: total > 0 ? total : Math.max(total, processed),
      label: isDelivery ? "Delivered" : "Completed",
      shipmentCount,
    };
  }

  if (["ARRIVED", "UNLOADING"].includes(status)) {
    const count = total > 0 ? Math.min(processedAtHub, total) : processedAtHub;
    const manifestStatus = String(trip.manifestStatus || "").toUpperCase();
    const isReceiving =
      status === "UNLOADING" ||
      manifestStatus === "RECEIVING_IN_PROGRESS" ||
      (trip.receivingStartedAt && !trip.reconciledAt);

    if (isReceiving && !isDelivery) {
      return {
        count,
        total,
        label: "Receiving",
        shipmentCount,
      };
    }

    return {
      count,
      total,
      label: resolveArrivedPhaseLabel({
        isDelivery,
        count,
        total,
        deliveredShipments,
        hubReceivedShipments,
        shipmentCount,
      }),
      shipmentCount,
    };
  }

  if (["READY_FOR_DELIVERY", "OUT_FOR_DELIVERY"].includes(status)) {
    const count = total > 0 ? Math.min(processedAtHub, total) : processedAtHub;

    return {
      count,
      total,
      label: resolveArrivedPhaseLabel({
        isDelivery,
        count,
        total,
        deliveredShipments,
        hubReceivedShipments,
        shipmentCount,
      }),
      shipmentCount,
    };
  }

  if (["IN_TRANSIT", "LOADED"].includes(status)) {
    return {
      count: total > 0 ? Math.min(loaded, total) : loaded,
      total,
      label: "Loaded",
      shipmentCount,
    };
  }

  return {
    count: total > 0 ? Math.min(loaded, total) : loaded,
    total,
    label: total <= 0 && loaded <= 0 ? "Awaiting" : "Loaded",
    shipmentCount,
  };
}

/**
 * Trip board progress bar — uses actual load counts during the loading phase.
 */
export function calculateTripProgress(trip) {
  const status = String(trip?.status || "").toUpperCase();
  const stats = getTripStatsDisplay(trip);
  const total = clampCount(stats.total);
  const loaded = clampCount(stats.count);

  if (LOADING_PHASE_TRIP_STATUSES.has(status)) {
    if (total <= 0) return loaded > 0 ? 1 : 0;
    const ratio = Math.min(loaded / total, 1);
    return Math.round(ratio * LOADING_PHASE_PROGRESS_CAP);
  }

  if (["IN_TRANSIT", "LOADED"].includes(status) && total > 0 && loaded >= total) {
    return LOADING_PHASE_PROGRESS_CAP;
  }

  return calculateProgress(status);
}

export function isTripAwaitingLoading(trip) {
  const status = String(trip?.status || "").toUpperCase();
  const stats = getTripStatsDisplay(trip);
  return (
    LOADING_PHASE_TRIP_STATUSES.has(status) &&
    stats.total <= 0 &&
    stats.count <= 0
  );
}

export function getTripBoardStatusLabel(trip) {
  const status = String(trip?.status || "").toUpperCase();

  if (isTripAwaitingLoading(trip)) {
    return "Awaiting Loading";
  }

  if (LOADING_PHASE_TRIP_STATUSES.has(status)) {
    const stats = getTripStatsDisplay(trip);
    const loaded = clampCount(stats.count);
    const total = clampCount(stats.total);

    if (loaded > 0) {
      if (total > 0 && loaded >= total) return "Loaded";
      return "Loading";
    }
  }

  if (status === "UNLOADING") return "ARRIVED";
  return trip?.status || status;
}

/** Hub transfer drawer timeline — empty trips stay on Awaiting Loading, not Loading. */
export function resolveHubTripTimelineStep(trip) {
  const status = String(trip?.status || "").toUpperCase();
  if (status === "UNLOADING") return "ARRIVED";
  if (isTripAwaitingLoading(trip)) return "AWAITING_LOADING";
  if (LOADING_PHASE_TRIP_STATUSES.has(status)) return "LOADING";
  return status;
}
