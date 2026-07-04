import { resolveDestinationHubName } from "./publicTrackingMilestones";

const LOADED_STATUSES = new Set([
  "ASSIGNED",
  "LOADING",
  "LOADED",
  "PARTIALLY_LOADED",
]);

const IN_TRANSIT_STATUSES = new Set(["IN_TRANSIT", "PARTIALLY_IN_TRANSIT"]);

const AT_DESTINATION_HUB_STATUSES = new Set([
  "ARRIVED",
  "PARTIALLY_ARRIVED",
  "ARRIVED_AT_ODIONGAN",
  "AVAILABLE_AT_WAREHOUSE",
  "AVAILABLE_AT_ODIONGAN_WAREHOUSE",
  "AVAILABLE_FOR_DELIVERY",
  "PARTIALLY_AVAILABLE_FOR_DELIVERY",
  "READY_FOR_DELIVERY",
  "RELEASED_FOR_DELIVERY",
]);

const OUT_FOR_DELIVERY_STATUSES = new Set([
  "OUT_FOR_DELIVERY",
  "PARTIALLY_OUT_FOR_DELIVERY",
]);

const DELIVERED_STATUSES = new Set([
  "DELIVERED",
  "COMPLETED",
  "PARTIALLY_DELIVERED",
]);

function normalizeStatusCode(data = {}) {
  return String(data.statusCode || data.status || "")
    .toUpperCase()
    .replace(/\s+/g, "_");
}

const PUBLIC_STATUS_LABELS = {
  RECEIVED: "Received",
  RECEIVED_AT_DIVISORIA: "Received",
  PENDING_PICKUP: "Pending pickup",
  PICKED_UP: "Picked up",
  ASSIGNED: "Assigned",
  LOADING: "Loading",
  PARTIALLY_LOADED: "Partially loaded",
  LOADED: "Loaded",
  IN_TRANSIT: "In transit",
  PARTIALLY_IN_TRANSIT: "Partially in transit",
  PARTIALLY_ARRIVED: "Partially arrived",
  ARRIVED: "Arrived",
  ARRIVED_AT_ODIONGAN: "Arrived",
  AVAILABLE_AT_WAREHOUSE: "At warehouse",
  AVAILABLE_AT_ODIONGAN_WAREHOUSE: "At warehouse",
  AVAILABLE_FOR_DELIVERY: "Available for delivery",
  PARTIALLY_AVAILABLE_FOR_DELIVERY: "Partially available for delivery",
  RELEASED_FOR_DELIVERY: "Released for delivery",
  READY_FOR_DELIVERY: "Ready for delivery",
  OUT_FOR_DELIVERY: "Out for delivery",
  PARTIALLY_OUT_FOR_DELIVERY: "Partially out for delivery",
  PARTIALLY_DELIVERED: "Partially delivered",
  DELIVERED: "Delivered",
  COMPLETED: "Delivered",
};

export function resolvePublicTrackingStatusCode(data = {}) {
  return normalizeStatusCode(data);
}

export function resolvePublicTrackingDisplayStatus(data = {}) {
  const statusCode = normalizeStatusCode(data);
  const formattedStatus = String(data.status || "").trim();

  if (statusCode && PUBLIC_STATUS_LABELS[statusCode]) {
    return PUBLIC_STATUS_LABELS[statusCode];
  }

  if (formattedStatus) return formattedStatus;

  return statusCode.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function readCount(totals = {}, key, fallback = 0) {
  const value = Number(totals[key]);
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

function sumCounts(totals = {}, keys = []) {
  return keys.reduce((sum, key) => sum + readCount(totals, key, 0), 0);
}

/**
 * Middle footer stat: label and count follow the shipment's current lifecycle stage.
 */
export function resolvePublicTrackingMiddleStat(data = {}) {
  const statusCode = normalizeStatusCode(data);
  const totals = data.totals || {};
  const destinationHub = resolveDestinationHubName(data);

  const loaded = readCount(totals, "loaded", 0);
  const inTransit = readCount(totals, "inTransit", loaded);
  const atDestinationHub = sumCounts(totals, [
    "atOdiongan",
    "releasedForDelivery",
    "routeAssigned",
  ]);
  const outForDelivery = sumCounts(totals, ["outForDelivery", "onCheckerVan"]);
  const delivered = readCount(totals, "delivered", 0);

  if (DELIVERED_STATUSES.has(statusCode)) {
    return {
      label: "Delivered",
      value: delivered,
      color: "text-emerald-700",
    };
  }

  if (OUT_FOR_DELIVERY_STATUSES.has(statusCode)) {
    return {
      label: "Out for Delivery",
      value: outForDelivery,
      color: "text-purple-700",
    };
  }

  if (AT_DESTINATION_HUB_STATUSES.has(statusCode)) {
    return {
      label: `At ${destinationHub}`,
      value: atDestinationHub,
      color: "text-sky-700",
    };
  }

  if (IN_TRANSIT_STATUSES.has(statusCode)) {
    return {
      label: "In Transit",
      value: inTransit,
      color: "text-blue-700",
    };
  }

  if (LOADED_STATUSES.has(statusCode)) {
    return {
      label: "Loaded",
      value: loaded,
      color: "text-blue-700",
    };
  }

  return {
    label: "Loaded",
    value: loaded,
    color: "text-blue-700",
  };
}
