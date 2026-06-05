"use strict";

const DIVISORIA_WAREHOUSE = "DIVISORIA_WAREHOUSE";
const ODIONGAN_WAREHOUSE = "ODIONGAN_WAREHOUSE";

const PACKAGE_STATUS = Object.freeze({
  RECEIVED_AT_DIVISORIA: "RECEIVED_AT_DIVISORIA",
  LOADED_TO_TRIP: "LOADED_TO_TRIP",
  IN_TRANSIT: "IN_TRANSIT",
  ARRIVED_AT_ODIONGAN: "ARRIVED_AT_ODIONGAN",
  AVAILABLE_AT_ODIONGAN_WAREHOUSE: "AVAILABLE_AT_ODIONGAN_WAREHOUSE",
  RELEASED_FOR_DELIVERY: "RELEASED_FOR_DELIVERY",
  LOADED_TO_DELIVERY_VEHICLE: "LOADED_TO_DELIVERY_VEHICLE",
  READY_FOR_DELIVERY: "READY_FOR_DELIVERY",
  OUT_FOR_DELIVERY: "OUT_FOR_DELIVERY",
  DELIVERED: "DELIVERED",
  RETURNED_TO_WAREHOUSE: "RETURNED_TO_WAREHOUSE",
  RETURNED_RECEIVED_AT_ODIONGAN: "RETURNED_RECEIVED_AT_ODIONGAN",
  MISSING: "MISSING",
  DAMAGED: "DAMAGED",
  FAILED_DELIVERY: "FAILED_DELIVERY",
  CANCELLED: "CANCELLED",
  // Legacy / transitional codes still stored on older rows
  RECEIVED: "RECEIVED",
  LOADED: "LOADED",
  PARTIALLY_LOADED: "PARTIALLY_LOADED",
  AVAILABLE_AT_WAREHOUSE: "AVAILABLE_AT_WAREHOUSE",
  RETURNED_RECEIVED_AT_HUB: "RETURNED_RECEIVED_AT_HUB",
  COMPLETED: "COMPLETED",
});

const PACKAGE_STATUS_LABELS = Object.freeze({
  [PACKAGE_STATUS.RECEIVED_AT_DIVISORIA]: "Received at Divisoria",
  [PACKAGE_STATUS.LOADED_TO_TRIP]: "Loaded to trip",
  [PACKAGE_STATUS.IN_TRANSIT]: "In transit",
  [PACKAGE_STATUS.ARRIVED_AT_ODIONGAN]: "Arrived at Odiongan",
  [PACKAGE_STATUS.AVAILABLE_AT_ODIONGAN_WAREHOUSE]:
    "Available at Odiongan",
  [PACKAGE_STATUS.RELEASED_FOR_DELIVERY]: "Released for delivery",
  [PACKAGE_STATUS.LOADED_TO_DELIVERY_VEHICLE]: "Loaded to delivery vehicle",
  [PACKAGE_STATUS.READY_FOR_DELIVERY]: "Ready for delivery",
  [PACKAGE_STATUS.OUT_FOR_DELIVERY]: "Out for delivery",
  [PACKAGE_STATUS.DELIVERED]: "Delivered",
  [PACKAGE_STATUS.RETURNED_TO_WAREHOUSE]: "Returned to warehouse",
  [PACKAGE_STATUS.RETURNED_RECEIVED_AT_ODIONGAN]:
    "Returned received at Odiongan",
  [PACKAGE_STATUS.MISSING]: "Missing",
  [PACKAGE_STATUS.DAMAGED]: "Damaged",
  [PACKAGE_STATUS.FAILED_DELIVERY]: "Failed delivery",
  [PACKAGE_STATUS.CANCELLED]: "Cancelled",
  [PACKAGE_STATUS.RECEIVED]: "Received at Divisoria",
  [PACKAGE_STATUS.LOADED]: "Loaded",
  [PACKAGE_STATUS.PARTIALLY_LOADED]: "Partially loaded",
  [PACKAGE_STATUS.AVAILABLE_AT_WAREHOUSE]: "Available at Odiongan",
  [PACKAGE_STATUS.RETURNED_RECEIVED_AT_HUB]: "Returned received at Odiongan",
  [PACKAGE_STATUS.COMPLETED]: "Delivered",
});

const DELIVERED_STATUSES = new Set([
  PACKAGE_STATUS.DELIVERED,
  PACKAGE_STATUS.COMPLETED,
]);

const TERMINAL_STATUSES = new Set([
  PACKAGE_STATUS.DELIVERED,
  PACKAGE_STATUS.COMPLETED,
  PACKAGE_STATUS.MISSING,
  PACKAGE_STATUS.DAMAGED,
  PACKAGE_STATUS.CANCELLED,
]);

const AT_DIVISORIA_STATUSES = new Set([
  PACKAGE_STATUS.RECEIVED_AT_DIVISORIA,
  PACKAGE_STATUS.RECEIVED,
]);

const IN_TRANSIT_STATUSES = new Set([
  PACKAGE_STATUS.IN_TRANSIT,
  PACKAGE_STATUS.LOADED_TO_TRIP,
]);

const AT_ODIONGAN_STATUSES = new Set([
  PACKAGE_STATUS.ARRIVED_AT_ODIONGAN,
  PACKAGE_STATUS.AVAILABLE_AT_ODIONGAN_WAREHOUSE,
  PACKAGE_STATUS.RETURNED_RECEIVED_AT_ODIONGAN,
  PACKAGE_STATUS.RETURNED_RECEIVED_AT_HUB,
]);

const ON_CHECKER_VAN_STATUSES = new Set([
  PACKAGE_STATUS.LOADED_TO_DELIVERY_VEHICLE,
  PACKAGE_STATUS.LOADED,
  PACKAGE_STATUS.READY_FOR_DELIVERY,
  PACKAGE_STATUS.PARTIALLY_LOADED,
]);

const OUT_FOR_DELIVERY_STATUSES = new Set([PACKAGE_STATUS.OUT_FOR_DELIVERY]);

const RETURNED_STATUSES = new Set([
  PACKAGE_STATUS.RETURNED_TO_WAREHOUSE,
  PACKAGE_STATUS.RETURNED_RECEIVED_AT_ODIONGAN,
  PACKAGE_STATUS.RETURNED_RECEIVED_AT_HUB,
]);

const WAREHOUSE_POOL_STATUSES = new Set([
  PACKAGE_STATUS.AVAILABLE_AT_ODIONGAN_WAREHOUSE,
  PACKAGE_STATUS.AVAILABLE_AT_WAREHOUSE,
  PACKAGE_STATUS.RELEASED_FOR_DELIVERY,
]);

/** Statuses that must not be downgraded to RECEIVED_AT_DIVISORIA when qty is zero. */
const PRESERVED_WHEN_UNLOADED_STATUSES = new Set([
  ...IN_TRANSIT_STATUSES,
  ...AT_ODIONGAN_STATUSES,
  ...WAREHOUSE_POOL_STATUSES,
  ...ON_CHECKER_VAN_STATUSES,
  ...OUT_FOR_DELIVERY_STATUSES,
  ...RETURNED_STATUSES,
  PACKAGE_STATUS.DELIVERED,
  PACKAGE_STATUS.MISSING,
  PACKAGE_STATUS.DAMAGED,
  PACKAGE_STATUS.FAILED_DELIVERY,
]);

function wasOnLinehaulTrip(pkg = {}) {
  if (String(pkg.loadedOnTrip || "").trim()) return true;
  if (String(pkg.currentTripId || "").trim()) return true;
  const status = normalizePackageStatusCode(pkg.status, pkg);
  return (
    IN_TRANSIT_STATUSES.has(status) ||
    status === PACKAGE_STATUS.LOADED ||
    status === PACKAGE_STATUS.LOADED_TO_TRIP
  );
}

/**
 * After offloading from a linehaul trip at the destination hub → Odiongan.
 * Only brand-new origin intake stays at Divisoria.
 */
function resolveHubUnloadStatus(pkg = {}) {
  if (wasOnLinehaulTrip(pkg)) {
    return PACKAGE_STATUS.ARRIVED_AT_ODIONGAN;
  }
  return PACKAGE_STATUS.RECEIVED_AT_DIVISORIA;
}

function normalizeQty(value, fallback = 1) {
  const num = Number(value);
  return Number.isFinite(num) && num >= 0 ? num : fallback;
}

function pieceQty(pkg = {}) {
  return Math.max(normalizeQty(pkg.quantity, 1), 1);
}

function normalizeWarehouseCode(custodyOwnerId = "") {
  const id = String(custodyOwnerId || "").trim().toUpperCase();
  if (!id) return ODIONGAN_WAREHOUSE;
  if (id.includes("DIVISORIA")) return DIVISORIA_WAREHOUSE;
  if (id.includes("ODIONGAN")) return ODIONGAN_WAREHOUSE;
  return id;
}

function normalizeCustodyType(pkg = {}) {
  return String(pkg.custodyOwnerType || "").trim().toUpperCase();
}

/**
 * Canonical status code for a package row (maps legacy codes + custody hints).
 */
function normalizePackageStatusCode(status, pkg = {}) {
  const raw = String(status || "").trim().toUpperCase();
  const custody = normalizeCustodyType(pkg);
  const warehouse = normalizeWarehouseCode(pkg.custodyOwnerId);

  if (raw === PACKAGE_STATUS.AVAILABLE_AT_WAREHOUSE) {
    if (pkg.availableForDelivery === true) {
      return PACKAGE_STATUS.RELEASED_FOR_DELIVERY;
    }
    if (warehouse === DIVISORIA_WAREHOUSE) {
      return PACKAGE_STATUS.RECEIVED_AT_DIVISORIA;
    }
    return PACKAGE_STATUS.AVAILABLE_AT_ODIONGAN_WAREHOUSE;
  }

  if (raw === PACKAGE_STATUS.RETURNED_RECEIVED_AT_HUB) {
    return PACKAGE_STATUS.RETURNED_RECEIVED_AT_ODIONGAN;
  }

  if (raw === PACKAGE_STATUS.RECEIVED && !pkg.currentTripId && !pkg.loadedOnTrip) {
    return PACKAGE_STATUS.RECEIVED_AT_DIVISORIA;
  }

  if (raw === PACKAGE_STATUS.LOADED) {
    if (custody === "CHECKER" || pkg.loadedByCheckerId) {
      return PACKAGE_STATUS.LOADED_TO_DELIVERY_VEHICLE;
    }
    if (pkg.currentTripId || pkg.loadedOnTrip) {
      return PACKAGE_STATUS.LOADED_TO_TRIP;
    }
  }

  if (
    raw === PACKAGE_STATUS.AVAILABLE_AT_ODIONGAN_WAREHOUSE &&
    pkg.availableForDelivery === true
  ) {
    return PACKAGE_STATUS.RELEASED_FOR_DELIVERY;
  }

  return raw || PACKAGE_STATUS.RECEIVED_AT_DIVISORIA;
}

function normalizePackageStatus(pkg = {}) {
  return normalizePackageStatusCode(pkg.status, pkg);
}

function getPackageStatusLabel(statusOrPkg, pkgMaybe = null) {
  const pkg =
    statusOrPkg && typeof statusOrPkg === "object" ? statusOrPkg : pkgMaybe;
  const status =
    statusOrPkg && typeof statusOrPkg === "object"
      ? normalizePackageStatus(statusOrPkg)
      : normalizePackageStatusCode(statusOrPkg, pkg || {});

  if (PACKAGE_STATUS_LABELS[status]) {
    return PACKAGE_STATUS_LABELS[status];
  }

  return String(status || "Unknown")
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function isAvailableAtWarehousePool(pkg = {}) {
  const status = normalizePackageStatus(pkg);
  if (TERMINAL_STATUSES.has(status)) return false;
  if (RETURNED_STATUSES.has(status)) return false;
  if (status === PACKAGE_STATUS.FAILED_DELIVERY) return false;

  if (pkg.availableForDelivery === true) return true;
  if (WAREHOUSE_POOL_STATUSES.has(status)) return true;

  return (
    normalizeCustodyType(pkg) === "WAREHOUSE" &&
    !pkg.loadedByCheckerId &&
    normalizeWarehouseCode(pkg.custodyOwnerId) === ODIONGAN_WAREHOUSE
  );
}

function isReleasedForDeliveryPool(pkg = {}) {
  const status = normalizePackageStatus(pkg);
  if (status === PACKAGE_STATUS.RELEASED_FOR_DELIVERY) return true;
  return (
    pkg.availableForDelivery === true &&
    (WAREHOUSE_POOL_STATUSES.has(status) ||
      AT_ODIONGAN_STATUSES.has(status) ||
      normalizeCustodyType(pkg) === "WAREHOUSE")
  );
}

function classifyPackageBucket(pkg = {}) {
  const status = normalizePackageStatus(pkg);
  const qty = pieceQty(pkg);

  if (DELIVERED_STATUSES.has(status)) {
    return { bucket: "delivered", qty };
  }
  if (status === PACKAGE_STATUS.MISSING) {
    return { bucket: "missing", qty };
  }
  if (status === PACKAGE_STATUS.DAMAGED) {
    return { bucket: "damaged", qty };
  }
  if (status === PACKAGE_STATUS.FAILED_DELIVERY) {
    return { bucket: "failed", qty };
  }
  if (RETURNED_STATUSES.has(status)) {
    return { bucket: "returned", qty };
  }
  if (OUT_FOR_DELIVERY_STATUSES.has(status)) {
    return { bucket: "outForDelivery", qty };
  }
  if (ON_CHECKER_VAN_STATUSES.has(status)) {
    return { bucket: "onCheckerVan", qty };
  }
  if (isReleasedForDeliveryPool(pkg)) {
    return { bucket: "releasedForDelivery", qty };
  }
  if (IN_TRANSIT_STATUSES.has(status)) {
    return { bucket: "inTransit", qty };
  }
  if (AT_ODIONGAN_STATUSES.has(status)) {
    return { bucket: "atOdiongan", qty };
  }
  if (AT_DIVISORIA_STATUSES.has(status)) {
    return { bucket: "atDivisoria", qty };
  }

  if (normalizeCustodyType(pkg) === "CHECKER") {
    return { bucket: "onCheckerVan", qty };
  }

  return { bucket: "atDivisoria", qty };
}

function createEmptyPackageBreakdown() {
  return {
    total: 0,
    atDivisoria: 0,
    inTransit: 0,
    atOdiongan: 0,
    releasedForDelivery: 0,
    onCheckerVan: 0,
    outForDelivery: 0,
    delivered: 0,
    returned: 0,
    missing: 0,
    damaged: 0,
    failed: 0,
  };
}

function computePackageBreakdown(packages = []) {
  const breakdown = createEmptyPackageBreakdown();

  if (!Array.isArray(packages)) return breakdown;

  packages.forEach((pkg) => {
    const { bucket, qty } = classifyPackageBucket(pkg);
    breakdown.total += qty;
    if (Object.prototype.hasOwnProperty.call(breakdown, bucket)) {
      breakdown[bucket] += qty;
    }
  });

  return breakdown;
}

function allPiecesDelivered(packages = []) {
  if (!Array.isArray(packages) || packages.length === 0) return false;
  return packages.every((pkg) =>
    DELIVERED_STATUSES.has(normalizePackageStatus(pkg)),
  );
}

function isCustomerDeliveryComplete(pkg = {}, options = {}) {
  const { isDeliveryTrip = false } = options;
  if (normalizeCustodyType(pkg) === "CUSTOMER") return true;
  if (pkg.deliveredAt || pkg.deliveredByCheckerId) return true;
  return isDeliveryTrip;
}

function isHubReceiveComplete(pkg = {}, options = {}) {
  const { isHubReceive = false } = options;
  const storedStatus = normalizePackageStatusCode(pkg.status, pkg);

  if (isHubReceive) return true;
  if (AT_ODIONGAN_STATUSES.has(storedStatus)) return true;
  if (WAREHOUSE_POOL_STATUSES.has(storedStatus)) return true;
  if (
    normalizeCustodyType(pkg) === "WAREHOUSE" &&
    normalizeWarehouseCode(pkg.custodyOwnerId) === ODIONGAN_WAREHOUSE
  ) {
    return true;
  }
  return false;
}

/**
 * Full receivedQty means customer delivery on last-mile trips,
 * but hub offload at Odiongan — not delivered to consignee.
 */
function resolveFullyReceivedStatus(pkg = {}, options = {}) {
  const storedStatus = normalizePackageStatusCode(pkg.status, pkg);

  if (isCustomerDeliveryComplete(pkg, options)) {
    return PACKAGE_STATUS.DELIVERED;
  }
  if (isHubReceiveComplete(pkg, options)) {
    if (
      pkg.availableForDelivery === true ||
      storedStatus === PACKAGE_STATUS.RELEASED_FOR_DELIVERY
    ) {
      return PACKAGE_STATUS.RELEASED_FOR_DELIVERY;
    }
    if (AT_ODIONGAN_STATUSES.has(storedStatus)) return storedStatus;
    if (WAREHOUSE_POOL_STATUSES.has(storedStatus)) return storedStatus;
    return PACKAGE_STATUS.ARRIVED_AT_ODIONGAN;
  }

  const { isDeliveryTrip = false } = options;
  if (!isDeliveryTrip) {
    return PACKAGE_STATUS.ARRIVED_AT_ODIONGAN;
  }

  return PACKAGE_STATUS.DELIVERED;
}

/**
 * Derive display/storage status from quantity fields (scanner modal path).
 */
function derivePackageStatusFromQuantities(pkg = {}, options = {}) {
  const { isDeliveryTrip = false } = options;
  const quantity = Math.max(normalizeQty(pkg.quantity, 1), 1);
  const loadedQty = Math.min(normalizeQty(pkg.loadedQty, 0), quantity);
  const receivedQty = Math.min(normalizeQty(pkg.receivedQty, 0), quantity);
  const missingQty = Math.min(normalizeQty(pkg.missingQty, 0), quantity);
  const damagedQty = Math.min(normalizeQty(pkg.damagedQty, 0), quantity);
  const storedStatus = normalizePackageStatusCode(pkg.status, pkg);

  if (damagedQty > 0) return PACKAGE_STATUS.DAMAGED;
  if (missingQty > 0) return PACKAGE_STATUS.MISSING;
  if (receivedQty >= quantity) {
    return resolveFullyReceivedStatus(pkg, options);
  }

  // Dispatched linehaul pieces stay in transit even while loadedQty > 0.
  if (storedStatus === PACKAGE_STATUS.IN_TRANSIT) {
    return PACKAGE_STATUS.IN_TRANSIT;
  }

  if (receivedQty === 0 && loadedQty > 0) {
    if (storedStatus === PACKAGE_STATUS.OUT_FOR_DELIVERY) {
      return PACKAGE_STATUS.OUT_FOR_DELIVERY;
    }
    if (storedStatus === PACKAGE_STATUS.READY_FOR_DELIVERY) {
      return PACKAGE_STATUS.READY_FOR_DELIVERY;
    }
    if (
      WAREHOUSE_POOL_STATUSES.has(storedStatus) ||
      AT_ODIONGAN_STATUSES.has(storedStatus)
    ) {
      if (loadedQty >= quantity) {
        return isDeliveryTrip || pkg.loadedByCheckerId
          ? PACKAGE_STATUS.LOADED_TO_DELIVERY_VEHICLE
          : PACKAGE_STATUS.LOADED_TO_TRIP;
      }
      return PACKAGE_STATUS.PARTIALLY_LOADED;
    }
    if (
      storedStatus === PACKAGE_STATUS.LOADED ||
      storedStatus === PACKAGE_STATUS.LOADED_TO_TRIP ||
      storedStatus === PACKAGE_STATUS.LOADED_TO_DELIVERY_VEHICLE
    ) {
      if (loadedQty >= quantity) {
        return isDeliveryTrip || pkg.loadedByCheckerId
          ? PACKAGE_STATUS.LOADED_TO_DELIVERY_VEHICLE
          : PACKAGE_STATUS.LOADED_TO_TRIP;
      }
      return PACKAGE_STATUS.PARTIALLY_LOADED;
    }
  }

  if (loadedQty >= quantity) {
    return isDeliveryTrip || pkg.loadedByCheckerId
      ? PACKAGE_STATUS.LOADED_TO_DELIVERY_VEHICLE
      : PACKAGE_STATUS.LOADED_TO_TRIP;
  }
  if (loadedQty > 0) return PACKAGE_STATUS.PARTIALLY_LOADED;

  if (
    WAREHOUSE_POOL_STATUSES.has(storedStatus) ||
    AT_ODIONGAN_STATUSES.has(storedStatus)
  ) {
    return storedStatus;
  }

  if (PRESERVED_WHEN_UNLOADED_STATUSES.has(storedStatus)) {
    return storedStatus;
  }

  return PACKAGE_STATUS.RECEIVED_AT_DIVISORIA;
}

function resolveOdionganPoolStatus(pkg = {}, { released = false } = {}) {
  if (released || pkg.availableForDelivery === true) {
    return PACKAGE_STATUS.RELEASED_FOR_DELIVERY;
  }
  return PACKAGE_STATUS.AVAILABLE_AT_ODIONGAN_WAREHOUSE;
}

function resolveLinehaulLoadedStatus() {
  return PACKAGE_STATUS.LOADED_TO_TRIP;
}

function resolveDeliveryVehicleLoadedStatus() {
  return PACKAGE_STATUS.LOADED_TO_DELIVERY_VEHICLE;
}

function countPackagesInBucket(packages = [], bucketName) {
  return packages.reduce((sum, pkg) => {
    const { bucket, qty } = classifyPackageBucket(pkg);
    return bucket === bucketName ? sum + qty : sum;
  }, 0);
}

function countPackagesMatchingStatus(packages = [], matcher) {
  return packages.reduce((sum, pkg) => {
    const status = normalizePackageStatus(pkg);
    const matches =
      typeof matcher === "function"
        ? matcher(status, pkg)
        : matcher instanceof Set
          ? matcher.has(status)
          : status === matcher;
    return matches ? sum + pieceQty(pkg) : sum;
  }, 0);
}

module.exports = {
  DIVISORIA_WAREHOUSE,
  ODIONGAN_WAREHOUSE,
  PACKAGE_STATUS,
  PACKAGE_STATUS_LABELS,
  DELIVERED_STATUSES,
  TERMINAL_STATUSES,
  WAREHOUSE_POOL_STATUSES,
  normalizePackageStatus,
  normalizePackageStatusCode,
  normalizeWarehouseCode,
  getPackageStatusLabel,
  isAvailableAtWarehousePool,
  isReleasedForDeliveryPool,
  classifyPackageBucket,
  createEmptyPackageBreakdown,
  computePackageBreakdown,
  allPiecesDelivered,
  derivePackageStatusFromQuantities,
  resolveOdionganPoolStatus,
  resolveLinehaulLoadedStatus,
  resolveDeliveryVehicleLoadedStatus,
  resolveHubUnloadStatus,
  wasOnLinehaulTrip,
  countPackagesInBucket,
  countPackagesMatchingStatus,
  pieceQty,
};
