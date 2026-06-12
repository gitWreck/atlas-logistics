import {
  MANIFEST_STATUS,
  resolveManifestStatus,
  isHubTransferTrip,
} from "./manifestStatus";
import { countShipmentDeliveryPool } from "./tripDeliveryPoolCounts";
import {
  getTripScopedPackages,
  resolveHubHandoffPieceTotal,
} from "./tripScopedPackages";

function resolveShipmentFullPieceTotal(shipment = {}) {
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

function resolveTripScopedPieceTotal(shipment = {}) {
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

  if (storedTotal > 0 && fullShipmentTotal > storedTotal && loaded > 0) {
    return Math.max(loaded, onTrip);
  }
  if (storedTotal > 0 && loaded > 0 && storedTotal > loaded + received) {
    return Math.max(loaded, onTrip);
  }

  return storedTotal > 0 ? storedTotal : loaded;
}

function clampCount(value) {
  return Math.max(0, Number(value) || 0);
}

function normalizeStatus(value) {
  return String(value || "").trim().toUpperCase();
}

function pieceQty(pkg = {}) {
  const qty = Number(pkg.quantity);
  return Number.isFinite(qty) && qty > 0 ? qty : 1;
}

function countReleasedTripScopedPieces(tripShipment = {}, shipment = {}, tripId = "") {
  const scoped = getTripScopedPackages(tripShipment, shipment, tripId);
  if (scoped.length === 0) {
    if (shipment.releasedForDeliveryAt || shipment.availableForDelivery === true) {
      return resolveTripScopedPieceTotal(tripShipment);
    }
    return 0;
  }

  return scoped.reduce((sum, pkg) => {
    const status = normalizeStatus(pkg.status);
    if (pkg.availableForDelivery === true) return sum + pieceQty(pkg);
    if (
      status === "RELEASED_FOR_DELIVERY" ||
      status === "AVAILABLE_FOR_DELIVERY"
    ) {
      return sum + pieceQty(pkg);
    }
    return sum;
  }, 0);
}

function countOnCheckerTripScopedPieces(tripShipment = {}, shipment = {}, tripId = "") {
  const scoped = getTripScopedPackages(tripShipment, shipment, tripId);
  if (scoped.length === 0) return 0;

  return scoped.reduce((sum, pkg) => {
    const status = normalizeStatus(pkg.status);
    if (["DELIVERED", "COMPLETED", "MISSING", "DAMAGED", "CANCELLED"].includes(status)) {
      return sum;
    }
    if (pkg.loadedByCheckerId) return sum + pieceQty(pkg);
    if (normalizeStatus(pkg.custodyOwnerType) === "CHECKER") {
      return sum + pieceQty(pkg);
    }
    if (
      status === "LOADED_TO_DELIVERY_VEHICLE" ||
      status === "OUT_FOR_DELIVERY"
    ) {
      return sum + pieceQty(pkg);
    }
    return sum;
  }, 0);
}

function countDeliveredTripScopedPieces(tripShipment = {}, shipment = {}, tripId = "") {
  const scoped = getTripScopedPackages(tripShipment, shipment, tripId);
  return scoped.reduce((sum, pkg) => {
    const status = normalizeStatus(pkg.status);
    if (status === "DELIVERED" || status === "COMPLETED") {
      return sum + pieceQty(pkg);
    }
    return sum;
  }, 0);
}

export function aggregateHubDeliveryOpsCounts(trip = {}) {
  const shipments = Array.isArray(trip.shipments) ? trip.shipments : [];
  const tripId = String(trip.id || "").trim();
  let total = 0;
  let delivered = 0;
  let released = 0;
  let loadedToChecker = 0;

  shipments.forEach((row) => {
    const scopedPackages = getTripScopedPackages(row, row, tripId);
    const tripScopedTotal =
      scopedPackages.length > 0
        ? resolveHubHandoffPieceTotal(row, scopedPackages)
        : Math.max(
            resolveHubHandoffPieceTotal(row, []),
            resolveTripScopedPieceTotal(row),
          );
    total += tripScopedTotal;

    if (scopedPackages.length > 0) {
      const pool = countShipmentDeliveryPool(scopedPackages);
      delivered += pool.delivered;
      loadedToChecker += Object.values(pool.onChecker || {}).reduce(
        (sum, qty) => sum + clampCount(qty),
        0,
      );
      released += scopedPackages.reduce((sum, pkg) => {
        const status = normalizeStatus(pkg.status);
        if (pkg.availableForDelivery === true) return sum + pieceQty(pkg);
        if (
          status === "RELEASED_FOR_DELIVERY" ||
          status === "AVAILABLE_FOR_DELIVERY"
        ) {
          return sum + pieceQty(pkg);
        }
        return sum;
      }, 0);
      return;
    }

    delivered += countDeliveredTripScopedPieces(row, row, tripId);
    released += countReleasedTripScopedPieces(row, row, tripId);
    loadedToChecker += countOnCheckerTripScopedPieces(row, row, tripId);
  });

  return {
    total,
    delivered,
    released,
    loadedToChecker,
  };
}

export const HUB_BOARD_PHASE = Object.freeze({
  UNLOADING: "UNLOADING",
  UNLOADING_COMPLETE: "UNLOADING_COMPLETE",
  RECONCILED: "RECONCILED",
  RELEASED: "RELEASED",
  OUT_FOR_DELIVERY: "OUT_FOR_DELIVERY",
  DELIVERY_COMPLETED: "DELIVERY_COMPLETED",
});

function resolveUnloadingTotals(trip = {}) {
  const shipments = Array.isArray(trip.shipments) ? trip.shipments : [];
  let remainingOnTruck = clampCount(trip.totalLoaded);
  let tripPieceTotal = clampCount(trip.totalItems);
  let hubReceived = clampCount(trip.totalArrived);

  if (shipments.length > 0) {
    remainingOnTruck = shipments.reduce(
      (sum, row) => sum + clampCount(row.loadedCount),
      0,
    );
    hubReceived = shipments.reduce(
      (sum, row) =>
        sum + clampCount(row.receivedCount ?? row.deliveredCount),
      0,
    );
    tripPieceTotal = shipments.reduce(
      (sum, row) => sum + resolveTripScopedPieceTotal(row),
      0,
    );
  }

  const total = Math.max(
    tripPieceTotal,
    remainingOnTruck + hubReceived,
    clampCount(trip.totalLoaded),
  );

  return {
    total,
    remainingOnTruck,
    hubReceived,
    unloaded: Math.max(total - remainingOnTruck, hubReceived),
  };
}

function isReceivingAtHub(trip = {}) {
  const manifestStatus = resolveManifestStatus(trip);
  const status = normalizeStatus(trip.status);

  return (
    manifestStatus === MANIFEST_STATUS.RECEIVING_IN_PROGRESS ||
    status === "UNLOADING" ||
    Boolean(trip.receivingStartedAt && !trip.reconciledAt)
  );
}

export function resolveHubBoardPhase(trip = {}) {
  if (!isHubTransferTrip(trip)) return null;

  const status = normalizeStatus(trip.status);
  const manifestStatus = resolveManifestStatus(trip);
  const unloading = resolveUnloadingTotals(trip);
  const delivery = aggregateHubDeliveryOpsCounts(trip);

  const total = Math.max(unloading.total, delivery.total);
  const delivered = delivery.delivered;
  const remainingOnTruck = unloading.remainingOnTruck;

  if (["COMPLETED", "DELIVERED"].includes(status)) {
    return HUB_BOARD_PHASE.DELIVERY_COMPLETED;
  }

  if (
    manifestStatus === MANIFEST_STATUS.RECONCILED ||
    trip.reconciledAt
  ) {
    const pendingDelivery = Math.max(total - delivered, 0);
    if (
      total > 0 &&
      delivered >= total &&
      pendingDelivery === 0 &&
      delivery.loadedToChecker === 0
    ) {
      return HUB_BOARD_PHASE.DELIVERY_COMPLETED;
    }
    if (delivered > 0) {
      return HUB_BOARD_PHASE.OUT_FOR_DELIVERY;
    }
    if (
      delivery.loadedToChecker > 0 ||
      status === "OUT_FOR_DELIVERY" ||
      status === "READY_FOR_DELIVERY"
    ) {
      return HUB_BOARD_PHASE.OUT_FOR_DELIVERY;
    }
    if (delivery.released > 0 || tripHasReleasedShipments(trip)) {
      return HUB_BOARD_PHASE.RELEASED;
    }
    return HUB_BOARD_PHASE.RECONCILED;
  }

  const inHubUnloadWindow =
    ["ARRIVED", "UNLOADING"].includes(status) || isReceivingAtHub(trip);

  if (inHubUnloadWindow) {
    if (total > 0 && remainingOnTruck <= 0) {
      return HUB_BOARD_PHASE.UNLOADING_COMPLETE;
    }
    return HUB_BOARD_PHASE.UNLOADING;
  }

  return null;
}

function tripHasReleasedShipments(trip = {}) {
  const shipments = Array.isArray(trip.shipments) ? trip.shipments : [];
  return shipments.some(
    (row) =>
      row.releasedForDeliveryAt ||
      row.availableForDelivery === true ||
      ["AVAILABLE_FOR_DELIVERY", "RELEASED_FOR_DELIVERY", "READY_FOR_DELIVERY"].includes(
        normalizeStatus(row.status || row.masterStatus),
      ),
  );
}

export function getHubBoardStatsDisplay(trip = {}) {
  const phase = resolveHubBoardPhase(trip);
  if (!phase) return null;

  const unloading = resolveUnloadingTotals(trip);
  const delivery = aggregateHubDeliveryOpsCounts(trip);
  const total = Math.max(unloading.total, delivery.total);

  if (phase === HUB_BOARD_PHASE.UNLOADING) {
    const remaining = unloading.remainingOnTruck;
    return {
      phase,
      count: remaining,
      total,
      label: "Remaining to Unload",
      subLabel:
        remaining === 1
          ? "1 remaining"
          : remaining > 0
            ? `${remaining} remaining`
            : "All items unloaded",
      progressPercent: total > 0 ? (unloading.unloaded / total) * 100 : 0,
    };
  }

  if (phase === HUB_BOARD_PHASE.UNLOADING_COMPLETE) {
    return {
      phase,
      count: 0,
      total,
      label: "Unloaded",
      subLabel: "Ready to reconcile",
      progressPercent: total > 0 ? 100 : 0,
    };
  }

  if (phase === HUB_BOARD_PHASE.RECONCILED) {
    return {
      phase,
      count: total,
      total,
      label: "Packages Reconciled",
      subLabel: "All items verified and matched",
      progressPercent: total > 0 ? 100 : 0,
    };
  }

  if (phase === HUB_BOARD_PHASE.RELEASED) {
    return {
      phase,
      count: 0,
      total,
      label: "Packages Released",
      subLabel: "Packages released to checkers for delivery",
      progressPercent: 0,
    };
  }

  if (phase === HUB_BOARD_PHASE.OUT_FOR_DELIVERY) {
    const delivered = delivery.delivered;
    return {
      phase,
      count: delivered,
      total,
      label: "Out for Delivery",
      subLabel: "Delivery in progress",
      progressPercent: total > 0 ? (delivered / total) * 100 : 0,
    };
  }

  return {
    phase: HUB_BOARD_PHASE.DELIVERY_COMPLETED,
    count: total,
    total,
    label: "Delivery Completed",
    subLabel: "All packages delivered",
    progressPercent: total > 0 ? 100 : 0,
  };
}

export function getHubBoardStatusLabel(trip = {}) {
  const phase = resolveHubBoardPhase(trip);
  if (!phase) return null;

  switch (phase) {
    case HUB_BOARD_PHASE.UNLOADING:
      return "ARRIVED | UNLOADING";
    case HUB_BOARD_PHASE.UNLOADING_COMPLETE:
      return "ARRIVED | UNLOADING COMPLETE";
    case HUB_BOARD_PHASE.RECONCILED:
      return "ARRIVED | RECONCILED";
    case HUB_BOARD_PHASE.RELEASED:
      return "ARRIVED | RELEASED FOR DELIVERY";
    case HUB_BOARD_PHASE.OUT_FOR_DELIVERY:
      return "ARRIVED | OUT FOR DELIVERY";
    case HUB_BOARD_PHASE.DELIVERY_COMPLETED:
      return "ARRIVED | DELIVERY COMPLETED";
    default:
      return null;
  }
}

export function calculateHubBoardProgress(trip = {}) {
  const stats = getHubBoardStatsDisplay(trip);
  if (!stats) return null;
  return Math.min(
    100,
    Math.max(0, Math.round(stats.progressPercent * 100) / 100),
  );
}

/**
 * Per-shipment trip progress for manifest rows after arrival (delivered / released).
 */
export function getShipmentTripProgressDisplay(tripShipment = {}, trip = {}) {
  const tripId = String(trip.id || trip.tripId || "").trim();
  const delivered = countDeliveredTripScopedPieces(tripShipment, tripShipment, tripId);
  const released = countReleasedTripScopedPieces(tripShipment, tripShipment, tripId);
  const tripScopedTotal = resolveTripScopedPieceTotal(tripShipment);
  const denominator = released > 0 ? released : tripScopedTotal;

  return {
    count: delivered,
    total: denominator,
    displayValue:
      denominator > 0 ? `${delivered}/${denominator}` : String(delivered),
    subLabel:
      released > 0
        ? `Delivered out of ${denominator} released on this trip`
        : `Delivered out of ${denominator} pieces on this trip`,
  };
}
