"use strict";

const {
  normalizePackageStatus,
  allPiecesDelivered,
  computePackageBreakdown,
  PACKAGE_STATUS,
} = require("./packageStatus");

const RELEASED_POOL_STATUSES = new Set([
  PACKAGE_STATUS.RELEASED_FOR_DELIVERY,
  PACKAGE_STATUS.AVAILABLE_AT_ODIONGAN_WAREHOUSE,
  PACKAGE_STATUS.AVAILABLE_AT_WAREHOUSE,
]);

const READY_FOR_DELIVERY_STATUSES = new Set([PACKAGE_STATUS.READY_FOR_DELIVERY]);

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
  const releasedQty = breakdown.releasedForDelivery;
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
    if (totalContentQty > 0 && loadedQty >= totalContentQty) {
      return "LOADED";
    }
    if (loadedQty > 0) {
      return "PARTIALLY_LOADED";
    }
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

  if (outForDeliveryQty > 0 || outForDeliveryRows > 0) {
    return "OUT_FOR_DELIVERY";
  }

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

  if (inTransitQty > 0 && inTransitQty < totalQty) {
    return "PARTIALLY_IN_TRANSIT";
  }
  if (inTransitQty > 0 && atDivisoriaQty > 0) {
    return "PARTIALLY_IN_TRANSIT";
  }
  if (inTransitQty === totalQty) {
    return "IN_TRANSIT";
  }

  if (loadedRows === totalRows) {
    return "LOADED";
  }
  if (loadedRows > 0 || onCheckerQty > 0) {
    return "PARTIALLY_LOADED";
  }

  if (releasedQty > 0 || availablePoolRows > 0) {
    if (deliveredQty > 0) return "PARTIALLY_DELIVERED";
    if (releasedQty > 0 && releasedQty < totalQty) {
      return "PARTIALLY_AVAILABLE_FOR_DELIVERY";
    }
    return "AVAILABLE_FOR_DELIVERY";
  }

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
  if (atDivisoriaQty > 0 && inTransitQty > 0) {
    return "PARTIALLY_LOADED";
  }

  return "RECEIVED";
}

module.exports = {
  normalizePackageStatus,
  allPiecesDelivered,
  deriveMasterShipmentStatus,
  computePackageBreakdown,
};
