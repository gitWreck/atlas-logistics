"use strict";

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");

const {
  optionalString,
  yyyymmddFromDate,
  pad4,
  assertAdminOrManager,
} = require("../utilities/helpers");
const { writeTripActionLog } = require("../utilities/tripLogger");
const { MANIFEST_STATUS } = require("./manifestStatus");
const {
  canAccessRecord,
  canAccessStaff,
} = require("../manager/managerAccess");

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

function getTripTypePrefix(tripType) {
  const normalized = String(tripType || "HUB_TRANSFER").toUpperCase();

  switch (normalized) {
    case "HUB_TRANSFER":
      return "HUB";
    case "LOCAL_PICKUP":
      return "PKP";
    case "DELIVERY":
      return "DEL";
    default:
      return "TRP";
  }
}

exports.createTruckTrip = onCall(
  { region: "asia-southeast1", maxInstances: 10 },
  async (req) => {
    if (!req.auth?.uid) {
      throw new HttpsError("unauthenticated", "Login required");
    }

    const tripType = req.data?.tripType || "HUB_TRANSFER";
    const tripPrefix = getTripTypePrefix(tripType);

    const originCode = optionalString(req.data?.originCode);
    const destinationCode = optionalString(req.data?.destinationCode);

    const truckPlateNumber = optionalString(req.data?.truckPlateNumber);
    const truckInternalCode = optionalString(req.data?.truckInternalCode);
    const driverName = optionalString(req.data?.driverName);
    const driverId = optionalString(req.data?.driverId);
    const helperName = optionalString(req.data?.helperName);

    const plannedDeparture = req.data?.plannedDeparture;
    const estimatedArrival = req.data?.estimatedArrival;
    const actorSnap = await db.collection("users").doc(req.auth.uid).get();
    const actorProfile = actorSnap.exists
      ? { id: actorSnap.id, ...actorSnap.data() }
      : {};
    const actorRole = String(actorProfile.role || "").toLowerCase();

    if (
      actorRole === "manager" &&
      !canAccessRecord(actorProfile, {
        origin: req.data?.origin,
        originCode,
        destination: req.data?.destination,
        destinationCode,
        municipality: req.data?.municipality,
      })
    ) {
      throw new HttpsError(
        "permission-denied",
        "The trip is outside your assigned warehouse or municipality.",
      );
    }

    if (!plannedDeparture) {
      throw new HttpsError(
        "invalid-argument",
        "Planned departure is required.",
      );
    }

    if (!estimatedArrival) {
      throw new HttpsError(
        "invalid-argument",
        "Estimated arrival is required.",
      );
    }

    const plannedDepartureDate = new Date(plannedDeparture);
    const estimatedArrivalDate = new Date(estimatedArrival);

    if (Number.isNaN(plannedDepartureDate.getTime())) {
      throw new HttpsError("invalid-argument", "Planned departure is invalid.");
    }

    if (Number.isNaN(estimatedArrivalDate.getTime())) {
      throw new HttpsError("invalid-argument", "Estimated arrival is invalid.");
    }

    if (estimatedArrivalDate <= plannedDepartureDate) {
      throw new HttpsError(
        "invalid-argument",
        "Estimated arrival must be later than planned departure.",
      );
    }

    if (tripType === "HUB_TRANSFER") {
      if (!originCode) {
        throw new HttpsError(
          "invalid-argument",
          "Origin is required for Warehouse Transfers.",
        );
      }

      if (!destinationCode) {
        throw new HttpsError(
          "invalid-argument",
          "Destination is required for Warehouse Transfers.",
        );
      }

      if (originCode === destinationCode) {
        throw new HttpsError(
          "invalid-argument",
          "Origin and Destination cannot be the same.",
        );
      }
    }

    const truckDocId = req.data?.truckId || null;
    const truckRef = truckDocId
      ? db.collection("trucks").doc(truckDocId)
      : null;

    let driver = null;

    if (driverId) {
      const snap = await db.collection("users").doc(driverId).get();
      if (!snap.exists) {
        throw new HttpsError("not-found", "Selected driver was not found.");
      }
      driver = snap.data() || null;
      if (
        actorRole === "manager" &&
        !canAccessStaff(actorProfile, { id: snap.id, ...driver })
      ) {
        throw new HttpsError(
          "permission-denied",
          "The selected driver is outside your assigned scope.",
        );
      }
    }

    const today = yyyymmddFromDate(new Date());
    const counterKey = `${today}_${tripPrefix}`;
    const counterRef = db.collection("counters").doc(`trip_${counterKey}`);

    return db.runTransaction(async (tx) => {
      const { role } = await assertAdminOrManager(db, tx, req.auth.uid);

      const counterSnap = await tx.get(counterRef);
      const last = counterSnap.exists
        ? Number(counterSnap.data()?.value || 0)
        : 0;
      const next = last + 1;

      const tripId = `TRIP-${tripPrefix}-${today}-${pad4(next)}`;
      const tripRef = db.collection("truck_trips").doc(tripId);

      const checkSnap = await tx.get(tripRef);
      if (checkSnap.exists) {
        throw new HttpsError("aborted", "Trip ID collision. Please retry.");
      }

      const isHubTransfer = tripType === "HUB_TRANSFER";

      const tripData = {
        tripId,
        tripType,

        origin: optionalString(req.data?.origin),
        originCode: originCode || null,
        destination: optionalString(req.data?.destination),
        destinationCode: destinationCode || null,
        route:
          originCode && destinationCode
            ? `${originCode} -> ${destinationCode}`
            : null,

        truckId: truckDocId,
        truckPlateNumber: truckPlateNumber || null,

        driverName: driverName || null,
        driverId: driverId || null,
        driverPhone: driver?.phoneNumber || null,

        helperName: helperName || null,
        plannedDeparture,
        estimatedArrival,

        status: "CREATED",
        statusIndex: 0,
        active: true,

        manifestStatus: isHubTransfer ? MANIFEST_STATUS.OPEN : null,
        manifestLocked: false,

        totalLoaded: 0,
        totalItems: 0,

        delayReason: null,
        delayStartedAt: null,
        delayClearedAt: null,

        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        createdBy: req.auth.uid,
        createdRole: role,

        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedBy: req.auth.uid,
        updatedRole: role,
      };

      if (truckRef) {
        const truckSnap = await tx.get(truckRef);
        if (!truckSnap.exists) {
          throw new HttpsError(
            "not-found",
            "The selected truck was not found.",
          );
        }

        tx.update(truckRef, {
          status: "ASSIGNED",
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedBy: req.auth.uid,
        });
      }

      tx.set(tripRef, tripData);

      tx.set(
        counterRef,
        {
          value: next,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedBy: req.auth.uid,
        },
        { merge: true },
      );

      writeTripActionLog({
        db,
        tx,
        action: "CREATE_TRIP",
        tripDocId: tripRef.id,
        tripId,
        tripType,
        tripPrefix,
        originCode: originCode || null,
        destinationCode: destinationCode || null,
        actorId: req.auth.uid,
        actorName: req.auth.token?.name || null,
        actorRole: role,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        meta: {
          truckPlateNumber: truckPlateNumber || null,
          truckInternalCode: truckInternalCode || null,
          driverName: driverName || null,
          driverId: driverId || null,
          driverPhone: driver?.phoneNumber || null,
        },
      });

      return {
        success: true,
        tripDocId: tripRef.id,
        tripId,
        tripType,
        tripPrefix,
        originCode: originCode || null,
        destinationCode: destinationCode || null,
        sequence: next,
      };
    });
  },
);
