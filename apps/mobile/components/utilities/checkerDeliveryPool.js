function normalizeStatus(value) {
  return String(value || "").trim().toUpperCase();
}

/** Master statuses that may appear in the checker pool after Rose release. */
const DELIVERY_POOL_MASTER_STATUSES = new Set([
  "AVAILABLE_FOR_DELIVERY",
  "PARTIALLY_DELIVERED",
  "PARTIALLY_AVAILABLE_FOR_DELIVERY",
  "PARTIALLY_LOADED",
  "LOADED",
  "READY_FOR_DELIVERY",
  "OUT_FOR_DELIVERY",
  "RECONCILED",
  "UNLOADED",
  "ARRIVED",
  "PARTIALLY_IN_TRANSIT",
  "PARTIALLY_ARRIVED",
  "RETURNED_RECEIVED_AT_ODIONGAN",
  "RETURNED_RECEIVED_AT_HUB",
  "FAILED_DELIVERY",
  "COMPLETED",
]);

/**
 * Stale `availableForDelivery` can remain after manual status reverts (e.g. RECEIVED).
 */
export function isShipmentInDeliveryPool(shipment = {}) {
  if (shipment?.availableForDelivery !== true) return false;
  const master = normalizeStatus(shipment.status);
  return DELIVERY_POOL_MASTER_STATUSES.has(master);
}

function pieceQuantity(pkg = {}) {
  const qty = Number(pkg.quantity);
  return Number.isFinite(qty) && qty > 0 ? qty : 1;
}

/**
 * Pool-eligible piece at Odiongan (Step 2.7 / 3.7).
 * Requires shipment-level release unless piece still has release flag.
 */
function isAvailableAtWarehouse(pkg = {}, shipment = {}) {
  if (!isShipmentInDeliveryPool(shipment)) return false;
  const poolReleased = shipment?.availableForDelivery === true;
  const status = normalizeStatus(pkg.status);
  if (["DELIVERED", "MISSING", "DAMAGED", "CANCELLED"].includes(status)) {
    return false;
  }
  if (
    status === "RETURNED_TO_WAREHOUSE" ||
    status === "RETURNED_RECEIVED_AT_HUB" ||
    status === "RETURNED_RECEIVED_AT_ODIONGAN"
  ) {
    return false;
  }
  if (!poolReleased && pkg.availableForDelivery !== true) {
    return false;
  }
  if (pkg.availableForDelivery === true && poolReleased) return true;
  if (status === "AVAILABLE_AT_WAREHOUSE" && poolReleased) return true;
  if (
    ["AVAILABLE_AT_ODIONGAN_WAREHOUSE", "RELEASED_FOR_DELIVERY"].includes(
      status,
    ) &&
    poolReleased
  ) {
    return true;
  }
  const custody = normalizeStatus(pkg.custodyOwnerType);
  if (custody === "WAREHOUSE" && !pkg.loadedByCheckerId && poolReleased) {
    return true;
  }
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

/** Piece statuses that count as on this checker's van (My Route / My Load). */
const ON_VAN_PIECE_STATUSES = new Set([
  "LOADED_TO_DELIVERY_VEHICLE",
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

    if (isAvailableAtWarehouse(pkg, shipment)) {
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

/** Shipments Rose released to the checker pool (Firestore + piece rules). */
export function isAvailableToLoadShipment(shipment = {}) {
  if (!isShipmentInDeliveryPool(shipment)) {
    return false;
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
    if (
      [
        "LOADED_TO_DELIVERY_VEHICLE",
        "LOADED",
        "READY_FOR_DELIVERY",
        "PARTIALLY_LOADED",
      ].includes(status)
    ) {
      myOnVan += qty;
    }
  });

  if (myOfd > 0) return "deliver";
  if (myFailed > 0) return "return";
  if (myOnVan > 0) return "out_for_delivery";
  if (myDelivered > 0) return null;

  return null;
}

const AWAITING_OUT_FOR_DELIVERY_STATUSES = new Set([
  "LOADED_TO_DELIVERY_VEHICLE",
  "LOADED",
  "READY_FOR_DELIVERY",
  "PARTIALLY_LOADED",
]);

/** Piece loaded on this checker's van but not yet marked out for delivery. */
export function isCheckerPieceAwaitingOutForDelivery(pkg = {}, checkerUid = null) {
  if (!checkerUid || !isMyPiece(pkg, checkerUid)) return false;
  return AWAITING_OUT_FOR_DELIVERY_STATUSES.has(normalizeStatus(pkg.status));
}

export function shipmentHasCheckerPiecesAwaitingOutForDelivery(
  shipment = {},
  checkerUid = null,
) {
  if (!checkerUid) return false;
  const packages = Array.isArray(shipment.packages) ? shipment.packages : [];
  return packages.some((pkg) =>
    isCheckerPieceAwaitingOutForDelivery(pkg, checkerUid),
  );
}

export function formatPoolCountLine(stats = {}) {
  const parts = [];
  if (stats.available > 0) parts.push(`${stats.available} at warehouse`);
  if (stats.mine > 0) parts.push(`${stats.mine} on your van`);
  if (stats.others > 0) parts.push(`${stats.others} with other checkers`);
  if (stats.delivered > 0) parts.push(`${stats.delivered} delivered`);
  return parts.length ? parts.join(" · ") : "No pieces tracked";
}
