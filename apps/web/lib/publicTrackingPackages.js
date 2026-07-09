const PUBLIC_STATUS_MAP = {
  RECEIVED: "RECEIVED",
  RECEIVED_AT_DIVISORIA: "RECEIVED AT DIVISORIA",
  IN_TRANSIT: "IN TRANSIT",
  LOADED: "IN TRANSIT",
  LOADED_TO_TRIP: "IN TRANSIT",
  ARRIVED: "ARRIVED AT WAREHOUSE",
  ARRIVED_AT_ODIONGAN: "ARRIVED AT WAREHOUSE",
  AVAILABLE_AT_ODIONGAN_WAREHOUSE: "AVAILABLE AT WAREHOUSE",
  AVAILABLE_FOR_DELIVERY: "AVAILABLE FOR DELIVERY",
  PARTIALLY_AVAILABLE_FOR_DELIVERY: "PARTIALLY AVAILABLE FOR DELIVERY",
  RELEASED_FOR_DELIVERY: "RELEASED FOR DELIVERY",
  READY_FOR_DELIVERY: "READY FOR DELIVERY",
  OUT_FOR_DELIVERY: "OUT FOR DELIVERY",
  PARTIALLY_OUT_FOR_DELIVERY: "PARTIALLY OUT FOR DELIVERY",
  PARTIALLY_DELIVERED: "PARTIALLY DELIVERED",
  DELIVERED: "DELIVERED",
  COMPLETED: "DELIVERED",
  DONE: "DELIVERED",
};

function formatPublicPackageStatus(status) {
  if (!status) return "RECEIVED";
  const normalized = String(status).trim().toUpperCase();
  return PUBLIC_STATUS_MAP[normalized] || normalized.replace(/_/g, " ");
}

export function sanitizePublicPackage(pkg = {}, index = 0) {
  const packageId = pkg.packageId || pkg.trackingNumber || "";
  const statusCode = String(pkg.status || pkg.statusCode || "RECEIVED")
    .trim()
    .toUpperCase();

  return {
    packageId,
    trackingNumber: pkg.trackingNumber || packageId,
    description: pkg.description || "Item",
    packagingType: pkg.packagingType || "Package",
    quantity: Number(pkg.quantity) || 1,
    sequence: pkg.sequence || index + 1,
    status: pkg.status || formatPublicPackageStatus(statusCode),
    statusCode,
    isFragile: Boolean(pkg.isFragile),
    isPerishable: Boolean(pkg.isPerishable),
  };
}

export function sanitizePublicPackages(packages = []) {
  if (!Array.isArray(packages)) return [];
  return packages.map((pkg, index) => sanitizePublicPackage(pkg, index));
}
