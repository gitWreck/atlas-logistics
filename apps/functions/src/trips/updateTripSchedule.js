"use strict";

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const {
  assertAdminOrManager,
} = require("../utilities/helpers");
const {
  SEMAPHORE_API_KEY,
  SEMAPHORE_SENDER_NAME,
} = require("../../shared/sms-service");
const {
  broadcastTripLogic,
} = require("../messaging/broadcastTripMessage");
const { writeTripActionLog } = require("../utilities/tripLogger");

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

/* =========================
   FUNCTION
========================= */
/**
 * updateTripSchedule (Callable)
 * -----------------------------
 * Updates schedule-related fields on /truck_trips/{tripId}
 * - Admin/Manager only
 * - Keeps trip creation separate from schedule execution updates
 * - Supports planned loading and actual movement timestamps
 */
exports.updateTripSchedule = onCall(
  {
    region: "asia-southeast1",
    maxInstances: 10,
    secrets: [SEMAPHORE_API_KEY, SEMAPHORE_SENDER_NAME],
  },
  async (req) => {
    if (!req.auth?.uid) {
      throw new HttpsError("unauthenticated", "Login required");
    }

    const tripId = String(req.data?.tripId || req.data?.tripId || "").trim();
    if (!tripId) {
      throw new HttpsError("invalid-argument", "tripId is required.");
    }

    // const plannedLoadingEnd = req.data?.plannedLoadingEnd || null;
    // const actualLoadingStart = req.data?.actualLoadingStart || null;
    // const actualLoadingEnd = req.data?.actualLoadingEnd || null;
    // const actualDeparture = req.data?.actualDeparture || null;
    // const actualArrival = req.data?.actualArrival || null;

    const plannedDeparture = req.data?.plannedDeparture || null;
    const estimatedArrival = req.data?.estimatedArrival || null;
    const plannedLoadingStart = req.data?.plannedLoadingStart || null;
    const notify = !!req.data?.notify;

    const parseOptionalDate = (value, label) => {
      if (!value) return null;
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) {
        throw new HttpsError("invalid-argument", `${label} is invalid.`);
      }
      return value;
    };

    const parsedPlannedLoadingStart = parseOptionalDate(
      plannedLoadingStart,
      "Planned loading start",
    );

    const parsedPlannedDeparture = parseOptionalDate(
      plannedDeparture,
      "Planned departure",
    );

    const parsedEstimatedArrival = parseOptionalDate(
      estimatedArrival,
      "Estimated arrival",
    );

    // const parsedPlannedLoadingEnd = parseOptionalDate(
    //   plannedLoadingEnd,
    //   "Planned loading end",
    // );
    // const parsedActualLoadingStart = parseOptionalDate(
    //   actualLoadingStart,
    //   "Actual loading start",
    // );
    // const parsedActualLoadingEnd = parseOptionalDate(
    //   actualLoadingEnd,
    //   "Actual loading end",
    // );
    // const parsedActualDeparture = parseOptionalDate(
    //   actualDeparture,
    //   "Actual departure",
    // );
    // const parsedActualArrival = parseOptionalDate(
    //   actualArrival,
    //   "Actual arrival",
    // );

    const ensureLater = (startValue, endValue, startLabel, endLabel) => {
      if (!startValue || !endValue) return;
      const start = new Date(startValue);
      const end = new Date(endValue);

      if (end < start) {
        throw new HttpsError(
          "invalid-argument",
          `${endLabel} must be later than ${startLabel}.`,
        );
      }
    };

    ensureLater(
      parsedPlannedDeparture,
      parsedEstimatedArrival,
      "planned departure",
      "estimated arrival",
    );

    ensureLater(
      parsedPlannedLoadingStart,
      "",
      // parsedPlannedLoadingEnd,
      "planned loading start",
      // "planned loading end",
      "",
    );

    // ensureLater(
    //   parsedActualLoadingStart,
    //   parsedActualLoadingEnd,
    //   "actual loading start",
    //   "actual loading end",
    // );

    // ensureLater(
    //   parsedActualDeparture,
    //   parsedActualArrival,
    //   "actual departure",
    //   "actual arrival",
    // );

    const tripRef = db.collection("truck_trips").doc(tripId);

    const result = await db.runTransaction(async (tx) => {
      const { role } = await assertAdminOrManager(db, tx, req.auth.uid);

      const tripSnap = await tx.get(tripRef);
      if (!tripSnap.exists) {
        throw new HttpsError("not-found", "Trip not found.");
      }

      const trip = tripSnap.data();

      if (trip.active === false || trip.status === "COMPLETED") {
        throw new HttpsError(
          "failed-precondition",
          "Cannot update schedule for a completed trip.",
        );
      }

      const now = admin.firestore.FieldValue.serverTimestamp();

      const schedulePayload = {
        plannedDeparture: parsedPlannedDeparture,
        estimatedArrival: parsedEstimatedArrival,
        plannedLoadingStart: parsedPlannedLoadingStart,
        // plannedLoadingEnd: parsedPlannedLoadingEnd,
        // actualLoadingStart: parsedActualLoadingStart,
        // actualLoadingEnd: parsedActualLoadingEnd,
        // actualDeparture: parsedActualDeparture,
        // actualArrival: parsedActualArrival,
        updatedAt: now,
        updatedBy: req.auth.uid,
        updatedRole: role,
      };

      tx.update(tripRef, schedulePayload);

      tx.set(tripRef.collection("status_events").doc(), {
        type: "UPDATE_TRIP_SCHEDULE",
        message: "Trip schedule updated.",
        createdAt: now,
        createdBy: req.auth.uid,
        createdRole: role,
        changes: {
          plannedDeparture: parsedPlannedDeparture,
          estimatedArrival: parsedEstimatedArrival,
          plannedLoadingStart: parsedPlannedLoadingStart,
          // plannedLoadingEnd: parsedPlannedLoadingEnd,
          // actualLoadingStart: parsedActualLoadingStart,
          // actualLoadingEnd: parsedActualLoadingEnd,
          // actualDeparture: parsedActualDeparture,
          // actualArrival: parsedActualArrival,
        },
      });

      writeTripActionLog({
        db,
        tx,
        action: "UPDATE_TRIP_SCHEDULE",
        tripId: trip.tripId || tripId,
        tripDocId: tripId,
        actorId: req.auth.uid,
        actorName: req.auth.token?.name || null,
        actorRole: role,
        createdAt: now,
        meta: {
          plannedDeparture: parsedPlannedDeparture,
          estimatedArrival: parsedEstimatedArrival,
          plannedLoadingStart: parsedPlannedLoadingStart,
          // plannedLoadingEnd: parsedPlannedLoadingEnd,
          // actualLoadingStart: parsedActualLoadingStart,
          // actualLoadingEnd: parsedActualLoadingEnd,
          // actualDeparture: parsedActualDeparture,
          // actualArrival: parsedActualArrival,
        },
      });

      return {
        success: true,
        tripId,
        tripCode: trip.tripId || tripId,
      };
    });

    if (notify === true) {
      const departureText = formatSmsDate(parsedPlannedDeparture);
      const arrivalText = formatSmsDate(parsedEstimatedArrival);
      const loadingText = formatSmsDate(parsedPlannedLoadingStart);

      const messageParts = [
        `Trip ${result.tripCode} schedule updated.`,
        departureText ? `Departure: ${departureText}.` : null,
        arrivalText ? `Arrival: ${arrivalText}.` : null,
        loadingText ? `Loading: ${loadingText}.` : null,
      ].filter(Boolean);

      const messageText = messageParts.join(" ");

      try {
        await broadcastTripLogic({
          tripId,
          message: messageText,
          actorUid: req.auth.uid || "SYSTEM",
          type: "SCHEDULE_UPDATE",
        });
      } catch (err) {
        console.error("[Notify] Failed to send schedule SMS:", err);
      }
    }

    return result;
  },
);
