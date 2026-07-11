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

const GENERIC_DESCRIPTIONS = new Set([
  "item",
  "standard package",
  "bundled cargo",
  "no description",
  "package",
]);

function formatPublicPackageStatus(status) {
  if (!status) return "RECEIVED";
  const normalized = String(status).trim().toUpperCase().replace(/\s+/g, "_");
  return PUBLIC_STATUS_MAP[normalized] || normalized.replace(/_/g, " ");
}

function normalizeStatusCode(pkg = {}) {
  if (pkg.statusCode) {
    return String(pkg.statusCode).trim().toUpperCase().replace(/\s+/g, "_");
  }

  const rawStatus = String(pkg.status || "RECEIVED").trim();
  if (rawStatus.includes(" ")) {
    return rawStatus.toUpperCase().replace(/\s+/g, "_");
  }

  return rawStatus.toUpperCase();
}

export function resolvePublicPackageDescription(pkg = {}) {
  const candidates = [
    pkg.description,
    pkg.itemDescription,
    pkg.name,
    pkg.label,
    pkg.itemName,
  ];

  for (const value of candidates) {
    const text = String(value || "").trim();
    if (text && !GENERIC_DESCRIPTIONS.has(text.toLowerCase())) {
      return text;
    }
  }

  return "";
}

export function sanitizePublicPackage(pkg = {}, index = 0) {
  const packageId = pkg.packageId || pkg.trackingNumber || "";
  const statusCode = normalizeStatusCode(pkg);
  const description = resolvePublicPackageDescription(pkg);
  const formattedStatus = String(pkg.status || "").trim();
  const status = pkg.statusCode
    ? formatPublicPackageStatus(statusCode)
    : formattedStatus.includes(" ")
      ? formattedStatus
      : formatPublicPackageStatus(statusCode);

  return {
    packageId,
    trackingNumber: pkg.trackingNumber || packageId,
    description,
    packagingType: pkg.packagingType || pkg.packaging || "Package",
    quantity: Number(pkg.quantity) || 1,
    sequence: pkg.sequence || index + 1,
    status,
    statusCode,
    isFragile: Boolean(pkg.isFragile),
    isPerishable: Boolean(pkg.isPerishable),
  };
}

export function sanitizePublicPackages(packages = []) {
  if (!Array.isArray(packages)) return [];
  return packages.map((pkg, index) => sanitizePublicPackage(pkg, index));
}
