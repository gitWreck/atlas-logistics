function normalizeStatus(value) {
  return String(value || "").trim().toUpperCase();
}

function pieceQty(pkg = {}) {
  const qty = Number(pkg.quantity);
  return Number.isFinite(qty) && qty > 0 ? qty : 1;
}

function isAtWarehouse(pkg = {}) {
  const status = normalizeStatus(pkg.status);
  if (["DELIVERED", "MISSING", "DAMAGED", "CANCELLED"].includes(status)) {
    return false;
  }
  if (pkg.availableForDelivery === true) return true;
  if (status === "AVAILABLE_AT_WAREHOUSE") return true;
  if (
    status === "RETURNED_RECEIVED_AT_HUB" ||
    status === "RETURNED_TO_WAREHOUSE"
  ) {
    return true;
  }
  const custody = normalizeStatus(pkg.custodyOwnerType);
  return custody === "WAREHOUSE" && !pkg.loadedByCheckerId;
}

export function countShipmentDeliveryPool(packages = []) {
  const stats = {
    total: 0,
    atWarehouse: 0,
    delivered: 0,
    failed: 0,
    returned: 0,
    onChecker: {},
  };

  packages.forEach((pkg) => {
    const qty = pieceQty(pkg);
    stats.total += qty;

    const status = normalizeStatus(pkg.status);
    if (status === "DELIVERED" || status === "COMPLETED") {
      stats.delivered += qty;
      return;
    }
    if (status === "FAILED_DELIVERY") {
      stats.failed += qty;
      return;
    }
    if (
      status === "RETURNED_TO_WAREHOUSE" ||
      status === "RETURNED_RECEIVED_AT_HUB"
    ) {
      stats.returned += qty;
      return;
    }
    if (isAtWarehouse(pkg)) {
      stats.atWarehouse += qty;
      return;
    }

    const checkerLabel =
      pkg.loadedByCheckerName ||
      pkg.loadedByCheckerId ||
      "Checker";
    stats.onChecker[checkerLabel] =
      (stats.onChecker[checkerLabel] || 0) + qty;
  });

  return stats;
}

export function aggregateTripDeliveryPool(shipments = []) {
  const merged = {
    total: 0,
    atWarehouse: 0,
    delivered: 0,
    failed: 0,
    returned: 0,
    onChecker: {},
  };

  shipments.forEach((shipment) => {
    const row = countShipmentDeliveryPool(
      Array.isArray(shipment?.packages) ? shipment.packages : [],
    );
    merged.total += row.total;
    merged.atWarehouse += row.atWarehouse;
    merged.delivered += row.delivered;
    merged.failed += row.failed;
    merged.returned += row.returned;
    Object.entries(row.onChecker).forEach(([checker, qty]) => {
      merged.onChecker[checker] = (merged.onChecker[checker] || 0) + qty;
    });
  });

  return merged;
}

export function formatTripDeliveryPoolLine(stats = {}) {
  const parts = [];
  if (stats.atWarehouse > 0) {
    parts.push(`${stats.atWarehouse} @ warehouse`);
  }
  Object.entries(stats.onChecker || {}).forEach(([checker, qty]) => {
    parts.push(`${qty} ${checker}`);
  });
  if (stats.delivered > 0) parts.push(`${stats.delivered} delivered`);
  if (stats.failed > 0) parts.push(`${stats.failed} failed`);
  if (stats.returned > 0) parts.push(`${stats.returned} returned`);
  return parts.length ? parts.join(" · ") : "No piece counts yet";
}
