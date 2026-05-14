"use strict";

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const {
  requireRole,
  optionalString,
  updatedBy,
} = require("../utilities/helpers");
const { writeTripActionLog } = require("../utilities/tripLogger");

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

const EDITABLE_STATUSES = new Set(["CREATED"]);
const TRIP_TYPES = new Set(["HUB_TRANSFER", "LOCAL_PICKUP", "DELIVERY"]);

function normalizeTripType(value) {
  const tripType = String(value || "HUB_TRANSFER").toUpperCase();
  if (!TRIP_TYPES.has(tripType)) {
    throw new HttpsError("invalid-argument", "Invalid trip type.");
  }
  return tripType;
}

function buildRoute({ origin, originCode, destination, destinationCode }) {
  if (originCode && destinationCode)
    return `${originCode} -> ${destinationCode}`;
  if (origin && destination) return `${origin} -> ${destination}`;
  return null;
}

exports.updateTripDetails = onCall(
  { region: "asia-southeast1", maxInstances: 10 },
  async (req) => {
    await requireRole(db, req, ["admin"]);

    const tripId = optionalString(req.data?.tripId);
    if (!tripId) {
      throw new HttpsError("invalid-argument", "tripId is required.");
    }

    const tripType = normalizeTripType(req.data?.tripType);
    const origin = optionalString(req.data?.origin);
    const originCode = optionalString(req.data?.originCode);
    const destination = optionalString(req.data?.destination);
    const destinationCode = optionalString(req.data?.destinationCode);

    if (tripType === "HUB_TRANSFER") {
      if (!originCode || !destinationCode) {
        throw new HttpsError(
          "invalid-argument",
          "Origin and destination are required for warehouse transfers.",
        );
      }

      if (originCode === destinationCode) {
        throw new HttpsError(
          "invalid-argument",
          "Origin and destination cannot be the same.",
        );
      }
    }

    const actor = updatedBy(req);
    const uid = actor.uid;
    const role = actor.role || req.auth.token?.role || "admin";
    const actorName = actor.name || req.auth.token?.name || null;
    const tripRef = db.collection("truck_trips").doc(tripId);
    const shipmentsQuery = tripRef.collection("trip_shipments").limit(1);

    await db.runTransaction(async (tx) => {
      const tripSnap = await tx.get(tripRef);
      if (!tripSnap.exists) {
        throw new HttpsError("not-found", "Trip not found.");
      }

      const shipmentsSnap = await tx.get(shipmentsQuery);
      if (!shipmentsSnap.empty) {
        throw new HttpsError(
          "failed-precondition",
          "Trip details can only be edited before shipments are assigned.",
        );
      }

      const trip = tripSnap.data();
      const status = String(trip.status || "").toUpperCase();

      if (trip.manifestLocked) {
        throw new HttpsError(
          "failed-precondition",
          "Manifest is locked. Unlock it before editing trip details.",
        );
      }

      if (trip.active === false || !EDITABLE_STATUSES.has(status)) {
        throw new HttpsError(
          "failed-precondition",
          "Trip details can only be edited while the trip is still CREATED.",
        );
      }

      const now = admin.firestore.FieldValue.serverTimestamp();
      const detailsPayload = {
        tripType,
        origin: origin || null,
        originCode: originCode || null,
        destination: destination || null,
        destinationCode: destinationCode || null,
        route: buildRoute({ origin, originCode, destination, destinationCode }),
      };
      const updatePayload = {
        ...detailsPayload,
        updatedAt: now,
        updatedBy: actorName,
        updatedRole: role,
        lastUpdatedAt: now,
        lastUpdatedBy: actorName,
        lastUpdatedRole: role,
      };

      tx.update(tripRef, updatePayload);

      tx.set(tripRef.collection("status_events").doc(), {
        type: "UPDATE_TRIP_DETAILS",
        message: "Trip details updated.",
        createdAt: now,
        createdBy: actorName,
        createdRole: role,
        changes: detailsPayload,
      });

      writeTripActionLog({
        db,
        tx,
        action: "UPDATE_TRIP_DETAILS",
        tripId: trip.tripId || tripId,
        tripDocId: tripId,
        actorId: uid,
        actorName,
        actorRole: role,
        createdAt: now,
        meta: {
          previous: {
            tripType: trip.tripType || null,
            origin: trip.origin || null,
            originCode: trip.originCode || null,
            destination: trip.destination || null,
            destinationCode: trip.destinationCode || null,
            route: trip.route || null,
          },
          next: detailsPayload,
        },
      });
    });

    return {
      success: true,
      tripId,
    };
  },
);
