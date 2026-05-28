"use strict";

const EVENT_TYPES = Object.freeze({
  RECEIVED_AT_DIVISORIA: "RECEIVED_AT_DIVISORIA",
  LOADED_TO_TRIP: "LOADED_TO_TRIP",
  IN_TRANSIT: "IN_TRANSIT",
  ARRIVED_ODIONGAN: "ARRIVED_ODIONGAN",
  RELEASED_TO_CHECKER: "RELEASED_TO_CHECKER",
  ASSIGNED_TO_CHECKER: "ASSIGNED_TO_CHECKER",
  LOADED_TO_DELIVERY_VEHICLE: "LOADED_TO_DELIVERY_VEHICLE",
  OUT_FOR_DELIVERY: "OUT_FOR_DELIVERY",
  DELIVERED: "DELIVERED",
  FAILED_DELIVERY: "FAILED_DELIVERY",
  RETURNED_TO_WAREHOUSE: "RETURNED_TO_WAREHOUSE",
  PARTIAL_LOAD: "PARTIAL_LOAD",
  UNLOADED: "UNLOADED",
});

const VALID_EVENT_TYPES = new Set(Object.values(EVENT_TYPES));

function isValidEventType(eventType) {
  return VALID_EVENT_TYPES.has(String(eventType || "").trim().toUpperCase());
}

function resolveEventTypeForScannerStatus(status, context = {}) {
  const normalizedStatus = String(status || "").trim().toUpperCase();
  const hasTrip = Boolean(context.tripId);

  if (normalizedStatus === "LOADED") {
    return hasTrip ? EVENT_TYPES.LOADED_TO_TRIP : EVENT_TYPES.PARTIAL_LOAD;
  }
  if (normalizedStatus === "RECEIVED") {
    return EVENT_TYPES.ARRIVED_ODIONGAN;
  }
  if (normalizedStatus === "DELIVERED") {
    return EVENT_TYPES.DELIVERED;
  }
  if (normalizedStatus === "MISSING") {
    return EVENT_TYPES.FAILED_DELIVERY;
  }
  if (normalizedStatus === "DAMAGED") {
    return EVENT_TYPES.FAILED_DELIVERY;
  }

  return null;
}

module.exports = {
  EVENT_TYPES,
  VALID_EVENT_TYPES,
  isValidEventType,
  resolveEventTypeForScannerStatus,
};
