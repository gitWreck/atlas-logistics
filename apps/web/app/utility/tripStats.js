import { calculateProgress } from "./utilities";

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

function resolveShipmentExpectedTotal(shipment = {}) {
  const barcodeCount = Array.isArray(shipment.packageBarcodes)
    ? shipment.packageBarcodes.length
    : 0;
  return Math.max(
    clampCount(shipment.totalItems),
    barcodeCount > 0 ? barcodeCount : 0,
  );
}

function aggregateFromTripShipments(shipments = []) {
  return shipments.reduce(
    (acc, shipment) => {
      const total = resolveShipmentExpectedTotal(shipment);
      const loaded = clampCount(shipment.loadedCount);
      const received = clampCount(
        shipment.deliveredCount ?? shipment.receivedCount,
      );
      const shipmentStatus = String(shipment.status || "").toUpperCase();

      acc.total += total;
      acc.loaded += loaded;
      acc.received += received;
      acc.pending += clampCount(shipment.pendingCount);

      if (DELIVERED_TRIP_SHIPMENT_STATUSES.has(shipmentStatus)) {
        acc.deliveredShipments += 1;
      }

      if (total > 0 && received >= total) {
        acc.hubReceivedShipments += 1;
      }

      return acc;
    },
    {
      total: 0,
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

/**
 * Returns phase-aware trip stats for the trip board (e.g. "2/3 Loaded", "1/3 Delivered").
 */
export function getTripStatsDisplay(trip) {
  const status = String(trip?.status || "").toUpperCase();
  const tripType = String(trip?.tripType || "HUB_TRANSFER").toUpperCase();
  const isDelivery = tripType === "DELIVERY";

  let total = clampCount(trip?.totalItems);
  let loaded = clampCount(trip?.totalLoaded);
  let received = clampCount(trip?.totalDelivered);
  let arrived = clampCount(trip?.totalArrived);
  let deliveredShipments = 0;
  let hubReceivedShipments = 0;
  const shipmentCount = Array.isArray(trip?.shipments)
    ? trip.shipments.length
    : 0;

  if (shipmentCount > 0) {
    const agg = aggregateFromTripShipments(trip.shipments);
    if (agg.total > 0) total = agg.total;
    loaded = agg.loaded;
    received = Math.max(agg.received, received);
    deliveredShipments = agg.deliveredShipments;
    hubReceivedShipments = agg.hubReceivedShipments;
  }

  const processedAtHub = Math.max(received, arrived);

  if (status === "COMPLETED") {
    const processed = Math.max(processedAtHub, received, loaded);
    // Counters are often zeroed after trip completion; show full total when done.
    const count = total > 0 ? total : processed;
    return {
      count,
      total: total > 0 ? total : Math.max(total, processed),
      label: "Completed",
    };
  }

  if (status === "DELIVERED") {
    const processed = Math.max(processedAtHub, loaded);
    const count = total > 0 ? total : processed;
    return {
      count,
      total: total > 0 ? total : Math.max(total, processed),
      label: isDelivery ? "Delivered" : "Completed",
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
    };
  }

  if (["IN_TRANSIT", "LOADED"].includes(status)) {
    return {
      count: total > 0 ? Math.min(loaded, total) : loaded,
      total,
      label: "Loaded",
    };
  }

  return {
    count: total > 0 ? Math.min(loaded, total) : loaded,
    total,
    label: total <= 0 && loaded <= 0 ? "Awaiting" : "Loaded",
  };
}

/**
 * Trip board progress bar — uses actual load counts during the loading phase.
 * Empty trips (0/0) must show 0%, not a fixed status milestone like 40%.
 */
export function calculateTripProgress(trip) {
  const status = String(trip?.status || "").toUpperCase();
  const stats = getTripStatsDisplay(trip);
  const total = clampCount(stats.total);
  const loaded = clampCount(stats.count);

  if (LOADING_PHASE_TRIP_STATUSES.has(status)) {
    if (total <= 0) return 0;
    const ratio = Math.min(loaded / total, 1);
    return Math.round(ratio * LOADING_PHASE_PROGRESS_CAP);
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
