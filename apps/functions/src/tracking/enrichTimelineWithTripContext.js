"use strict";

const {
  extractTripEventContext,
  eventShouldEnrichWithTrip,
  mergeTripContextIntoEvent,
  extractTripIdFromNote,
} = require("./tripEventContext");

async function resolveTripRecord(db, tripKey) {
  const normalizedKey = String(tripKey || "").trim();
  if (!normalizedKey) return null;

  const directSnap = await db.collection("truck_trips").doc(normalizedKey).get();
  if (directSnap.exists) {
    return { id: directSnap.id, data: directSnap.data() || {} };
  }

  const querySnap = await db
    .collection("truck_trips")
    .where("tripId", "==", normalizedKey)
    .limit(1)
    .get();

  if (!querySnap.empty) {
    const doc = querySnap.docs[0];
    return { id: doc.id, data: doc.data() || {} };
  }

  return null;
}

async function loadTripContextMap(db, tripIds = []) {
  const uniqueIds = [...new Set(tripIds.filter(Boolean))];
  if (!uniqueIds.length) return {};

  const tripRecords = await Promise.all(
    uniqueIds.map((tripId) => resolveTripRecord(db, tripId)),
  );

  const tripDataById = {};
  const truckIds = new Set();

  tripRecords.forEach((record) => {
    if (!record) return;
    tripDataById[record.id] = record.data;
    if (record.data.tripId && record.data.tripId !== record.id) {
      tripDataById[record.data.tripId] = record.data;
    }
    if (record.data.truckId) truckIds.add(record.data.truckId);
  });

  const truckDataById = {};
  if (truckIds.size) {
    const truckSnaps = await Promise.all(
      [...truckIds].map((truckId) =>
        db.collection("trucks").doc(truckId).get(),
      ),
    );
    truckSnaps.forEach((snap) => {
      if (snap.exists) truckDataById[snap.id] = snap.data() || {};
    });
  }

  const contextMap = {};
  Object.entries(tripDataById).forEach(([tripId, tripData]) => {
    const truckData = tripData.truckId
      ? truckDataById[tripData.truckId] || null
      : null;
    contextMap[tripId] = extractTripEventContext(tripData, tripId, truckData);
  });

  return contextMap;
}

function collectTripIdsForTimeline(events = [], shipmentData = {}) {
  const tripIds = new Set();

  if (shipmentData.currentTripId) {
    tripIds.add(shipmentData.currentTripId);
  }

  events.forEach((event) => {
    if (event.tripId) tripIds.add(event.tripId);
    const noteTripId = extractTripIdFromNote(event.remarks);
    if (noteTripId) tripIds.add(noteTripId);
  });

  (Array.isArray(shipmentData.statusHistory)
    ? shipmentData.statusHistory
    : []
  ).forEach((entry) => {
    const noteTripId = extractTripIdFromNote(entry?.note);
    if (noteTripId) tripIds.add(noteTripId);
  });

  return [...tripIds];
}

function enrichTimelineEvents(
  events = [],
  tripContextMap = {},
  shipmentData = {},
) {
  const fallbackTripId =
    shipmentData.currentTripId ||
    extractTripIdFromNote(
      (Array.isArray(shipmentData.statusHistory)
        ? shipmentData.statusHistory
        : []
      )
        .slice()
        .reverse()
        .map((entry) => entry?.note || "")
        .join(" "),
    );

  const fallbackContext = fallbackTripId
    ? tripContextMap[fallbackTripId] || null
    : null;

  return events.map((event) => {
    if (!eventShouldEnrichWithTrip(event.eventType)) {
      return event;
    }

    const noteTripId = extractTripIdFromNote(event.remarks);
    const context =
      (event.tripId && tripContextMap[event.tripId]) ||
      (noteTripId && tripContextMap[noteTripId]) ||
      fallbackContext;

    if (!context) return event;

    return mergeTripContextIntoEvent(event, context);
  });
}

async function enrichTimelineWithTripContext(
  db,
  events = [],
  shipmentData = {},
) {
  const tripIds = collectTripIdsForTimeline(events, shipmentData);
  const tripContextMap = await loadTripContextMap(db, tripIds);
  return enrichTimelineEvents(events, tripContextMap, shipmentData);
}

module.exports = {
  resolveTripRecord,
  loadTripContextMap,
  collectTripIdsForTimeline,
  enrichTimelineEvents,
  enrichTimelineWithTripContext,
};
