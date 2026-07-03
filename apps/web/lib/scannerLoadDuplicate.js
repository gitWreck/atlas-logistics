const LINEHAUL_LOADED_STATUSES = new Set([
  "LOADED",
  "LOADED_TO_TRIP",
  "IN_TRANSIT",
  "PARTIALLY_LOADED",
]);

const LINEHAUL_LOAD_BLOCKED_STATUSES = new Set([
  "RELEASED_FOR_DELIVERY",
  "AVAILABLE_AT_ODIONGAN_WAREHOUSE",
  "AVAILABLE_AT_WAREHOUSE",
  "ROUTE_ASSIGNED",
  "LOADED_TO_DELIVERY_VEHICLE",
  "READY_FOR_DELIVERY",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
  "COMPLETED",
  "MISSING",
  "DAMAGED",
  "RETURNED_TO_WAREHOUSE",
  "RETURNED_RECEIVED_AT_ODIONGAN",
  "RETURNED_RECEIVED_AT_HUB",
  "FAILED_DELIVERY",
]);

function packageQty(pkg = {}) {
  return Math.max(Number(pkg.quantity) || 1, 1);
}

function packageLoadedQty(pkg = {}) {
  const qty = packageQty(pkg);
  return Math.min(Math.max(Number(pkg.loadedQty) || 0, 0), qty);
}

export function packageTripId(pkg = {}) {
  return pkg.currentTripId || pkg.loadedOnTrip || null;
}

export function packageRemainingLoadQty(pkg = {}, tripId = null) {
  const onTrip = packageTripId(pkg);
  if (tripId && onTrip && onTrip !== tripId) return 0;
  return Math.max(packageQty(pkg) - packageLoadedQty(pkg), 0);
}

export function isPackageFullyLoadedOnTrip(pkg = {}, tripId = null) {
  if (!pkg || !tripId) return false;
  if (packageTripId(pkg) !== tripId) return false;

  if (packageRemainingLoadQty(pkg, tripId) <= 0) {
    return true;
  }

  const status = String(pkg.status || "").toUpperCase();
  return (
    LINEHAUL_LOADED_STATUSES.has(status) &&
    packageLoadedQty(pkg) >= packageQty(pkg)
  );
}

/**
 * Returns an error message when a piece must not be linehaul-loaded onto tripId.
 * Returns null when allowed. Returns "ALREADY_LOADED" for duplicate scan on same trip.
 */
export function evaluateLinehaulLoadBlock(pkg = {}, tripId = null, options = {}) {
  if (options.isDeliveryTrip || !pkg) return null;

  const trip = String(tripId || "").trim();
  if (!trip) return null;

  const pieceId = pkg.packageId || pkg.trackingNumber || "This label";
  const loadedOn = String(pkg.loadedOnTrip || "").trim();
  const currentTrip = String(pkg.currentTripId || "").trim();
  const hubOn = String(pkg.hubReceivedOnTrip || "").trim();
  const activeTrip = loadedOn || currentTrip;
  const status = String(pkg.status || "").toUpperCase();
  const qty = packageQty(pkg);
  const loadedQty = packageLoadedQty(pkg);
  const receivedQty = Math.min(Math.max(Number(pkg.receivedQty) || 0, 0), qty);

  if (activeTrip && activeTrip !== trip) {
    return `Package ${pieceId} is already on trip ${activeTrip} and cannot be loaded onto ${trip}.`;
  }

  if (
    hubOn &&
    hubOn !== trip &&
    (receivedQty > 0 || LINEHAUL_LOAD_BLOCKED_STATUSES.has(status))
  ) {
    return `Package ${pieceId} already completed trip ${hubOn} at the hub and cannot be loaded onto ${trip}.`;
  }

  if (LINEHAUL_LOAD_BLOCKED_STATUSES.has(status)) {
    return `Package ${pieceId} is already ${status.replace(/_/g, " ").toLowerCase()} and cannot be loaded onto a linehaul trip.`;
  }

  if (
    activeTrip === trip &&
    loadedQty > 0 &&
    (LINEHAUL_LOADED_STATUSES.has(status) || loadedQty >= qty)
  ) {
    if (packageRemainingLoadQty(pkg, trip) <= 0) return "ALREADY_LOADED";
  }

  if (
    !activeTrip &&
    loadedQty > 0 &&
    receivedQty === 0 &&
    LINEHAUL_LOADED_STATUSES.has(status)
  ) {
    return `Package ${pieceId} is already in transit and cannot be loaded again.`;
  }

  return null;
}

export function formatScannerActorRole(role, location = null) {
  const normalized = String(role || "")
    .trim()
    .toLowerCase();
  const place = String(location || "").trim();

  if (normalized === "manager") {
    if (!place) return "Warehouse Manager";
    return place.toLowerCase().includes("warehouse")
      ? `${place} Manager`
      : `${place} Warehouse Manager`;
  }
  if (normalized === "admin") return place ? `${place} Administrator` : "Administrator";
  if (normalized === "checker") return place ? `${place} Checker` : "Checker";
  if (normalized === "driver") return place ? `${place} Driver` : "Driver";
  if (!normalized) return place || null;

  const label = normalized
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
  return place ? `${place} ${label}` : label;
}

export function resolveShipmentOriginLabel(shipment = {}) {
  return (
    shipment.origin ||
    (String(shipment.originCode || "").toUpperCase() === "DIVISORIA"
      ? "Divisoria Warehouse"
      : shipment.originCode) ||
    null
  );
}

export function buildTruckLabel(trip = {}, truck = null) {
  if (trip.truckName) return trip.truckName;
  if (truck) {
    const parts = [truck.type, truck.model, truck.name].filter(Boolean);
    if (parts.length) return parts.join(" ").trim();
  }
  return trip.truckPlateNumber || null;
}

export function toDisplayTimestamp(value) {
  if (!value) return null;
  const date =
    typeof value?.toDate === "function"
      ? value.toDate()
      : value?._seconds
        ? new Date(value._seconds * 1000)
        : value?.seconds
          ? new Date(value.seconds * 1000)
          : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function pickLatestLoadEvent(events = [], tripId, pieceId) {
  const normalizedTripId = String(tripId || "").trim();
  const normalizedPieceId = String(pieceId || "").trim();
  const allowed = new Set(["LOADED_TO_TRIP", "LOADED", "PARTIAL_LOAD"]);

  return events
    .filter((event) => {
      if (!event) return false;
      if (normalizedTripId && String(event.tripId || "").trim() !== normalizedTripId) {
        return false;
      }
      if (
        normalizedPieceId &&
        event.pieceId &&
        String(event.pieceId).trim() !== normalizedPieceId
      ) {
        return false;
      }
      return allowed.has(String(event.eventType || "").toUpperCase());
    })
    .sort((a, b) => {
      const aMs = toMillis(a.timestamp || a.createdAt);
      const bMs = toMillis(b.timestamp || b.createdAt);
      return bMs - aMs;
    })[0];
}

function toMillis(value) {
  if (!value) return 0;
  if (typeof value?.toMillis === "function") return value.toMillis();
  if (value?._seconds) return value._seconds * 1000;
  if (value?.seconds) return value.seconds * 1000;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

export function buildAlreadyLoadedInfo({
  packageId,
  tripId,
  shipment = {},
  trip = {},
  truck = null,
  targetPackage = {},
  loadEvent = null,
}) {
  const location =
    loadEvent?.location ||
    targetPackage.loadedAtLocation ||
    resolveShipmentOriginLabel(shipment);
  const loadedBy =
    loadEvent?.warehouseManagerName ||
    loadEvent?.checkerName ||
    loadEvent?.driverName ||
    targetPackage.loadedBy ||
    null;
  const loadedByRole = formatScannerActorRole(
    loadEvent?.createdByRole || targetPackage.loadedByRole,
    location,
  );

  return {
    packageId: packageId || targetPackage.packageId || null,
    tripId: tripId || trip.tripId || null,
    loadedBy,
    loadedByRole,
    location,
    loadedAt:
      toDisplayTimestamp(
        loadEvent?.timestamp ||
          loadEvent?.createdAt ||
          targetPackage.loadedAt ||
          targetPackage.updatedAt,
      ) || null,
    truckName: loadEvent?.truckName || buildTruckLabel(trip, truck),
    truckPlate:
      loadEvent?.truckPlate ||
      trip.truckPlateNumber ||
      trip.truckPlate ||
      null,
  };
}
