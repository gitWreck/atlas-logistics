/**
 * Trip lifecycle rules — web mirror of apps/functions/src/trips/tripLifecycle.js
 * Keep in sync when changing promotion rules (Step 1.1+).
 */

export const TRIP_STATUSES = Object.freeze({
  CREATED: "CREATED",
  ASSIGNED: "ASSIGNED",
  LOADING: "LOADING",
  LOADED: "LOADED",
  IN_TRANSIT: "IN_TRANSIT",
  ARRIVED: "ARRIVED",
  OUT_FOR_DELIVERY: "OUT_FOR_DELIVERY",
  COMPLETED: "COMPLETED",
  CANCELLED: "CANCELLED",
});

export const LINEHAUL_LIFECYCLE = Object.freeze([
  TRIP_STATUSES.CREATED,
  TRIP_STATUSES.ASSIGNED,
  TRIP_STATUSES.LOADING,
  TRIP_STATUSES.LOADED,
  TRIP_STATUSES.IN_TRANSIT,
  TRIP_STATUSES.ARRIVED,
  TRIP_STATUSES.COMPLETED,
]);

const TERMINAL_TRIP_STATUSES = new Set([
  TRIP_STATUSES.COMPLETED,
  TRIP_STATUSES.CANCELLED,
]);

const AUTO_PROMOTE_TO_ARRIVED_FROM = new Set([
  TRIP_STATUSES.LOADING,
  TRIP_STATUSES.LOADED,
  TRIP_STATUSES.IN_TRANSIT,
  TRIP_STATUSES.ARRIVED,
]);

const RELEASE_ELIGIBLE_TRIP_STATUSES = new Set([TRIP_STATUSES.ARRIVED]);

export function normalizeTripStatus(status) {
  return String(status || "").trim().toUpperCase();
}

export function evaluateReconciliationRows(rows = []) {
  const shipments = Array.isArray(rows) ? rows : [];
  const missingShipments = shipments.filter((row) => row.missing === true);
  const unloadedShipments = shipments.filter((row) => !row.missing);

  return {
    manifestShipments: shipments.length,
    unloadedShipments: unloadedShipments.length,
    missingShipments: missingShipments.length,
    ready: shipments.length > 0 && missingShipments.length === 0,
    missingShipmentIds: missingShipments
      .map((row) => row.id || row.shipmentId)
      .filter(Boolean),
    unloadedShipmentIds: unloadedShipments
      .map((row) => row.id || row.shipmentId)
      .filter(Boolean),
  };
}

export function shouldPromoteTripToArrived(trip = {}, reconciliationSummary = {}) {
  const currentStatus = normalizeTripStatus(trip.status);
  const ready = Boolean(reconciliationSummary.ready);

  if (!ready) {
    return {
      promote: false,
      reason: "RECONCILE_NOT_READY",
      currentStatus,
      nextStatus: null,
      message:
        "Manifest reconciliation is incomplete. Unload remaining pieces or add missing remarks.",
    };
  }

  if (TERMINAL_TRIP_STATUSES.has(currentStatus)) {
    return {
      promote: false,
      reason: "TRIP_TERMINAL",
      currentStatus,
      nextStatus: null,
    };
  }

  if (currentStatus === TRIP_STATUSES.ARRIVED) {
    return {
      promote: false,
      reason: "ALREADY_ARRIVED",
      currentStatus,
      nextStatus: TRIP_STATUSES.ARRIVED,
    };
  }

  if (!AUTO_PROMOTE_TO_ARRIVED_FROM.has(currentStatus)) {
    return {
      promote: false,
      reason: "INVALID_STATUS_FOR_ARRIVED",
      currentStatus,
      nextStatus: null,
    };
  }

  return {
    promote: true,
    reason: "RECONCILE_READY",
    currentStatus,
    nextStatus: TRIP_STATUSES.ARRIVED,
  };
}

export function isTripReleaseEligible(trip = {}, options = {}) {
  const { allowReconciledFallback = true } = options;
  const status = normalizeTripStatus(trip.status);

  if (RELEASE_ELIGIBLE_TRIP_STATUSES.has(status)) {
    return { eligible: true, reason: null };
  }

  if (
    allowReconciledFallback &&
    trip.reconciledAt &&
    [TRIP_STATUSES.IN_TRANSIT, TRIP_STATUSES.LOADED].includes(status)
  ) {
    return {
      eligible: false,
      reason:
        "Trip was reconciled but status is not ARRIVED yet. Refresh or complete reconciliation.",
    };
  }

  return {
    eligible: false,
    reason: `Release requires trip status ARRIVED (current: ${status || "unknown"}).`,
  };
}

export function evaluateTripLifecycleAfterReconciliation(trip = {}, reconciliationRows = []) {
  const reconciliation = evaluateReconciliationRows(reconciliationRows);
  const arrived = shouldPromoteTripToArrived(trip, reconciliation);
  const release = isTripReleaseEligible(trip);

  return {
    reconciliation,
    arrived,
    release,
    recommendedNextStatus: arrived.promote
      ? arrived.nextStatus
      : normalizeTripStatus(trip.status),
  };
}
