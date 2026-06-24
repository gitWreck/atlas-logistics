"use strict";

const {
  normalizePackageStatus,
  allPiecesDelivered,
  computePackageBreakdown,
  PACKAGE_STATUS,
  pieceQty,
} = require("./packageStatus");

const LOADED_ON_TRIP_STATUSES = new Set([
  PACKAGE_STATUS.LOADED_TO_TRIP,
  PACKAGE_STATUS.PARTIALLY_LOADED,
  PACKAGE_STATUS.LOADED,
]);

function sumQtyForStatuses(packages = [], statuses = new Set()) {
  if (!Array.isArray(packages) || !statuses.size) return 0;

  return packages.reduce((sum, pkg) => {
    const status = normalizePackageStatus(pkg);
    if (!statuses.has(status)) return sum;
    return sum + pieceQty(pkg);
  }, 0);
}

/** Only true linehaul dispatch (IN_TRANSIT). LOADED_TO_TRIP stays LOADED until dispatchTrip. */
function sumDispatchedInTransitQty(packages = []) {
  return sumQtyForStatuses(packages, new Set([PACKAGE_STATUS.IN_TRANSIT]));
}

function sumLoadedOnTripQty(packages = []) {
  return sumQtyForStatuses(packages, LOADED_ON_TRIP_STATUSES);
}

function resolveDispatchedTransitMasterStatus({
  packages = [],
  totalQty = 0,
  atDivisoriaQty = 0,
}) {
  const dispatchedInTransitQty = sumDispatchedInTransitQty(packages);
  if (dispatchedInTransitQty <= 0) return null;

  if (dispatchedInTransitQty < totalQty || atDivisoriaQty > 0) {
    return "PARTIALLY_IN_TRANSIT";
  }
  if (dispatchedInTransitQty >= totalQty) {
    return "IN_TRANSIT";
  }

  return null;
}

const RELEASED_POOL_STATUSES = new Set([
  PACKAGE_STATUS.RELEASED_FOR_DELIVERY,
  PACKAGE_STATUS.ROUTE_ASSIGNED,
  PACKAGE_STATUS.AVAILABLE_AT_ODIONGAN_WAREHOUSE,
  PACKAGE_STATUS.AVAILABLE_AT_WAREHOUSE,
]);

const READY_FOR_DELIVERY_STATUSES = new Set([
  PACKAGE_STATUS.READY_FOR_DELIVERY,
]);

const OUT_FOR_DELIVERY_STATUSES = new Set([PACKAGE_STATUS.OUT_FOR_DELIVERY]);

const LINEHAUL_LOADED_STATUSES = new Set([
  PACKAGE_STATUS.LOADED,
  PACKAGE_STATUS.LOADED_TO_TRIP,
  PACKAGE_STATUS.PARTIALLY_LOADED,
]);

const DELIVERY_LOADED_STATUSES = new Set([
  PACKAGE_STATUS.LOADED,
  PACKAGE_STATUS.LOADED_TO_DELIVERY_VEHICLE,
  PACKAGE_STATUS.PARTIALLY_LOADED,
]);

const LOADED_STATUSES = new Set([
  ...LINEHAUL_LOADED_STATUSES,
  ...DELIVERY_LOADED_STATUSES,
]);

function countStatusRows(packages = [], matcher) {
  return packages.filter((pkg) => {
    const status = normalizePackageStatus(pkg);
    if (typeof matcher === "function") return matcher(status, pkg);
    if (matcher instanceof Set) return matcher.has(status);
    return status === matcher;
  }).length;
}

/**
 * Last-mile checker load (pool → van). Must not reuse linehaul PARTIALLY_LOADED.
 */
function resolveLastMileCheckerMasterStatus({
  onCheckerQty = 0,
  releasedQty = 0,
  availablePoolRows = 0,
  atOdionganQty = 0,
  deliveredQty = 0,
  totalQty = 0,
} = {}) {
  if (onCheckerQty <= 0) return null;

  if (deliveredQty > 0 && deliveredQty < totalQty) {
    return "PARTIALLY_DELIVERED";
  }

  const poolRemaining =
    releasedQty > 0 || availablePoolRows > 0 || atOdionganQty > 0;
  if (poolRemaining || onCheckerQty < totalQty) {
    return "PARTIALLY_AVAILABLE_FOR_DELIVERY";
  }

  return "READY_FOR_DELIVERY";
}

function resolveOutForDeliveryMasterStatus({
  outForDeliveryQty = 0,
  outForDeliveryRows = 0,
  releasedQty = 0,
  availablePoolRows = 0,
  deliveredQty = 0,
  totalQty = 0,
  totalRows = 0,
} = {}) {
  if (outForDeliveryQty <= 0 && outForDeliveryRows <= 0) return null;

  if (deliveredQty > 0 && deliveredQty < totalQty) {
    return "PARTIALLY_DELIVERED";
  }

  // Any checker load scan moves the shipment into last-mile delivery.
  return "OUT_FOR_DELIVERY";
}

function resolveLinehaulLoadedMasterStatus({
  packages = [],
  totalRows = 0,
  atDivisoriaQty = 0,
  loadedRows = 0,
} = {}) {
  const linehaulLoadedRows = countStatusRows(
    packages,
    LINEHAUL_LOADED_STATUSES,
  );
  const loadedOnTripQty = sumLoadedOnTripQty(packages);

  if (loadedOnTripQty > 0 && atDivisoriaQty > 0) {
    return "PARTIALLY_LOADED";
  }
  if (linehaulLoadedRows === totalRows && linehaulLoadedRows > 0) {
    return "LOADED";
  }
  if (linehaulLoadedRows > 0 || loadedOnTripQty > 0) {
    return "PARTIALLY_LOADED";
  }
  if (loadedRows > 0) {
    return "PARTIALLY_LOADED";
  }

  return null;
}

/**
 * Derive master shipment status from package rows and optional qty totals.
 * Mixed delivery states → PARTIALLY_DELIVERED.
 * When every piece is delivered → COMPLETED.
 */
function deriveMasterShipmentStatus(packages = [], options = {}) {
  const {
    totals = null,
    previousStatus = "",
    shouldPromoteOutForDelivery = false,
  } = options;

  if (!Array.isArray(packages) || packages.length === 0) {
    return "RECEIVED";
  }

  if (allPiecesDelivered(packages)) {
    return "COMPLETED";
  }

  const breakdown = computePackageBreakdown(packages);
  const totalRows = packages.length;
  const totalQty = breakdown.total || totalRows;

  const deliveredQty = breakdown.delivered;
  const missingQty = breakdown.missing;
  const damagedQty = breakdown.damaged;
  const failedQty = breakdown.failed;
  const returnedQty = breakdown.returned;
  const inTransitQty = breakdown.inTransit;
  const atDivisoriaQty = breakdown.atDivisoria;
  const atOdionganQty = breakdown.atOdiongan;
  const releasedQty =
    breakdown.releasedForDelivery + (breakdown.routeAssigned || 0);
  const onCheckerQty = breakdown.onCheckerVan;
  const outForDeliveryQty = breakdown.outForDelivery;

  const deliveredRows = countStatusRows(packages, PACKAGE_STATUS.DELIVERED);
  const missingRows = countStatusRows(packages, PACKAGE_STATUS.MISSING);
  const damagedRows = countStatusRows(packages, PACKAGE_STATUS.DAMAGED);
  const failedRows = countStatusRows(packages, PACKAGE_STATUS.FAILED_DELIVERY);
  const outForDeliveryRows = countStatusRows(
    packages,
    OUT_FOR_DELIVERY_STATUSES,
  );
  const loadedRows = countStatusRows(packages, LOADED_STATUSES);
  const readyForDeliveryRows = countStatusRows(
    packages,
    READY_FOR_DELIVERY_STATUSES,
  );
  const availablePoolRows = countStatusRows(packages, (status, pkg) => {
    if (RELEASED_POOL_STATUSES.has(status)) return true;
    if (status === PACKAGE_STATUS.ROUTE_ASSIGNED) return true;
    return (
      (status === PACKAGE_STATUS.AVAILABLE_AT_ODIONGAN_WAREHOUSE ||
        status === PACKAGE_STATUS.AVAILABLE_AT_WAREHOUSE) &&
      pkg.availableForDelivery === true
    );
  });
  const returnedToWarehouseRows = countStatusRows(
    packages,
    PACKAGE_STATUS.RETURNED_TO_WAREHOUSE,
  );
  const returnedReceivedRows = countStatusRows(packages, (status) =>
    [
      PACKAGE_STATUS.RETURNED_RECEIVED_AT_ODIONGAN,
      PACKAGE_STATUS.RETURNED_RECEIVED_AT_HUB,
    ].includes(status),
  );

  if (totals) {
    const totalContentQty = Number(totals.totalQty) || 0;
    const receivedQty = Number(totals.receivedQty) || 0;
    const loadedQty = Number(totals.loadedQty) || 0;
    const missingTotalQty = Number(totals.missingQty) || 0;
    const damagedTotalQty = Number(totals.damagedQty) || 0;

    // Hub receive at Odiongan is not final customer delivery.
    if (atOdionganQty > 0 && deliveredQty === 0) {
      if (atOdionganQty >= totalQty) return "ARRIVED";
      if (loadedQty === 0 && inTransitQty === 0) return "PARTIALLY_ARRIVED";
    }

    if (totalContentQty > 0 && deliveredQty >= totalContentQty) {
      return allPiecesDelivered(packages) ? "COMPLETED" : "DELIVERED";
    }
    if (totalContentQty > 0 && allPiecesDelivered(packages)) {
      return "COMPLETED";
    }
    if (totalContentQty > 0 && damagedTotalQty >= totalContentQty) {
      return "DAMAGED";
    }
    if (totalContentQty > 0 && missingTotalQty >= totalContentQty) {
      return "MISSING";
    }
    if (deliveredQty > 0 && deliveredQty < totalContentQty) {
      return "PARTIALLY_DELIVERED";
    }
    if (
      receivedQty > 0 &&
      receivedQty < totalContentQty &&
      deliveredQty === 0 &&
      atOdionganQty > 0
    ) {
      return "PARTIALLY_ARRIVED";
    }

    if (shouldPromoteOutForDelivery) {
      return "OUT_FOR_DELIVERY";
    }

    const dispatchedTransitStatus = resolveDispatchedTransitMasterStatus({
      packages,
      totalQty,
      atDivisoriaQty,
    });
    if (dispatchedTransitStatus) {
      return dispatchedTransitStatus;
    }

    if (releasedQty > 0 || availablePoolRows > 0) {
      if (deliveredQty > 0) return "PARTIALLY_DELIVERED";
      if (releasedQty > 0 && releasedQty < totalQty) {
        return "PARTIALLY_AVAILABLE_FOR_DELIVERY";
      }
      return "AVAILABLE_FOR_DELIVERY";
    }

    const lastMileStatus = resolveLastMileCheckerMasterStatus({
      onCheckerQty,
      releasedQty,
      availablePoolRows,
      atOdionganQty,
      deliveredQty,
      totalQty,
    });
    if (lastMileStatus) return lastMileStatus;

    if (totalContentQty > 0 && loadedQty >= totalContentQty) {
      const linehaulOnly = resolveLinehaulLoadedMasterStatus({
        packages,
        totalRows,
        atDivisoriaQty,
        loadedRows,
      });
      if (linehaulOnly) return linehaulOnly;
      return "LOADED";
    }

    const linehaulStatus = resolveLinehaulLoadedMasterStatus({
      packages,
      totalRows,
      atDivisoriaQty,
      loadedRows,
    });
    if (linehaulStatus) return linehaulStatus;
  }

  if (deliveredQty > 0 && deliveredQty < totalQty) {
    return "PARTIALLY_DELIVERED";
  }
  if (deliveredRows === totalRows) {
    return "COMPLETED";
  }

  if (missingRows === totalRows || (missingQty > 0 && missingQty >= totalQty)) {
    return "MISSING";
  }
  if (damagedRows === totalRows || (damagedQty > 0 && damagedQty >= totalQty)) {
    return "DAMAGED";
  }

  if (returnedToWarehouseRows > 0 && returnedToWarehouseRows === totalRows) {
    return "RETURNED_TO_WAREHOUSE";
  }
  if (returnedReceivedRows > 0 && returnedReceivedRows === totalRows) {
    return "RETURNED_RECEIVED_AT_HUB";
  }
  if (returnedQty > 0) {
    if (deliveredQty > 0) return "PARTIALLY_DELIVERED";
    if (failedQty > 0) return "FAILED_DELIVERY";
    return "RETURNED_TO_WAREHOUSE";
  }

  const outForDeliveryStatus = resolveOutForDeliveryMasterStatus({
    outForDeliveryQty,
    outForDeliveryRows,
    releasedQty,
    availablePoolRows,
    deliveredQty,
    totalQty,
    totalRows,
  });
  if (outForDeliveryStatus) return outForDeliveryStatus;

  if (failedRows === totalRows) {
    return "FAILED_DELIVERY";
  }
  if (
    failedQty > 0 &&
    deliveredQty === 0 &&
    outForDeliveryQty === 0 &&
    onCheckerQty === 0 &&
    loadedRows === 0
  ) {
    return "FAILED_DELIVERY";
  }

  if (shouldPromoteOutForDelivery) {
    return "OUT_FOR_DELIVERY";
  }

  const dispatchedTransitStatus = resolveDispatchedTransitMasterStatus({
    packages,
    totalQty,
    atDivisoriaQty,
  });
  if (dispatchedTransitStatus) {
    return dispatchedTransitStatus;
  }

  if (releasedQty > 0 || availablePoolRows > 0) {
    if (deliveredQty > 0) return "PARTIALLY_DELIVERED";
    if (releasedQty > 0 && releasedQty < totalQty) {
      return "PARTIALLY_AVAILABLE_FOR_DELIVERY";
    }
    return "AVAILABLE_FOR_DELIVERY";
  }

  const lastMileStatus = resolveLastMileCheckerMasterStatus({
    onCheckerQty,
    releasedQty,
    availablePoolRows,
    atOdionganQty,
    deliveredQty,
    totalQty,
  });
  if (lastMileStatus) return lastMileStatus;

  const linehaulStatus = resolveLinehaulLoadedMasterStatus({
    packages,
    totalRows,
    atDivisoriaQty,
    loadedRows,
  });
  if (linehaulStatus) return linehaulStatus;

  if (atOdionganQty > 0 && atOdionganQty < totalQty && deliveredQty === 0) {
    return "PARTIALLY_ARRIVED";
  }
  if (atOdionganQty === totalQty) {
    return "ARRIVED";
  }

  if (readyForDeliveryRows === totalRows) {
    return "READY_FOR_DELIVERY";
  }
  if (
    String(previousStatus).trim().toUpperCase() === "READY_FOR_DELIVERY" &&
    readyForDeliveryRows > 0
  ) {
    return "READY_FOR_DELIVERY";
  }
  if (readyForDeliveryRows > 0) {
    return "READY_FOR_DELIVERY";
  }

  if (atDivisoriaQty === totalQty) {
    return "RECEIVED";
  }
  if (atDivisoriaQty > 0 && loadedOnTripQty > 0) {
    return "PARTIALLY_LOADED";
  }

  return "RECEIVED";
}

const POOL_DERIVED_MASTER_STATUSES = new Set([
  "AVAILABLE_FOR_DELIVERY",
  "PARTIALLY_AVAILABLE_FOR_DELIVERY",
]);

const MASTER_STATUSES_SKIP_PACKAGE_DERIVE = new Set([
  "PENDING_PICKUP",
  "CANCELLED",
  "pending",
]);

/**
 * Remove stale availableForDelivery flags on pieces when derived master is not pool-eligible.
 * Prevents master AVAILABLE_FOR_DELIVERY while labels stay AVAILABLE_AT_WAREHOUSE.
 */
function stripStalePackagePoolFlags(packages = [], derivedStatus = "") {
  if (
    POOL_DERIVED_MASTER_STATUSES.has(String(derivedStatus || "").toUpperCase())
  ) {
    return packages;
  }

  return packages.map((pkg) => {
    if (pkg?.availableForDelivery !== true) return pkg;
    const status = normalizePackageStatus(pkg);
    if (RELEASED_POOL_STATUSES.has(status)) return pkg;
    return { ...pkg, availableForDelivery: false };
  });
}

function shipmentHasPiecesInCheckerLoadPool(packages = []) {
  if (!Array.isArray(packages)) return false;

  return packages.some((pkg) => {
    if (pkg?.loadedByCheckerId) return false;
    const status = normalizePackageStatus(pkg);
    if (RELEASED_POOL_STATUSES.has(status)) return true;
    return pkg?.availableForDelivery === true;
  });
}

function resolveShipmentAvailableForDelivery(
  derivedStatus = "",
  packages = [],
) {
  const normalized = String(derivedStatus || "")
    .trim()
    .toUpperCase();
  if (normalized === "COMPLETED") return false;
  if (POOL_DERIVED_MASTER_STATUSES.has(normalized)) return true;
  if (
    ["OUT_FOR_DELIVERY", "PARTIALLY_OUT_FOR_DELIVERY"].includes(normalized)
  ) {
    return shipmentHasPiecesInCheckerLoadPool(packages);
  }
  return false;
}

function normalizePackagesBeforeDerive(packages = []) {
  if (!Array.isArray(packages)) return [];

  return packages.map((pkg) => {
    const status = normalizePackageStatus(pkg);
    if (
      status === PACKAGE_STATUS.IN_TRANSIT ||
      status === PACKAGE_STATUS.LOADED_TO_TRIP
    ) {
      const next = { ...pkg, availableForDelivery: false };
      if (String(pkg.custodyOwnerType || "").toUpperCase() === "WAREHOUSE") {
        next.custodyOwnerType = "TRIP";
      }
      return next;
    }
    return pkg;
  });
}

/**
 * Canonical post-mutation snapshot: derive master + breakdown + pool flag hygiene.
 */
function buildDerivedShipmentSnapshot(packages = [], options = {}) {
  const normalizedInput = normalizePackagesBeforeDerive(packages);
  const {
    previousStatus = "",
    totals = null,
    shouldPromoteOutForDelivery = false,
    preserveStatuses = MASTER_STATUSES_SKIP_PACKAGE_DERIVE,
  } = options;

  const previous = String(previousStatus || "").trim();
  if (preserveStatuses.has(previous)) {
    return {
      status: previous,
      packages: normalizedInput,
      packageBreakdown: computePackageBreakdown(normalizedInput),
      availableForDelivery: resolveShipmentAvailableForDelivery(
        previous,
        normalizedInput,
      ),
    };
  }

  const deriveOptions = {
    previousStatus,
    shouldPromoteOutForDelivery,
    ...(totals ? { totals } : {}),
  };

  let derivedStatus = deriveMasterShipmentStatus(normalizedInput, deriveOptions);
  let normalizedPackages = stripStalePackagePoolFlags(
    normalizedInput,
    derivedStatus,
  );

  const afterStrip = deriveMasterShipmentStatus(
    normalizedPackages,
    deriveOptions,
  );
  if (afterStrip !== derivedStatus) {
    derivedStatus = afterStrip;
    normalizedPackages = stripStalePackagePoolFlags(
      normalizedPackages,
      derivedStatus,
    );
  }

  return {
    status: derivedStatus,
    packages: normalizedPackages,
    packageBreakdown: computePackageBreakdown(normalizedPackages),
    availableForDelivery: resolveShipmentAvailableForDelivery(
      derivedStatus,
      normalizedPackages,
    ),
  };
}

module.exports = {
  normalizePackageStatus,
  allPiecesDelivered,
  deriveMasterShipmentStatus,
  computePackageBreakdown,
  stripStalePackagePoolFlags,
  resolveShipmentAvailableForDelivery,
  buildDerivedShipmentSnapshot,
  MASTER_STATUSES_SKIP_PACKAGE_DERIVE,
};
