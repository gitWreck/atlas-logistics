"use strict";

const {
  loadTripContextMap,
  collectTripIdsForTimeline,
} = require("./enrichTimelineWithTripContext");
const { extractTripIdFromNote } = require("./tripEventContext");

const MAIN_TRANSPORT_EVENT_TYPES = [
  "LOADED_TO_TRIP",
  "LOADED",
  "PARTIAL_LOAD",
  "IN_TRANSIT",
];

function normalizeString(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function formatTimestamp(value) {
  if (!value) return null;
  if (typeof value?.toDate === "function") {
    return value.toDate().toISOString();
  }
  if (value?._seconds) {
    return new Date(value._seconds * 1000).toISOString();
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function findLatestTransportEvent(events = []) {
  const normalizedTypes = MAIN_TRANSPORT_EVENT_TYPES.map((value) =>
    String(value).toUpperCase(),
  );

  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index];
    const eventType = String(event?.eventType || "").toUpperCase();
    if (normalizedTypes.includes(eventType)) {
      return event;
    }
  }

  return null;
}

function resolveFallbackTripId(shipmentData = {}, events = []) {
  return (
    normalizeString(shipmentData.currentTripId) ||
    normalizeString(shipmentData.currentTruckTripId) ||
    collectTripIdsForTimeline(events, shipmentData)[0] ||
    null
  );
}

async function buildScanInfoTransportSummary(db, shipmentData = {}, events = []) {
  const loadedTripEvent = findLatestTransportEvent(events);
  const fallbackTripId = resolveFallbackTripId(shipmentData, events);
  const tripId =
    normalizeString(loadedTripEvent?.tripId) || fallbackTripId || null;

  let tripContext = null;
  if (tripId) {
    const tripContextMap = await loadTripContextMap(db, [tripId]);
    tripContext = tripContextMap[tripId] || null;
  }

  return {
    tripId,
    truck:
      loadedTripEvent?.truckName ||
      tripContext?.truckName ||
      shipmentData.truckName ||
      shipmentData.truckInternalCode ||
      null,
    plate:
      loadedTripEvent?.truckPlate ||
      tripContext?.truckPlate ||
      shipmentData.truckPlate ||
      shipmentData.truckPlateNumber ||
      null,
    driver:
      loadedTripEvent?.driverName ||
      tripContext?.driverName ||
      shipmentData.driverName ||
      null,
    loadedAt: formatTimestamp(loadedTripEvent?.timestamp),
    sourceTripIdFromNote: extractTripIdFromNote(loadedTripEvent?.remarks),
  };
}

module.exports = {
  buildScanInfoTransportSummary,
  findLatestTransportEvent,
};
