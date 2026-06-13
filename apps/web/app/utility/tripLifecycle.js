/**
 * Trip lifecycle rules — web mirror of apps/functions/src/trips/tripLifecycle.js
 * Keep in sync when changing promotion rules (Step 1.1+).
 */

import { canDeleteShipmentsAndTrips } from "./deletePermissions";

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

const AUTO_PROMOTE_TO_COMPLETED_FROM = new Set([
  TRIP_STATUSES.ARRIVED,
  TRIP_STATUSES.IN_TRANSIT,
  TRIP_STATUSES.OUT_FOR_DELIVERY,
  TRIP_STATUSES.LOADED,
  "UNLOADING",
]);

const DELIVERED_TRIP_SHIPMENT_STATUSES = new Set([
  "COMPLETED",
  "DELIVERED",
  "DELIVERED_COMPLETE",
]);

const RELEASE_ELIGIBLE_TRIP_STATUSES = new Set([TRIP_STATUSES.ARRIVED]);

function toNumber(value, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) && num >= 0 ? num : fallback;
}

function hasTripScopedCargo(row = {}) {
  const barcodeCount = (row.packageBarcodes || []).filter(Boolean).length;
  if (barcodeCount > 0) return true;
  if (toNumber(row.loadedCount, 0) > 0) return true;
  if (toNumber(row.receivedCount ?? row.deliveredCount, 0) > 0) return true;
  if (toNumber(row.missingCount, 0) > 0) return true;
  if (toNumber(row.damagedCount, 0) > 0) return true;
  return false;
}

export function isTripShipmentDelivered(row = {}) {
  if (!hasTripScopedCargo(row)) return true;

  const loadedCount = toNumber(row.loadedCount, 0);
  if (loadedCount > 0) return false;

  if (row.allTripScopedPackagesDelivered === true) return true;

  const tripScopedTotal = toNumber(row.tripScopedTotal, 0);
  const tripScopedDelivered = toNumber(row.tripScopedDelivered, 0);
  if (tripScopedTotal > 0 && tripScopedDelivered >= tripScopedTotal) {
    return true;
  }

  const totalItems = toNumber(row.totalItems, 0);
  if (totalItems <= 0) return false;

  const status = normalizeTripStatus(row.status);
  if (DELIVERED_TRIP_SHIPMENT_STATUSES.has(status)) return true;

  return false;
}

export function shouldPromoteTripToCompleted(trip = {}, tripShipmentRows = []) {
  const currentStatus = normalizeTripStatus(trip.status);
  const rows = Array.isArray(tripShipmentRows) ? tripShipmentRows : [];

  if (currentStatus === TRIP_STATUSES.COMPLETED) {
    return {
      promote: false,
      reason: "ALREADY_COMPLETED",
      currentStatus,
      nextStatus: TRIP_STATUSES.COMPLETED,
    };
  }

  if (!AUTO_PROMOTE_TO_COMPLETED_FROM.has(currentStatus)) {
    return {
      promote: false,
      reason: "INVALID_STATUS_FOR_COMPLETED",
      currentStatus,
      nextStatus: null,
    };
  }

  if (rows.length === 0) {
    return {
      promote: false,
      reason: "NO_TRIP_SHIPMENTS",
      currentStatus,
      nextStatus: null,
    };
  }

  const incompleteRows = rows.filter((row) => !isTripShipmentDelivered(row));

  if (incompleteRows.length > 0) {
    return {
      promote: false,
      reason: "SHIPMENTS_NOT_ALL_DELIVERED",
      currentStatus,
      nextStatus: null,
      incompleteShipmentCount: incompleteRows.length,
    };
  }

  return {
    promote: true,
    reason: "ALL_SHIPMENTS_DELIVERED",
    currentStatus,
    nextStatus: TRIP_STATUSES.COMPLETED,
  };
}

export function normalizeTripStatus(status) {
  return String(status || "").trim().toUpperCase();
}

function toPieceCount(value) {
  const num = Number(value);
  return Number.isFinite(num) && num >= 0 ? num : 0;
}

export function evaluateReconciliationRows(rows = []) {
  const shipments = Array.isArray(rows) ? rows : [];
  const missingShipments = shipments.filter((row) => row.missing === true);
  const unloadedShipments = shipments.filter((row) => !row.missing);
  const manifestPieces = shipments.reduce(
    (sum, row) => sum + toPieceCount(row.expectedCount),
    0,
  );
  const unloadedPieces = shipments.reduce(
    (sum, row) => sum + toPieceCount(row.unloadedCount),
    0,
  );
  const onTruckPieces = shipments.reduce(
    (sum, row) => sum + toPieceCount(row.remainingLoaded),
    0,
  );
  const missingPieces = Math.max(manifestPieces - unloadedPieces, 0);

  return {
    manifestShipments: shipments.length,
    unloadedShipments: unloadedShipments.length,
    missingShipments: missingShipments.length,
    manifestPieces,
    unloadedPieces,
    onTruckPieces,
    missingPieces,
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
  const isHubTransfer =
    String(trip.tripType || "HUB_TRANSFER").toUpperCase() === "HUB_TRANSFER";
  const manifestStatus = String(trip.manifestStatus || "").toUpperCase();

  if (RELEASE_ELIGIBLE_TRIP_STATUSES.has(status)) {
    if (
      isHubTransfer &&
      manifestStatus !== "RECONCILED" &&
      !trip.reconciledAt
    ) {
      return {
        eligible: false,
        reason:
          "Manifest must be reconciled before releasing to delivery operations.",
      };
    }
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

// Trip board admin lifecycle (cancel / archive / audit)
export function canManageTripLifecycle(profile, user = null) {
  return canDeleteShipmentsAndTrips(profile, user);
}

export function canViewTripAuditLog(profile, user = null) {
  return canDeleteShipmentsAndTrips(profile, user);
}

export function canCancelTrip(trip = {}) {
  if (trip.archived === true) return false;
  const status = String(trip.status || "").toUpperCase();
  return !["COMPLETED", "DELIVERED", "CANCELLED"].includes(status);
}

export function canArchiveTrip(trip = {}) {
  if (trip.archived === true) return false;
  const status = String(trip.status || "").toUpperCase();
  return (
    ["COMPLETED", "DELIVERED", "CANCELLED"].includes(status) ||
    trip.active === false
  );
}
