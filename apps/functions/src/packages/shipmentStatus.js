"use strict";

function normalizePackageStatus(pkg) {
  return String(pkg?.status || "RECEIVED")
    .trim()
    .toUpperCase();
}

/**
 * Derive master shipment status from package rows and optional qty totals.
 * Client Task 9: mixed delivery states → PARTIALLY_DELIVERED (not DELIVERED).
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

  const statuses = packages.map(normalizePackageStatus);
  const totalRows = statuses.length;
  const count = (status) => statuses.filter((value) => value === status).length;

  const deliveredRows = count("DELIVERED");
  const missingRows = count("MISSING");
  const damagedRows = count("DAMAGED");
  const outForDeliveryRows = count("OUT_FOR_DELIVERY");
  const loadedRows = count("LOADED");
  const partiallyLoadedRows = count("PARTIALLY_LOADED");
  const readyForDeliveryRows = count("READY_FOR_DELIVERY");
  const availableAtWarehouseRows = count("AVAILABLE_AT_WAREHOUSE");

  if (totals) {
    const totalQty = Number(totals.totalQty) || 0;
    const receivedQty = Number(totals.receivedQty) || 0;
    const loadedQty = Number(totals.loadedQty) || 0;
    const missingQty = Number(totals.missingQty) || 0;
    const damagedQty = Number(totals.damagedQty) || 0;

    if (totalQty > 0 && receivedQty >= totalQty) {
      return "DELIVERED";
    }
    if (totalQty > 0 && damagedQty >= totalQty) {
      return "DAMAGED";
    }
    if (totalQty > 0 && missingQty >= totalQty) {
      return "MISSING";
    }
    if (receivedQty > 0 && receivedQty < totalQty) {
      return "PARTIALLY_DELIVERED";
    }

    if (shouldPromoteOutForDelivery) {
      return "OUT_FOR_DELIVERY";
    }
    if (totalQty > 0 && loadedQty >= totalQty) {
      return "LOADED";
    }
    if (loadedQty > 0) {
      return "PARTIALLY_LOADED";
    }
  }

  if (deliveredRows === totalRows) {
    return "DELIVERED";
  }
  if (missingRows === totalRows) {
    return "MISSING";
  }
  if (damagedRows === totalRows) {
    return "DAMAGED";
  }

  if (deliveredRows > 0 && deliveredRows < totalRows) {
    return "PARTIALLY_DELIVERED";
  }

  if (shouldPromoteOutForDelivery) {
    return "OUT_FOR_DELIVERY";
  }

  if (outForDeliveryRows === totalRows) {
    return "OUT_FOR_DELIVERY";
  }
  if (outForDeliveryRows > 0 && deliveredRows === 0) {
    return "OUT_FOR_DELIVERY";
  }

  if (loadedRows === totalRows) {
    return "LOADED";
  }
  if (loadedRows > 0 || partiallyLoadedRows > 0) {
    return "PARTIALLY_LOADED";
  }

  if (availableAtWarehouseRows === totalRows) {
    return "AVAILABLE_FOR_DELIVERY";
  }
  if (availableAtWarehouseRows > 0 && loadedRows === 0 && deliveredRows === 0) {
    return "AVAILABLE_FOR_DELIVERY";
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

  return "RECEIVED";
}

module.exports = {
  normalizePackageStatus,
  deriveMasterShipmentStatus,
};
