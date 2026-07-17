const ACTIVE_TRIP_STATUSES = ["IN_TRANSIT", "LOADED", "ARRIVED", "ASSIGNED", "CREATED"];

export function toDate(value) {
  if (!value) return null;
  if (typeof value?.toDate === "function") return value.toDate();
  if (value instanceof Date) return value;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function manilaDateKey(value = new Date()) {
  const date = toDate(value) || new Date();
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (type) => parts.find((part) => part.type === type)?.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}

export function dateFromKey(key) {
  const match = String(key || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return new Date();
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12);
}

export function formatSelectedDate(key) {
  const date = dateFromKey(key);
  const label = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
  return key === manilaDateKey() ? `Today, ${label}` : label;
}

export function tripDateKey(trip = {}) {
  const source =
    trip.plannedDeparture ||
    trip.scheduledDate ||
    trip.departureDate ||
    trip.createdAt ||
    trip.updatedAt;
  return source ? manilaDateKey(source) : null;
}

export function statusKey(value) {
  return String(value || "ASSIGNED").trim().toUpperCase().replace(/\s+/g, "_");
}

export function statusLabel(value) {
  return statusKey(value)
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function tripPriority(trip = {}) {
  const status = statusKey(trip.status);
  const index = ACTIVE_TRIP_STATUSES.indexOf(status);
  return index < 0 ? ACTIVE_TRIP_STATUSES.length : index;
}

export function shipmentCounts(rows = []) {
  return rows.reduce(
    (total, row) => {
      const status = statusKey(row.status);
      const packageTotal = Array.isArray(row.packageBarcodes) ? row.packageBarcodes.length : 0;
      const assigned = Math.max(
        Number(row.totalItems || 0),
        Number(row.packageCount || 0),
        packageTotal,
        1,
      );
      const loaded = Math.max(Number(row.loadedCount || 0), status === "LOADED" ? assigned : 0);
      const delivered = Math.max(
        Number(row.deliveredCount || row.receivedCount || 0),
        ["DELIVERED", "COMPLETED"].includes(status) ? assigned : 0,
      );
      const failed = Math.max(
        Number(row.failedCount || row.missingCount || row.damagedCount || 0),
        status.includes("FAILED") ? assigned : 0,
      );
      const returned = Math.max(
        Number(row.returnedCount || 0),
        status.includes("RETURN") ? assigned : 0,
      );
      total.assigned += assigned;
      total.onVehicle += Math.min(assigned, loaded);
      total.delivered += Math.min(assigned, delivered);
      total.failed += Math.min(assigned, failed);
      total.returned += Math.min(assigned, returned);
      return total;
    },
    { assigned: 0, onVehicle: 0, delivered: 0, failed: 0, returned: 0 },
  );
}

export function shipmentAddress(shipment = {}) {
  const address = shipment.recipient?.address || {};
  return (
    shipment.destinationAddress ||
    shipment.destination ||
    shipment.destinationCity ||
    address.formattedAddress ||
    [address.unit, address.street, address.barangay, address.city, address.province]
      .filter(Boolean)
      .join(", ") ||
    shipment.route ||
    "Address unavailable"
  );
}

export function shipmentRecipient(shipment = {}) {
  return shipment.recipient?.name || shipment.receiverName || "Delivery recipient";
}

export function shipmentCoordinate(shipment = {}) {
  const address = shipment.recipient?.address || {};
  const source =
    shipment.coordinate ||
    shipment.coordinates ||
    shipment.location ||
    address.coordinate ||
    address.coordinates ||
    address.location ||
    address.geoPoint;
  const latitude = Number(source?.latitude ?? source?.lat ?? shipment.latitude ?? address.latitude);
  const longitude = Number(source?.longitude ?? source?.lng ?? shipment.longitude ?? address.longitude);
  return Number.isFinite(latitude) && Number.isFinite(longitude)
    ? { latitude, longitude }
    : null;
}

export function formatTripTime(value) {
  const date = toDate(value);
  if (!date) return "—";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Manila",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export function tripNumber(trip = {}) {
  return trip.tripId || trip.tripNumber || trip.tripCode || trip.id || "Trip unavailable";
}

export function tripOrigin(trip = {}) {
  return trip.originWarehouseName || trip.departureWarehouseName || trip.origin || trip.fromWarehouse || "Departure warehouse unavailable";
}

export function tripDestination(trip = {}) {
  return trip.destinationWarehouseName || trip.arrivalWarehouseName || trip.destination || trip.toWarehouse || "Destination warehouse unavailable";
}

export function tripPlate(trip = {}) {
  return trip.truckPlateNumber || trip.plateNumber || trip.plate || "Plate unavailable";
}

export function formatTripDateTime(value) {
  const date = toDate(value);
  if (!date) return "Not scheduled";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Manila",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export function tripPackageTotal(rows = [], trip = {}) {
  if (Number.isFinite(Number(trip.totalPackages))) return Number(trip.totalPackages);
  if (Number.isFinite(Number(trip.totalItems))) return Number(trip.totalItems);
  return rows.reduce((total, row) => total + Math.max(
    Number(row.totalPackages || 0),
    Number(row.packageCount || 0),
    Array.isArray(row.packageBarcodes) ? row.packageBarcodes.length : 0,
    1,
  ), 0);
}
