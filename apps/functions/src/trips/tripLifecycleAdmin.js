"use strict";

const { HttpsError } = require("firebase-functions/v2/https");
const {
  requireShipmentTripDeleteAccess,
  updatedBy,
} = require("../utilities/helpers");

async function requireTripLifecycleAdmin(db, req) {
  return requireShipmentTripDeleteAccess(db, req);
}

function snapshotTripLifecycleState(trip = {}) {
  return {
    status: trip.status || null,
    active: trip.active ?? null,
    archived: trip.archived ?? false,
    manifestLocked: trip.manifestLocked ?? false,
    manifestStatus: trip.manifestStatus || null,
    tripType: trip.tripType || null,
  };
}

function assertTripNotArchived(trip = {}) {
  if (trip.archived === true) {
    throw new HttpsError(
      "failed-precondition",
      "Trip is already archived.",
    );
  }
}

module.exports = {
  requireTripLifecycleAdmin,
  snapshotTripLifecycleState,
  assertTripNotArchived,
  updatedBy,
};
