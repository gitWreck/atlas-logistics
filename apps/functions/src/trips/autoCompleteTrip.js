"use strict";

const { FieldValue } = require("firebase-admin/firestore");
const { logger } = require("firebase-functions");
const { writeTripActionLog } = require("../utilities/tripLogger");
const {
  TRIP_STATUSES,
  normalizeTripStatus,
  shouldPromoteTripToCompleted,
  getTripStatusSideEffects,
} = require("./tripLifecycle");
const { evaluateTripScopedDelivery } = require("./tripScopedDelivery");

async function loadTripShipmentRows(tx, tripRef) {
  const snap = await tx.get(tripRef.collection("trip_shipments"));
  return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}

/**
 * Merge master shipment status so hub trips can complete after last-mile delivery
 * even when trip_shipments rows were last updated at hub unload (ARRIVED).
 */
async function enrichTripShipmentRowsFromShipments(tx, db, tripId, rows = []) {
  if (!rows.length) return rows;

  const shipmentSnaps = await Promise.all(
    rows.map((row) => {
      const shipmentId = row.trackingShipmentId || row.id;
      if (!shipmentId) return Promise.resolve(null);
      return tx.get(db.collection("shipments").doc(shipmentId));
    }),
  );

  return rows.map((row, index) => {
    const snap = shipmentSnaps[index];
    if (!snap?.exists) return row;

    const shipment = snap.data() || {};
    const masterStatus = normalizeTripStatus(shipment.status);
    const scopedDelivery = evaluateTripScopedDelivery(row, shipment, tripId);

    return {
      ...row,
      shipmentStatus: masterStatus,
      tripScopedTotal: scopedDelivery.tripScopedTotal,
      tripScopedDelivered: scopedDelivery.tripScopedDelivered,
      allTripScopedPackagesDelivered:
        scopedDelivery.allTripScopedPackagesDelivered,
    };
  });
}

function mergeTripShipmentRow(rows, patch) {
  if (!patch?.id) return rows;

  const next = [...rows];
  const index = next.findIndex((row) => row.id === patch.id);

  if (index >= 0) {
    next[index] = { ...next[index], ...patch };
  } else {
    next.push(patch);
  }

  return next;
}

function buildTripAutoCompleteUpdate(trip, decision, meta = {}) {
  if (!decision?.promote) return null;

  getTripStatusSideEffects(TRIP_STATUSES.COMPLETED, {
    source: meta.source || "AUTO_ALL_SHIPMENTS_DELIVERED",
  });

  return {
    status: TRIP_STATUSES.COMPLETED,
    active: false,
    completedAt: FieldValue.serverTimestamp(),
    autoCompletedAt: FieldValue.serverTimestamp(),
    autoCompletedBy: meta.actorId || null,
    autoCompletedReason: decision.reason || "ALL_SHIPMENTS_DELIVERED",
    updatedAt: FieldValue.serverTimestamp(),
    ...(meta.actorName ? { updatedBy: meta.actorName } : {}),
  };
}

function appendTripAutoCompleteEvent(tx, tripRef, trip, decision, meta = {}) {
  const eventRef = tripRef.collection("trip_events").doc();
  tx.set(eventRef, {
    type: "AUTO_COMPLETED",
    reason: decision.reason,
    previousStatus: normalizeTripStatus(trip.status),
    newStatus: TRIP_STATUSES.COMPLETED,
    by: meta.actorId || "system",
    at: FieldValue.serverTimestamp(),
  });
}

function appendTripAutoCompleteAudit({ db, tx, tripId, trip, decision, meta }) {
  writeTripActionLog({
    db,
    tx,
    collection: "audit_logs",
    action: "AUTO_COMPLETE_TRIP",
    tripId,
    targetId: tripId,
    targetCollection: "truck_trips",
    actorId: meta.actorId || null,
    actorName: meta.actorName || null,
    actorRole: meta.actorRole || null,
    at: FieldValue.serverTimestamp(),
    note: decision.message || "All trip shipments are complete.",
    details: {
      previousStatus: normalizeTripStatus(trip.status),
      newStatus: TRIP_STATUSES.COMPLETED,
      reason: decision.reason,
    },
  });
}

function evaluateAutoCompleteTrip(
  trip,
  tripShipmentRows = [],
  updatedTripShipment = null,
) {
  let rows = Array.isArray(tripShipmentRows) ? [...tripShipmentRows] : [];
  if (updatedTripShipment) {
    rows = mergeTripShipmentRow(rows, updatedTripShipment);
  }

  const decision = shouldPromoteTripToCompleted(trip, rows);
  const completionPatch = buildTripAutoCompleteUpdate(trip, decision);

  return {
    decision,
    completionPatch,
    completed: Boolean(completionPatch),
  };
}

async function tryAutoCompleteTrip(tripId, meta = {}) {
  if (!tripId) {
    return { completed: false, reason: "MISSING_TRIP_ID" };
  }

  const admin = require("firebase-admin");
  const db = admin.firestore();
  const tripRef = db.collection("truck_trips").doc(tripId);

  return db.runTransaction(async (tx) => {
    const tripSnap = await tx.get(tripRef);
    if (!tripSnap.exists) {
      return { completed: false, reason: "TRIP_NOT_FOUND" };
    }

    const tripShipmentRows = await loadTripShipmentRows(tx, tripRef);
    const enrichedRows = await enrichTripShipmentRowsFromShipments(
      tx,
      db,
      tripRef.id,
      tripShipmentRows,
    );

    const tripData = tripSnap.data() || {};
    const { decision, completionPatch, completed } = evaluateAutoCompleteTrip(
      tripData,
      enrichedRows,
    );

    if (!completed || !completionPatch) {
      logger.info("Auto-complete skipped", {
        tripId,
        reason: decision?.reason || "NOT_READY",
        tripStatus: tripData.status,
      });
      return { completed: false, reason: decision?.reason || "NOT_READY" };
    }

    appendTripAutoCompleteEvent(tx, tripRef, tripData, decision, meta);
    appendTripAutoCompleteAudit({
      db,
      tx,
      tripId: tripRef.id,
      trip: tripData,
      decision,
      meta,
    });

    tx.update(tripRef, {
      ...completionPatch,
      updatedAt: FieldValue.serverTimestamp(),
      ...(meta.actorName ? { updatedBy: meta.actorName } : {}),
    });

    return { completed: true, reason: decision.reason };
  });
}

module.exports = {
  evaluateAutoCompleteTrip,
  tryAutoCompleteTrip,
};
