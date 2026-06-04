const PACKAGE_STATUS_LABELS = {
  RECEIVED_AT_DIVISORIA: "Received at Divisoria Warehouse",
  LOADED_TO_TRIP: "Loaded to trip",
  IN_TRANSIT: "In transit",
  ARRIVED_AT_ODIONGAN: "Arrived at Odiongan",
  AVAILABLE_AT_ODIONGAN_WAREHOUSE: "Available at Odiongan Warehouse",
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
  RECEIVED: "Received at Divisoria Warehouse",
  LOADED: "Loaded",
  PARTIALLY_LOADED: "Partially loaded",
  AVAILABLE_AT_WAREHOUSE: "Available at Odiongan Warehouse",
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
  return String(value || "").trim().toUpperCase();
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
    ["RETURNED_TO_WAREHOUSE", "RETURNED_RECEIVED_AT_ODIONGAN", "RETURNED_RECEIVED_AT_HUB"].includes(
      status,
    )
  ) {
    return { bucket: "returned", qty };
  }
  if (status === "OUT_FOR_DELIVERY") return { bucket: "outForDelivery", qty };
  if (
    ["LOADED_TO_DELIVERY_VEHICLE", "LOADED", "READY_FOR_DELIVERY", "PARTIALLY_LOADED"].includes(
      status,
    ) ||
    (normalizeStatus(pkg.custodyOwnerType) === "CHECKER" && !["DELIVERED", "COMPLETED"].includes(status))
  ) {
    return { bucket: "onCheckerVan", qty };
  }
  if (["IN_TRANSIT", "LOADED_TO_TRIP"].includes(status)) {
    return { bucket: "inTransit", qty };
  }
  if (
    status === "RELEASED_FOR_DELIVERY" ||
    (pkg.availableForDelivery === true &&
      ["AVAILABLE_AT_WAREHOUSE", "AVAILABLE_AT_ODIONGAN_WAREHOUSE", "ARRIVED_AT_ODIONGAN"].includes(
        status,
      ))
  ) {
    return { bucket: "releasedForDelivery", qty };
  }
  if (
    ["ARRIVED_AT_ODIONGAN", "AVAILABLE_AT_ODIONGAN_WAREHOUSE", "RETURNED_RECEIVED_AT_ODIONGAN", "RETURNED_RECEIVED_AT_HUB"].includes(
      status,
    )
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
