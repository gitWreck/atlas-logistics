"use strict";

const EVENT_TITLES = Object.freeze({
  RECEIVED_AT_DIVISORIA: "Received at Divisoria",
  LOADED_TO_TRIP: "Loaded to trip",
  IN_TRANSIT: "In transit",
  ARRIVED_ODIONGAN: "Received at Odiongan",
  RECONCILED: "Reconciled at Odiongan",
  RECEIVED_RETURNED_SHIPMENT: "Received returned shipment",
  RELEASED_TO_CHECKER: "Released by warehouse manager",
  RELEASED_FOR_DELIVERY_OPERATIONS:
    "Released for delivery operations (warehouse custody)",
  ASSIGNED_TO_CHECKER: "Assigned to checker",
  LOADED_TO_DELIVERY_VEHICLE: "Loaded to delivery vehicle",
  OUT_FOR_DELIVERY: "Out for delivery",
  PARTIALLY_DELIVERED: "Partially delivered",
  DELIVERED: "Delivered",
  FAILED_DELIVERY: "Failed delivery",
  RETURNED_TO_WAREHOUSE: "Returned to warehouse",
  PARTIAL_LOAD: "Partial load",
  UNLOADED: "Unloaded",
});

function formatLocation(value) {
  if (value == null || value === "") return null;
  if (typeof value === "string" || typeof value === "number") {
    return String(value);
  }
  if (typeof value === "object") {
    const lat = value.lat ?? value.latitude;
    const lng = value.lng ?? value.longitude;
    if (lat != null && lng != null) {
      return `${lat}, ${lng}`;
    }
  }
  return null;
}

function normalizeTimestamp(value) {
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

function getEventTitle(eventType, fallbackStatus) {
  const key = String(eventType || fallbackStatus || "")
    .trim()
    .toUpperCase();
  if (EVENT_TITLES[key]) return EVENT_TITLES[key];
  return key.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

function resolveActorName(entry = {}) {
  const name =
    entry.checkerName ||
    entry.driverName ||
    entry.warehouseManagerName ||
    entry.by ||
    entry.createdBy ||
    null;
  return typeof name === "string" || typeof name === "number" ? String(name) : null;
}

function normalizeLocation(value) {
  if (value == null || value === "") return null;
  if (typeof value === "string" || typeof value === "number") {
    return String(value);
  }
  if (typeof value === "object") {
    const lat = value.lat ?? value.latitude;
    const lng = value.lng ?? value.longitude;
    if (lat != null && lng != null) {
      return `${lat}, ${lng}`;
    }
  }
  return null;
}

function formatLedgerEvent(doc) {
  const data = doc.data ? doc.data() : doc;
  const eventType = String(data.eventType || "").toUpperCase();

  return {
    eventId: data.eventId || doc.id || null,
    shipmentId: data.shipmentId || null,
    pieceId: data.pieceId || null,
    eventType,
    title: getEventTitle(eventType),
    timestamp: normalizeTimestamp(data.timestamp || data.createdAt),
    actorName: resolveActorName(data),
    actorRole: data.createdByRole || null,
    location: normalizeLocation(data.location),
    tripId: data.tripId || null,
    manifestId: data.manifestId || null,
    truckId: data.truckId || null,
    truckName: data.truckName || data.truckInternalCode || null,
    truckPlate: data.truckPlate || data.truckPlateNumber || null,
    driverName: data.driverName || null,
    checkerName: data.checkerName || null,
    warehouseManagerName: data.warehouseManagerName || null,
    deliveryVehicleId: data.deliveryVehicleId || null,
    deliveryVehicleName: data.deliveryVehicleName || null,
    proofPhotoUrl: data.proofPhotoUrl || null,
    remarks: data.remarks || null,
    deviceId: data.deviceId || null,
    eventHash: data.eventHash || null,
    source: data.source || "event_ledger",
  };
}

function formatStatusHistoryEvent(shipmentId, entry, index) {
  const status = String(entry?.status || "").toUpperCase();

  return {
    eventId: `status-history-${index}`,
    shipmentId,
    pieceId: null,
    eventType: status,
    title: getEventTitle(status, status),
    timestamp: normalizeTimestamp(entry?.at),
    actorName: resolveActorName({ by: entry?.by }),
    actorRole: null,
    location: normalizeLocation(entry?.location),
    tripId: null,
    manifestId: null,
    truckId: null,
    truckName: null,
    truckPlate: null,
    driverName: null,
    checkerName: null,
    warehouseManagerName: null,
    deliveryVehicleId: null,
    deliveryVehicleName: null,
    proofPhotoUrl: null,
    remarks: entry?.note || null,
    source: "status_history",
  };
}

function normalizeEventGroup(eventType) {
  const key = String(eventType || "").trim().toUpperCase();
  if (key === "RELEASED_TO_CHECKER" || key === "ASSIGNED") {
    return "ASSIGNED_TO_CHECKER";
  }
  return key;
}

function timestampsNearDuplicate(a, b, windowMs = 120000) {
  const aMs = a ? new Date(a).getTime() : 0;
  const bMs = b ? new Date(b).getTime() : 0;
  if (!aMs || !bMs) return false;
  return Math.abs(aMs - bMs) <= windowMs;
}

function eventsAreDuplicate(a, b) {
  if (normalizeEventGroup(a.eventType) !== normalizeEventGroup(b.eventType)) {
    return false;
  }
  return timestampsNearDuplicate(a.timestamp, b.timestamp);
}

function preferTimelineEvent(current, candidate) {
  if (!current) return candidate;
  if (!candidate) return current;

  const sourceRank = {
    event_ledger: 2,
    status_history: 1,
  };
  const currentRank = sourceRank[current.source] || 0;
  const candidateRank = sourceRank[candidate.source] || 0;
  if (candidateRank !== currentRank) {
    return candidateRank > currentRank ? candidate : current;
  }

  const currentFields = [
    current.checkerName,
    current.deliveryVehicleName,
    current.warehouseManagerName,
    current.tripId,
    current.truckName,
    current.driverName,
    current.remarks,
  ].filter(Boolean).length;
  const candidateFields = [
    candidate.checkerName,
    candidate.deliveryVehicleName,
    candidate.warehouseManagerName,
    candidate.tripId,
    candidate.truckName,
    candidate.driverName,
    candidate.remarks,
  ].filter(Boolean).length;

  return candidateFields >= currentFields ? candidate : current;
}

function dedupeTimelineEvents(events = []) {
  const sorted = sortTimelineEvents([...events]);
  const result = [];

  for (const event of sorted) {
    const duplicateIndex = result.findIndex((existing) =>
      eventsAreDuplicate(existing, event),
    );

    if (duplicateIndex >= 0) {
      result[duplicateIndex] = preferTimelineEvent(
        result[duplicateIndex],
        event,
      );
      continue;
    }

    result.push(event);
  }

  return result;
}

function sortTimelineEvents(events = []) {
  return [...events].sort((a, b) => {
    const aMs = a.timestamp ? new Date(a.timestamp).getTime() : 0;
    const bMs = b.timestamp ? new Date(b.timestamp).getTime() : 0;
    return aMs - bMs;
  });
}

module.exports = {
  EVENT_TITLES,
  formatLedgerEvent,
  formatStatusHistoryEvent,
  dedupeTimelineEvents,
  sortTimelineEvents,
  getEventTitle,
  eventsAreDuplicate,
  preferTimelineEvent,
};
