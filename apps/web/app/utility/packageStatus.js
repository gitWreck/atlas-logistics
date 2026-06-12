const PACKAGE_STATUS_LABELS = {
  RECEIVED_AT_DIVISORIA: "Received at Divisoria",
  LOADED_TO_TRIP: "Loaded to trip",
  IN_TRANSIT: "In transit",
  ARRIVED_AT_ODIONGAN: "Arrived at Odiongan",
  AVAILABLE_AT_ODIONGAN_WAREHOUSE: "Available at Odiongan",
  RELEASED_FOR_DELIVERY: "Released for delivery",
  LOADED_TO_DELIVERY_VEHICLE: "Loaded to delivery vehicle",
  READY_FOR_DELIVERY: "Ready for delivery",
  OUT_FOR_DELIVERY: "Out for delivery",
  DELIVERED: "Delivered",
  RETURNED_TO_WAREHOUSE: "Returned to warehouse",
  RETURNED_RECEIVED_AT_ODIONGAN: "Returned received at Odiongan",
  RETURNED_RECEIVED_AT_HUB: "Returned received at Odiongan",
  MISSING: "Missing",
  DAMAGED: "Damaged",
  FAILED_DELIVERY: "Failed delivery",
  CANCELLED: "Cancelled",
  RECEIVED: "Received at Divisoria",
  LOADED: "Loaded",
  PARTIALLY_LOADED: "Partially loaded",
  AVAILABLE_AT_WAREHOUSE: "Available at Odiongan",
  COMPLETED: "Delivered",
  PARTIALLY_DELIVERED: "Partially delivered",
  PARTIALLY_IN_TRANSIT: "Partially in transit",
  PARTIALLY_ARRIVED: "Partially arrived",
  PARTIALLY_AVAILABLE_FOR_DELIVERY: "Partially available for delivery",
  AVAILABLE_FOR_DELIVERY: "Available for delivery",
};

const BREAKDOWN_LABELS = [
  { key: "atDivisoria", label: "At Divisoria" },
  { key: "inTransit", label: "In transit" },
  { key: "atOdiongan", label: "At Odiongan" },
  { key: "releasedForDelivery", label: "Released for delivery" },
  { key: "onCheckerVan", label: "On checker van" },
  { key: "outForDelivery", label: "Out for delivery" },
  { key: "delivered", label: "Delivered" },
  { key: "returned", label: "Returned" },
  { key: "missing", label: "Missing" },
  { key: "damaged", label: "Damaged" },
  { key: "failed", label: "Failed delivery" },
];

function normalizeStatus(value = "") {
  return String(value || "")
    .trim()
    .toUpperCase();
}

export function getPackageStatusLabel(statusOrPkg, pkgMaybe = null) {
  const pkg =
    statusOrPkg && typeof statusOrPkg === "object" ? statusOrPkg : pkgMaybe;
  const status = normalizeStatus(
    statusOrPkg && typeof statusOrPkg === "object"
      ? statusOrPkg.status
      : statusOrPkg,
  );

  if (PACKAGE_STATUS_LABELS[status]) {
    return PACKAGE_STATUS_LABELS[status];
  }

  return status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function getShipmentStatusLabel(status = "") {
  return getPackageStatusLabel(status);
}

function pieceQty(pkg = {}) {
  const qty = Number(pkg.quantity);
  return Number.isFinite(qty) && qty > 0 ? qty : 1;
}

function classifyPackageBucket(pkg = {}) {
  const status = normalizeStatus(pkg.status);
  const qty = pieceQty(pkg);

  if (["DELIVERED", "COMPLETED"].includes(status)) {
    return { bucket: "delivered", qty };
  }
  if (status === "MISSING") return { bucket: "missing", qty };
  if (status === "DAMAGED") return { bucket: "damaged", qty };
  if (status === "FAILED_DELIVERY") return { bucket: "failed", qty };
  if (
    [
      "RETURNED_TO_WAREHOUSE",
      "RETURNED_RECEIVED_AT_ODIONGAN",
      "RETURNED_RECEIVED_AT_HUB",
    ].includes(status)
  ) {
    return { bucket: "returned", qty };
  }
  if (status === "OUT_FOR_DELIVERY") return { bucket: "outForDelivery", qty };
  if (
    [
      "LOADED_TO_DELIVERY_VEHICLE",
      "LOADED",
      "READY_FOR_DELIVERY",
      "PARTIALLY_LOADED",
    ].includes(status) ||
    (normalizeStatus(pkg.custodyOwnerType) === "CHECKER" &&
      !["DELIVERED", "COMPLETED"].includes(status))
  ) {
    return { bucket: "onCheckerVan", qty };
  }
  if (["IN_TRANSIT", "LOADED_TO_TRIP"].includes(status)) {
    return { bucket: "inTransit", qty };
  }
  if (
    status === "RELEASED_FOR_DELIVERY" ||
    (pkg.availableForDelivery === true &&
      [
        "AVAILABLE_AT_WAREHOUSE",
        "AVAILABLE_AT_ODIONGAN_WAREHOUSE",
        "ARRIVED_AT_ODIONGAN",
      ].includes(status))
  ) {
    return { bucket: "releasedForDelivery", qty };
  }
  if (
    [
      "ARRIVED_AT_ODIONGAN",
      "AVAILABLE_AT_ODIONGAN_WAREHOUSE",
      "RETURNED_RECEIVED_AT_ODIONGAN",
      "RETURNED_RECEIVED_AT_HUB",
    ].includes(status)
  ) {
    return { bucket: "atOdiongan", qty };
  }
  if (["RECEIVED_AT_DIVISORIA", "RECEIVED"].includes(status)) {
    return { bucket: "atDivisoria", qty };
  }

  return { bucket: "atDivisoria", qty };
}

export function computePackageBreakdown(packages = []) {
  const breakdown = {
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

export function resolveShipmentPackageBreakdown(shipment = {}) {
  if (
    shipment.packageBreakdown &&
    typeof shipment.packageBreakdown === "object" &&
    Number(shipment.packageBreakdown.total) >= 0
  ) {
    return shipment.packageBreakdown;
  }

  return computePackageBreakdown(
    Array.isArray(shipment.packages) ? shipment.packages : [],
  );
}

const DIVISORIA_HUB_STATUSES = new Set([
  "RECEIVED",
  "PENDING_PICKUP",
  "PICKED_UP",
]);

const ODIONGAN_RECONCILED_FALLBACK_STATUSES = new Set([
  "ARRIVED",
  "PARTIALLY_ARRIVED",
  "ARRIVED_AT_ODIONGAN",
  "AVAILABLE_AT_WAREHOUSE",
  "AVAILABLE_AT_ODIONGAN_WAREHOUSE",
  "AVAILABLE_FOR_DELIVERY",
  "PARTIALLY_AVAILABLE_FOR_DELIVERY",
  "RELEASED_FOR_DELIVERY",
  "READY_FOR_DELIVERY",
]);

const TRIP_DEPARTED_FROM_DIVISORIA_STATUSES = new Set([
  "IN_TRANSIT",
  "ARRIVED",
  "UNLOADING",
  "COMPLETED",
  "DELIVERED",
  "OUT_FOR_DELIVERY",
  "CANCELLED",
]);

const DIVISORIA_DOCK_SHIPMENT_STATUSES = new Set([
  "RECEIVED",
  "RECEIVED_AT_DIVISORIA",
  "ASSIGNED",
  "LOADING",
  "LOADED",
  "PARTIALLY_LOADED",
]);

function readPhysicalWarehouseHub(shipment = {}) {
  const currentWarehouse = shipment?.currentWarehouse || {};
  const code = String(
    shipment?.currentWarehouseCode || currentWarehouse.code || "",
  ).toUpperCase();
  const name = String(
    shipment?.currentWarehouseName || currentWarehouse.name || "",
  ).toLowerCase();

  if (!code && !name) return null;
  if (code === "DIV" || name.includes("divisoria")) return "divisoria";
  if (code === "ODI" || name.includes("odiongan")) return "odiongan";
  return null;
}

function isTripReconciledAtOdiongan(shipment = {}) {
  const trip = shipment?.truckDetails || {};
  return (
    !!trip.reconciledAt ||
    String(trip.manifestStatus || "").toUpperCase() === "RECONCILED"
  );
}

/** Trip still at Divisoria dock — loaded but not yet dispatched. */
function isTripStillAtDivisoriaOrigin(shipment = {}) {
  const trip = shipment?.truckDetails;
  if (!trip) return !!shipment?.currentTripId;

  const status = normalizeStatus(trip.status);
  return !TRIP_DEPARTED_FROM_DIVISORIA_STATUSES.has(status);
}

function getDivisoriaHubPieceCount(shipment = {}, breakdown = {}) {
  let count = Number(breakdown.atDivisoria || 0);

  const inTransitQty = Number(breakdown.inTransit || 0);
  if (inTransitQty > 0 && isTripStillAtDivisoriaOrigin(shipment)) {
    // LOADED_TO_TRIP on a truck that has not departed — still physically at Divisoria.
    count += inTransitQty;
  }

  return count;
}

/** Pieces at Odiongan after unload/reconcile or released to delivery ops from Odiongan. */
function getOdionganWarehousePieceCount(breakdown = {}) {
  return (
    Number(breakdown.atOdiongan || 0) +
    Number(breakdown.releasedForDelivery || 0) +
    Number(breakdown.onCheckerVan || 0)
  );
}

/** True when shipment has cargo at Divisoria hub (not merely routed from there). */
export function shipmentMatchesDivisoriaHub(shipment = {}) {
  const explicitHub = readPhysicalWarehouseHub(shipment);
  if (explicitHub === "odiongan") return false;
  if (explicitHub === "divisoria") return true;

  const breakdown = resolveShipmentPackageBreakdown(shipment);
  if (getDivisoriaHubPieceCount(shipment, breakdown) > 0) return true;
  if (breakdown.total > 0) return false;

  const status = normalizeStatus(shipment.status);
  if (
    isTripStillAtDivisoriaOrigin(shipment) &&
    DIVISORIA_DOCK_SHIPMENT_STATUSES.has(status)
  ) {
    return true;
  }

  return DIVISORIA_HUB_STATUSES.has(status);
}

/**
 * Odiongan Warehouse tab: at least one piece at Odiongan after unload/reconcile,
 * or in the Odiongan delivery-ops pool. Partial arrivals are included (e.g. 1/4
 * arrived, 3/4 still on truck). Excludes shipments with zero Odiongan inventory.
 */
export function shipmentMatchesOdionganHub(shipment = {}) {
  const breakdown = resolveShipmentPackageBreakdown(shipment);

  if (breakdown.total > 0) {
    return getOdionganWarehousePieceCount(breakdown) > 0;
  }

  const status = normalizeStatus(shipment.status);
  if (status === "PARTIALLY_ARRIVED") return true;

  if (!isTripReconciledAtOdiongan(shipment)) return false;

  const explicitHub = readPhysicalWarehouseHub(shipment);
  if (explicitHub === "divisoria") return false;

  return ODIONGAN_RECONCILED_FALLBACK_STATUSES.has(status);
}

/** Human label for shipments shown on the Odiongan warehouse tab. */
export function getOdionganHubBoardStatusLabel(shipment = {}) {
  const breakdown = resolveShipmentPackageBreakdown(shipment);
  const reconciled = isTripReconciledAtOdiongan(shipment);

  if (Number(breakdown.releasedForDelivery || 0) > 0) {
    return "Released for delivery";
  }
  if (Number(breakdown.onCheckerVan || 0) > 0) {
    return "Ready for delivery";
  }
  const atOdionganQty = Number(breakdown.atOdiongan || 0);
  const stillInTransitQty = Number(breakdown.inTransit || 0);
  const isPartialArrival =
    atOdionganQty > 0 &&
    stillInTransitQty > 0 &&
    !isTripStillAtDivisoriaOrigin(shipment);

  if (isPartialArrival) {
    return "Partially arrived at Odiongan";
  }
  if (reconciled && atOdionganQty > 0) {
    return "Reconciled";
  }
  if (atOdionganQty > 0) {
    return "Arrived at Odiongan";
  }

  const status = normalizeStatus(shipment.status);
  if (
    status === "RELEASED_FOR_DELIVERY" ||
    status === "AVAILABLE_FOR_DELIVERY" ||
    status === "PARTIALLY_AVAILABLE_FOR_DELIVERY"
  ) {
    return "Released for delivery";
  }
  if (status === "READY_FOR_DELIVERY") {
    return "Ready for delivery";
  }
  if (reconciled) {
    return "Reconciled";
  }
  if (
    [
      "ARRIVED",
      "PARTIALLY_ARRIVED",
      "ARRIVED_AT_ODIONGAN",
      "AVAILABLE_AT_ODIONGAN_WAREHOUSE",
      "AVAILABLE_AT_WAREHOUSE",
    ].includes(status)
  ) {
    return "Arrived at Odiongan";
  }

  return getShipmentStatusLabel(shipment.status);
}

/** Status key for badge styling on the Odiongan warehouse tab. */
export function getOdionganHubBoardStatusKey(shipment = {}) {
  const label = getOdionganHubBoardStatusLabel(shipment);
  if (label === "Released for delivery") return "RELEASED_FOR_DELIVERY";
  if (label === "Ready for delivery") return "READY_FOR_DELIVERY";
  if (label === "Reconciled") return "RECONCILED";
  if (label === "Arrived at Odiongan") return "ARRIVED_AT_ODIONGAN";
  if (label === "Partially arrived at Odiongan") return "PARTIALLY_ARRIVED";
  return normalizeStatus(shipment.status);
}

export function getActiveBreakdownRows(breakdown = {}) {
  return BREAKDOWN_LABELS.filter(
    ({ key }) => Number(breakdown[key] || 0) > 0,
  ).map(({ key, label }) => ({
    key,
    label,
    count: Number(breakdown[key] || 0),
  }));
}

export { BREAKDOWN_LABELS, PACKAGE_STATUS_LABELS };
