function normalizeStatus(value) {
  return String(value || "").trim().toUpperCase();
}

function pieceQuantity(pkg = {}) {
  const qty = Number(pkg.quantity);
  return Number.isFinite(qty) && qty > 0 ? qty : 1;
}

function isAvailableAtWarehouse(pkg = {}) {
  const status = normalizeStatus(pkg.status);
  if (["DELIVERED", "MISSING", "DAMAGED", "CANCELLED"].includes(status)) {
    return false;
  }
  if (
    status === "RETURNED_TO_WAREHOUSE" ||
    status === "RETURNED_RECEIVED_AT_HUB"
  ) {
    return false;
  }
  if (pkg.availableForDelivery === true) return true;
  if (status === "AVAILABLE_AT_WAREHOUSE") return true;
  const custody = normalizeStatus(pkg.custodyOwnerType);
  if (custody === "WAREHOUSE" && !pkg.loadedByCheckerId) return true;
  return false;
}

function isLoadedByChecker(pkg = {}, checkerUid) {
  if (!checkerUid) return false;
  return String(pkg.loadedByCheckerId || "").trim() === String(checkerUid);
}

/** Matches backend checker piece ownership (load / OFD / deliver). */
function isCheckerCustodyPiece(pkg = {}, checkerUid) {
  if (!checkerUid) return false;
  if (isLoadedByChecker(pkg, checkerUid)) return true;
  return (
    normalizeStatus(pkg.custodyOwnerType) === "CHECKER" &&
    String(pkg.custodyOwnerId || "").trim() === String(checkerUid)
  );
}

const ON_VAN_PIECE_STATUSES = new Set([
  "LOADED",
  "READY_FOR_DELIVERY",
  "PARTIALLY_LOADED",
  "OUT_FOR_DELIVERY",
]);

function isLoadedByOtherChecker(pkg = {}, checkerUid) {
  const loadedBy = String(pkg.loadedByCheckerId || "").trim();
  if (!loadedBy) return false;
  if (!checkerUid) return true;
  return loadedBy !== String(checkerUid);
}

/**
 * Piece counts for delivery pool UX (Step 3.7).
 */
export function countDeliveryPoolPieces(shipment = {}, checkerUid = null) {
  const packages = Array.isArray(shipment.packages) ? shipment.packages : [];
  const stats = {
    total: 0,
    available: 0,
    mine: 0,
    others: 0,
    delivered: 0,
  };

  packages.forEach((pkg) => {
    const qty = pieceQuantity(pkg);
    stats.total += qty;

    const status = normalizeStatus(pkg.status);
    if (status === "DELIVERED") {
      stats.delivered += qty;
      return;
    }

    if (isAvailableAtWarehouse(pkg)) {
      stats.available += qty;
      return;
    }

    if (checkerUid && isCheckerCustodyPiece(pkg, checkerUid)) {
      const status = normalizeStatus(pkg.status);
      if (
        ON_VAN_PIECE_STATUSES.has(status) ||
        status === "FAILED_DELIVERY"
      ) {
        stats.mine += qty;
        return;
      }
    }

    if (
      normalizeStatus(pkg.custodyOwnerType) === "CHECKER" ||
      isLoadedByOtherChecker(pkg, checkerUid)
    ) {
      stats.others += qty;
    }
  });

  return stats;
}

export function shipmentHasAvailablePieces(shipment = {}) {
  return countDeliveryPoolPieces(shipment).available > 0;
}

/** Shipments with inventory this checker can still load from the pool. */
export function isAvailableToLoadShipment(shipment = {}) {
  if (shipment?.availableForDelivery !== true) {
    return shipmentHasAvailablePieces(shipment);
  }
  return shipmentHasAvailablePieces(shipment);
}

/**
 * Active last-mile work for this checker (not the full warehouse pool).
 */
export function isMyActiveDeliveryShipment(shipment = {}, checkerUid) {
  if (!checkerUid) return false;

  const pool = countDeliveryPoolPieces(shipment, checkerUid);
  if (pool.mine > 0) return true;

  if (getCheckerPieceActionPhase(shipment, checkerUid)) return true;

  return false;
}

function isMyPiece(pkg = {}, checkerUid) {
  return isCheckerCustodyPiece(pkg, checkerUid);
}

/**
 * Last-mile phase for this checker based on their pieces (not master status alone).
 * @returns {'out_for_delivery'|'deliver'|'return'|null}
 */
export function getCheckerPieceActionPhase(shipment = {}, checkerUid = null) {
  if (!checkerUid) return null;

  const packages = Array.isArray(shipment.packages) ? shipment.packages : [];
  let myOnVan = 0;
  let myOfd = 0;
  let myFailed = 0;
  let myDelivered = 0;

  packages.forEach((pkg) => {
    if (!isMyPiece(pkg, checkerUid)) return;

    const status = normalizeStatus(pkg.status);
    const qty = pieceQuantity(pkg);

    if (status === "DELIVERED" || status === "COMPLETED") {
      myDelivered += qty;
      return;
    }
    if (status === "FAILED_DELIVERY") {
      myFailed += qty;
      return;
    }
    if (status === "OUT_FOR_DELIVERY") {
      myOfd += qty;
      return;
    }
    if (["LOADED", "READY_FOR_DELIVERY", "PARTIALLY_LOADED"].includes(status)) {
      myOnVan += qty;
    }
  });

  if (myOfd > 0) return "deliver";
  if (myFailed > 0) return "return";
  if (myOnVan > 0) return "out_for_delivery";
  if (myDelivered > 0) return null;

  return null;
}

export function formatPoolCountLine(stats = {}) {
  const parts = [];
  if (stats.available > 0) parts.push(`${stats.available} at warehouse`);
  if (stats.mine > 0) parts.push(`${stats.mine} on your van`);
  if (stats.others > 0) parts.push(`${stats.others} with other checkers`);
  if (stats.delivered > 0) parts.push(`${stats.delivered} delivered`);
  return parts.length ? parts.join(" · ") : "No pieces tracked";
}
