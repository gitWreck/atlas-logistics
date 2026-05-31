"use strict";

const {
  formatLedgerEvent,
  formatStatusHistoryEvent,
  dedupeTimelineEvents,
  sortTimelineEvents,
  getEventTitle,
} = require("./custodyTimelineFormat");
const { enrichTimelineWithTripContext } = require("./enrichTimelineWithTripContext");
const { sanitizeDriverName } = require("../utilities/helpers");

const PUBLIC_EVENT_LABELS = Object.freeze({
  RECEIVED_AT_DIVISORIA: "Received at origin hub",
  LOADED_TO_TRIP: "In transit",
  IN_TRANSIT: "In transit",
  ARRIVED_ODIONGAN: "Arrived at destination hub",
  RECONCILED: "Reconciled at destination hub",
  RECEIVED_RETURNED_SHIPMENT: "Returned shipment received at hub",
  RELEASED_TO_CHECKER: "Prepared for local delivery",
  RELEASED_FOR_DELIVERY_OPERATIONS: "Available for local delivery",
  ASSIGNED_TO_CHECKER: "Assigned for delivery",
  LOADED_TO_DELIVERY_VEHICLE: "Loaded for delivery",
  OUT_FOR_DELIVERY: "Out for delivery",
  PARTIALLY_DELIVERED: "Partially delivered",
  DELIVERED: "Delivered",
  FAILED_DELIVERY: "Delivery attempt unsuccessful",
  RETURNED_TO_WAREHOUSE: "Returned to warehouse",
  PARTIAL_LOAD: "Partial load",
  UNLOADED: "Unloaded",
});

const LAST_MILE_EVENT_TYPES = new Set([
  "RELEASED_TO_CHECKER",
  "ASSIGNED_TO_CHECKER",
  "LOADED_TO_DELIVERY_VEHICLE",
  "OUT_FOR_DELIVERY",
  "PARTIALLY_DELIVERED",
  "DELIVERED",
  "FAILED_DELIVERY",
]);

function normalizeString(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function sanitizeCheckerName(name) {
  const normalized = normalizeString(name);
  if (!normalized) return null;
  return normalized;
}

function getPublicEventLabel(eventType, fallbackTitle) {
  const key = String(eventType || "").trim().toUpperCase();
  if (PUBLIC_EVENT_LABELS[key]) return PUBLIC_EVENT_LABELS[key];
  return fallbackTitle || getEventTitle(key);
}

function mapEventToPublicStatusCode(eventType) {
  const key = String(eventType || "").trim().toUpperCase();
  if (key === "PARTIALLY_DELIVERED") return "PARTIALLY_DELIVERED";
  if (key === "DELIVERED") return "DELIVERED";
  if (
    key === "OUT_FOR_DELIVERY" ||
    key === "LOADED_TO_DELIVERY_VEHICLE" ||
    key === "ASSIGNED_TO_CHECKER" ||
    key === "RELEASED_TO_CHECKER"
  ) {
    return "OUT_FOR_DELIVERY";
  }
  if (key === "IN_TRANSIT" || key === "LOADED_TO_TRIP") return "IN_TRANSIT";
  if (key === "ARRIVED_ODIONGAN" || key === "RECEIVED_AT_DIVISORIA") {
    return "RECEIVED";
  }
  return key || "RECEIVED";
}

function buildPublicNote(event = {}) {
  const parts = [];

  if (LAST_MILE_EVENT_TYPES.has(String(event.eventType || "").toUpperCase())) {
    if (event.checkerName) {
      parts.push(`Assigned to: ${sanitizeCheckerName(event.checkerName)}`);
    }
    if (event.deliveryVehicleName) {
      parts.push(`Vehicle: ${event.deliveryVehicleName}`);
    }
  }

  if (
    ["IN_TRANSIT", "LOADED_TO_TRIP"].includes(
      String(event.eventType || "").toUpperCase(),
    ) &&
    event.driverName
  ) {
    parts.push(`Driver: ${sanitizeDriverName(event.driverName)}`);
  }

  if (event.remarks && typeof event.remarks === "string") {
    parts.push(event.remarks);
  }

  return parts.join(" • ");
}

function formatPublicTimelineEntry(event = {}) {
  const eventType = String(event.eventType || "").trim().toUpperCase();
  const title = getPublicEventLabel(eventType, event.title);

  return {
    status: title,
    statusCode: mapEventToPublicStatusCode(eventType),
    title,
    date: event.timestamp || new Date().toISOString(),
    note: buildPublicNote(event),
    location:
      typeof event.location === "string"
        ? event.location
        : normalizeString(event.location) || "",
    checkerName: LAST_MILE_EVENT_TYPES.has(eventType)
      ? sanitizeCheckerName(event.checkerName)
      : null,
    deliveryVehicleName: LAST_MILE_EVENT_TYPES.has(eventType)
      ? normalizeString(event.deliveryVehicleName)
      : null,
    driverName: ["IN_TRANSIT", "LOADED_TO_TRIP"].includes(eventType)
      ? sanitizeDriverName(event.driverName)
      : null,
  };
}

async function buildPublicTrackingHistory(db, shipmentId, shipmentData = {}) {
  const eventsSnap = await db
    .collection("shipment_events")
    .where("shipmentId", "==", shipmentId)
    .get();

  const ledgerEvents = eventsSnap.docs.map((docSnap) =>
    formatLedgerEvent(docSnap),
  );

  const historyEvents = (Array.isArray(shipmentData.statusHistory)
    ? shipmentData.statusHistory
    : []
  ).map((entry, index) =>
    formatStatusHistoryEvent(shipmentId, entry, index),
  );

  const merged = sortTimelineEvents(
    dedupeTimelineEvents([...ledgerEvents, ...historyEvents]),
  );
  const enriched = await enrichTimelineWithTripContext(
    db,
    merged,
    shipmentData,
  );

  return enriched
    .map((event) => formatPublicTimelineEntry(event))
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

function resolvePublicDeliveryContext(shipmentData = {}) {
  return {
    assignedCheckerName: sanitizeCheckerName(
      shipmentData.assignedCheckerName ||
        shipmentData.checkerName ||
        null,
    ),
    deliveryVehicleName: normalizeString(
      shipmentData.deliveryVehicleName || null,
    ),
  };
}

module.exports = {
  PUBLIC_EVENT_LABELS,
  buildPublicTrackingHistory,
  formatPublicTimelineEntry,
  resolvePublicDeliveryContext,
  getPublicEventLabel,
  mapEventToPublicStatusCode,
};
