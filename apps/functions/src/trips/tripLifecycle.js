"use strict";

/**
 * Trip lifecycle rules (Step 1.1 — Master Tracking fix plan).
 *
 * Linehaul target flow:
 *   CREATED → ASSIGNED → LOADING → LOADED → IN_TRANSIT → ARRIVED → COMPLETED
 *
 * Automatic promotions (Steps 1.2+):
 *   - ARRIVED: reconciliation ready (all manifest rows accounted at Odiongan)
 *   - COMPLETED: when every manifest shipment is fully delivered (not hub unload)
 */

const TRIP_STATUSES = Object.freeze({
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

/** Ordered linehaul lifecycle (client doc §1). */
const LINEHAUL_LIFECYCLE = Object.freeze([
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

/** Statuses that may auto-promote to ARRIVED after successful reconcile. */
const AUTO_PROMOTE_TO_ARRIVED_FROM = new Set([
  TRIP_STATUSES.LOADING,
  TRIP_STATUSES.LOADED,
  TRIP_STATUSES.IN_TRANSIT,
  TRIP_STATUSES.ARRIVED,
]);

/** Statuses that may auto-promote to COMPLETED when all shipments are delivered. */
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

/** Trip statuses that allow last-mile pool release (Step 1.4). */
const RELEASE_ELIGIBLE_TRIP_STATUSES = new Set([TRIP_STATUSES.ARRIVED]);

const {
  MANIFEST_STATUS,
  isHubTransferTrip,
  resolveManifestStatus,
} = require("./manifestStatus");

function normalizeTripStatus(status) {
  return String(status || "")
    .trim()
    .toUpperCase();
}

function lifecycleIndex(status) {
  const normalized = normalizeTripStatus(status);
  const index = LINEHAUL_LIFECYCLE.indexOf(normalized);
  return index >= 0 ? index : -1;
}

/**
 * Whether a manual/auto transition from → to is allowed (forward-only on linehaul chain).
 */
function isAllowedTripTransition(fromStatus, toStatus) {
  const from = normalizeTripStatus(fromStatus);
  const to = normalizeTripStatus(toStatus);

  if (from === to) return true;
  if (TERMINAL_TRIP_STATUSES.has(from) && to !== from) return false;
  if (to === TRIP_STATUSES.CANCELLED) return true;

  const fromIdx = lifecycleIndex(from);
  const toIdx = lifecycleIndex(to);
  if (fromIdx < 0 || toIdx < 0) return true;

  return toIdx >= fromIdx;
}

function toNumber(value, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) && num >= 0 ? num : fallback;
}

/**
 * Build reconciliation summary from handoff rows (web API or callable).
 * Row shape: { id, missing, remainingLoaded, unloadedCount, expectedCount, ... }
 */
function evaluateReconciliationRows(rows = []) {
  const shipments = Array.isArray(rows) ? rows : [];
  const missingShipments = shipments.filter((row) => row.missing === true);
  const unloadedShipments = shipments.filter((row) => !row.missing);
  const manifestPieces = shipments.reduce(
    (sum, row) => sum + toNumber(row.expectedCount, 0),
    0,
  );
  const unloadedPieces = shipments.reduce(
    (sum, row) => sum + toNumber(row.unloadedCount, 0),
    0,
  );
  const onTruckPieces = shipments.reduce(
    (sum, row) => sum + toNumber(row.remainingLoaded, 0),
    0,
  );
  const missingPieces = Math.max(manifestPieces - unloadedPieces, 0);
  const missingPackageIds = missingShipments.flatMap((row) =>
    Array.isArray(row.missingPackages)
      ? row.missingPackages.map((entry) => entry.packageId).filter(Boolean)
      : [],
  );

  return {
    manifestShipments: shipments.length,
    unloadedShipments: unloadedShipments.length,
    missingShipments: missingShipments.length,
    manifestPieces,
    unloadedPieces,
    onTruckPieces,
    missingPieces,
    missingPackages: missingPackageIds.length,
    missingPackageIds,
    ready: shipments.length > 0 && missingShipments.length === 0,
    missingShipmentIds: missingShipments
      .map((row) => row.id || row.shipmentId)
      .filter(Boolean),
    unloadedShipmentIds: unloadedShipments
      .map((row) => row.id || row.shipmentId)
      .filter(Boolean),
  };
}

/**
 * After Odiongan unload + reconcile: should trip become ARRIVED?
 */
function shouldPromoteTripToArrived(trip = {}, reconciliationSummary = {}) {
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
      message: `Trip is already ${currentStatus}.`,
    };
  }

  if (currentStatus === TRIP_STATUSES.ARRIVED) {
    return {
      promote: false,
      reason: "ALREADY_ARRIVED",
      currentStatus,
      nextStatus: TRIP_STATUSES.ARRIVED,
      message: "Trip is already ARRIVED.",
    };
  }

  if (!AUTO_PROMOTE_TO_ARRIVED_FROM.has(currentStatus)) {
    return {
      promote: false,
      reason: "INVALID_STATUS_FOR_ARRIVED",
      currentStatus,
      nextStatus: null,
      message: `Cannot mark ARRIVED from status ${currentStatus}. Expected IN_TRANSIT or LOADED.`,
    };
  }

  return {
    promote: true,
    reason: "RECONCILE_READY",
    currentStatus,
    nextStatus: TRIP_STATUSES.ARRIVED,
    message: "Reconciliation complete. Trip should be marked ARRIVED.",
  };
}

/**
 * Evaluate one trip_shipments subcollection row (loadedCount = still on truck).
 */
function evaluateTripShipmentRow(tripShipment = {}) {
  const loadedCount = toNumber(tripShipment.loadedCount, 0);
  const totalItems = toNumber(tripShipment.totalItems, 0);
  const receivedCount = toNumber(
    tripShipment.receivedCount ?? tripShipment.deliveredCount,
    0,
  );

  return {
    pendingOnTruck: loadedCount > 0,
    loadedCount,
    totalItems,
    receivedCount,
  };
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

/**
 * Whether every trip-scoped label on this row is customer-delivered.
 * Assigned-but-never-loaded rows and warehouse remainders do not block completion.
 */
function isTripShipmentDelivered(row = {}) {
  if (!hasTripScopedCargo(row)) return true;

  const loadedCount = toNumber(row.loadedCount, 0);
  if (loadedCount > 0) return false;

  if (row.allTripScopedPackagesDelivered === true) return true;

  const tripScopedTotal = toNumber(row.tripScopedTotal, 0);
  const tripScopedDelivered = toNumber(row.tripScopedDelivered, 0);
  if (tripScopedTotal > 0) {
    return tripScopedDelivered >= tripScopedTotal;
  }

  const totalItems = toNumber(row.totalItems, 0);
  if (totalItems <= 0) return false;

  const status = normalizeTripStatus(row.status);
  return DELIVERED_TRIP_SHIPMENT_STATUSES.has(status);
}

/**
 * Promote to COMPLETED when every manifest shipment is fully processed.
 */
function shouldPromoteTripToCompleted(trip = {}, tripShipmentRows = []) {
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
      message: `Cannot complete trip from status ${currentStatus}.`,
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
      message: `${incompleteRows.length} shipment(s) on this trip still have undelivered trip-scoped labels.`,
    };
  }

  return {
    promote: true,
    reason: "ALL_SHIPMENTS_DELIVERED",
    currentStatus,
    nextStatus: TRIP_STATUSES.COMPLETED,
    message: "All trip shipments are delivered. Trip marked COMPLETED.",
  };
}

const ADMIN_OVERRIDE_RECEIVING_STATUSES = new Set([
  MANIFEST_STATUS.RECEIVING_IN_PROGRESS,
  MANIFEST_STATUS.LOCKED,
  MANIFEST_STATUS.RECONCILED,
]);

/**
 * Validate admin override release when reconciliation counts do not match.
 * missingPackages: [{ packageId, shipmentDocId, shipmentId, pieceSuffix? }]
 */
function validateAdminOverrideRelease({
  trip = {},
  missingPackages = [],
} = {}) {
  const entries = Array.isArray(missingPackages) ? missingPackages : [];

  const status = normalizeTripStatus(trip.status);
  if (TERMINAL_TRIP_STATUSES.has(status)) {
    return {
      valid: false,
      message: `Cannot admin override release from terminal trip status ${status}.`,
    };
  }

  return { valid: true, message: null, missingCount: entries.length };
}

/**
 * Last-mile release gate (Step 1.4).
 */
function isTripReleaseEligible(trip = {}, options = {}) {
  const {
    allowReconciledFallback = true,
    adminOverride = false,
    isAdmin = false,
  } = options;
  const status = normalizeTripStatus(trip.status);

  if (adminOverride && isAdmin) {
    if (TERMINAL_TRIP_STATUSES.has(status)) {
      return {
        eligible: false,
        reason: `Cannot admin override release from terminal trip status ${status}.`,
      };
    }

    if (RELEASE_ELIGIBLE_TRIP_STATUSES.has(status)) {
      return { eligible: true, reason: null, adminOverride: true };
    }

    const manifestStatus = resolveManifestStatus(trip);
    const hubReceivingActive =
      isHubTransferTrip(trip) &&
      (ADMIN_OVERRIDE_RECEIVING_STATUSES.has(manifestStatus) ||
        trip.receivingStartedAt);

    if (
      hubReceivingActive &&
      [TRIP_STATUSES.IN_TRANSIT, TRIP_STATUSES.LOADED].includes(status)
    ) {
      return {
        eligible: true,
        reason: null,
        adminOverride: true,
        requiresArrivedPromotion: true,
      };
    }

    return {
      eligible: false,
      reason: `Admin override release requires trip IN_TRANSIT (receiving) or ARRIVED (current: ${status || "unknown"}).`,
    };
  }

  if (RELEASE_ELIGIBLE_TRIP_STATUSES.has(status)) {
    if (isHubTransferTrip(trip)) {
      const manifestStatus = resolveManifestStatus(trip);
      if (
        manifestStatus !== MANIFEST_STATUS.RECONCILED &&
        !trip.reconciledAt
      ) {
        return {
          eligible: false,
          reason:
            "Manifest must be reconciled before releasing to delivery operations.",
        };
      }
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

/**
 * Callable guard for releaseForDeliveryOperations (Step 1.4).
 */
function assertTripReleaseEligible(trip = {}, options = {}) {
  const decision = isTripReleaseEligible(trip, options);
  if (decision.eligible) return decision;

  const { HttpsError } = require("firebase-functions/v2/https");
  throw new HttpsError(
    "failed-precondition",
    decision.reason || "Trip is not eligible for delivery release.",
  );
}

/**
 * Firestore field flags for updateTripStatus / reconciliation promotion.
 * Caller applies FieldValue.serverTimestamp() where true.
 */
function getTripStatusSideEffects(nextStatus, options = {}) {
  const status = normalizeTripStatus(nextStatus);
  const { markReconciled = false, source = null } = options;

  const effects = {
    status,
    setArrivedAt: false,
    setReconciledAt: false,
    setCompletedAt: false,
    setCancelledAt: false,
    setActive: true,
    promotionSource: source,
  };

  if (status === TRIP_STATUSES.ARRIVED) {
    effects.setArrivedAt = true;
    if (markReconciled || source === "RECONCILIATION") {
      effects.setReconciledAt = true;
    }
  }

  if (status === TRIP_STATUSES.COMPLETED) {
    effects.setCompletedAt = true;
    effects.setActive = false;
  }

  if (status === TRIP_STATUSES.CANCELLED) {
    effects.setCancelledAt = true;
    effects.setActive = false;
  }

  if (
    [
      TRIP_STATUSES.CREATED,
      TRIP_STATUSES.LOADED,
      TRIP_STATUSES.IN_TRANSIT,
    ].includes(status)
  ) {
    effects.setActive = true;
  }

  return effects;
}

/**
 * Combined lifecycle evaluation for handoff reconcile API / Step 1.2.
 */
function evaluateTripLifecycleAfterReconciliation(
  trip = {},
  reconciliationRows = [],
) {
  const reconciliation = evaluateReconciliationRows(reconciliationRows);
  const arrivedDecision = shouldPromoteTripToArrived(trip, reconciliation);

  return {
    reconciliation,
    arrived: arrivedDecision,
    release: isTripReleaseEligible(trip),
    recommendedNextStatus: arrivedDecision.promote
      ? arrivedDecision.nextStatus
      : normalizeTripStatus(trip.status),
  };
}

module.exports = {
  TRIP_STATUSES,
  LINEHAUL_LIFECYCLE,
  TERMINAL_TRIP_STATUSES,
  RELEASE_ELIGIBLE_TRIP_STATUSES,
  normalizeTripStatus,
  lifecycleIndex,
  isAllowedTripTransition,
  evaluateReconciliationRows,
  shouldPromoteTripToArrived,
  evaluateTripShipmentRow,
  isTripShipmentDelivered,
  shouldPromoteTripToCompleted,
  validateAdminOverrideRelease,
  isTripReleaseEligible,
  assertTripReleaseEligible,
  getTripStatusSideEffects,
  evaluateTripLifecycleAfterReconciliation,
};
