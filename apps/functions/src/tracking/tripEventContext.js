"use strict";

function normalizeString(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function buildTruckLabel(tripData = {}, truckData = null) {
  const explicit =
    normalizeString(tripData.truckName) ||
    normalizeString(tripData.truckLabel) ||
    normalizeString(tripData.vehicleName) ||
    normalizeString(tripData.truckInternalCode);

  if (explicit) return explicit;

  if (truckData) {
    const parts = [
      normalizeString(truckData.type),
      normalizeString(truckData.model),
    ].filter(Boolean);
    if (parts.length) return parts.join(" ");
  }

  const plate =
    normalizeString(tripData.truckPlateNumber) ||
    normalizeString(tripData.truckPlate) ||
    normalizeString(tripData.plateNumber);

  return plate ? `Truck (${plate})` : null;
}

function extractTripEventContext(
  tripData = {},
  tripDocId = null,
  truckData = null,
) {
  const data = tripData || {};

  return {
    tripId: normalizeString(data.tripId) || normalizeString(tripDocId),
    truckId: normalizeString(data.truckId),
    truckName: buildTruckLabel(data, truckData),
    truckPlate:
      normalizeString(data.truckPlate) ||
      normalizeString(data.truckPlateNumber) ||
      normalizeString(data.plateNumber) ||
      normalizeString(data.vehiclePlate) ||
      (truckData ? normalizeString(truckData.plateNumber) : null),
    driverId: normalizeString(data.driverId),
    driverName: normalizeString(data.driverName),
  };
}

const TRIP_CONTEXT_EVENT_TYPES = new Set([
  "LOADED_TO_TRIP",
  "IN_TRANSIT",
  "LOADED",
  "ASSIGNED",
  "PARTIAL_LOAD",
]);

function eventShouldEnrichWithTrip(eventType) {
  return TRIP_CONTEXT_EVENT_TYPES.has(
    String(eventType || "")
      .trim()
      .toUpperCase(),
  );
}

function mergeTripContextIntoEvent(event = {}, tripContext = {}) {
  if (!event || !tripContext) return event;

  return {
    ...event,
    tripId: event.tripId || tripContext.tripId || null,
    truckId: event.truckId || tripContext.truckId || null,
    truckName: event.truckName || tripContext.truckName || null,
    truckPlate: event.truckPlate || tripContext.truckPlate || null,
    driverId: event.driverId || tripContext.driverId || null,
    driverName: event.driverName || tripContext.driverName || null,
  };
}

function extractTripIdFromNote(note) {
  if (!note || typeof note !== "string") return null;
  const match = note.match(/\b(TRIP-[A-Z0-9-]+)\b/i);
  return match ? match[1] : null;
}

module.exports = {
  extractTripEventContext,
  eventShouldEnrichWithTrip,
  mergeTripContextIntoEvent,
  extractTripIdFromNote,
  buildTruckLabel,
};
