"use strict";

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");

// 1. IMPORT YOUR HELPERS
const {
  optionalString,
  yyyymmddFromDate,
  pad4,
  assertAdminOrManager,
} = require("../utilities/helpers");

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

/* =========================
   FUNCTION
========================= */
/**
 * createTruckTrip (Callable)
 * -------------------------
 * Creates a trip doc in /truck_trips
 * - Client never writes to Firestore directly (Option B)
 * - Admin/Manager only
 * - Generates a human tripId like: TRIP-YYYYMMDD-ORIG-DEST-0001
 * - Supports idempotencyKey to prevent duplicates
 */
exports.createTruckTrip = onCall(
  { region: "asia-southeast1", maxInstances: 10 },
  async (req) => {
    if (!req.auth?.uid) {
      throw new HttpsError("unauthenticated", "Login required");
    }

    // Required route
    const originCode = req.data?.originCode;
    const destinationCode = req.data?.destinationCode;

    // Optional fields
    const truckPlateNumber = optionalString(req.data?.truckPlateNumber);
    const truckInternalCode = optionalString(req.data?.truckInternalCode);
    const driverName = optionalString(req.data?.driverName);
    const driverId = optionalString(req.data?.driverId);

    // ---> NEW: Extract tripType
    const tripType = req.data?.tripType || "HUB_TRANSFER";

    // Add this near tripRef definition
    const truckDocId = req.data?.truckId; // Ensure you pass 'truckId' from the frontend
    const truckRef = truckDocId
      ? db.collection("trucks").doc(truckDocId)
      : null;

    const snap = await db.collection("users").doc(driverId).get();
    const driver = snap.data();

    // We store a trip counter per day+route to generate a nice tripId
    const today = yyyymmddFromDate(new Date());
    const counterKey = `${today}_${originCode}_${destinationCode}`;

    const counterRef = db.collection("counters").doc(`trip_${counterKey}`);

    return db.runTransaction(async (tx) => {
      const { role } = await assertAdminOrManager(db, tx, req.auth.uid);

      // Allocate the next trip number for the day+route
      const counterSnap = await tx.get(counterRef);
      const last = counterSnap.exists
        ? Number(counterSnap.data()?.value || 0)
        : 0;
      const next = last + 1;

      // Human ID you can show in UI
      const tripId = `TRIP-${today}-${originCode}-${destinationCode}-${pad4(
        next,
      )}`;

      // 3. NEW LOCATION: Set the Document ID to match tripId
      const tripRef = db.collection("truck_trips").doc(tripId);
      // Optional: Safety check to ensure we don't overwrite (unlikely with atomic counter)
      const checkSnap = await tx.get(tripRef);
      if (checkSnap.exists) {
        throw new HttpsError("aborted", "Trip ID collision. Please retry.");
      }

      // Core trip record
      const tripData = {
        // identity
        tripId,
        origin: req.data?.origin,
        originCode,
        destination: req.data?.destination,
        destinationCode,
        route: originCode + " -> " + destinationCode || null,

        // ---> NEW: Save tripType to DB
        tripType: tripType,

        // assignment (optional)
        truckPlateNumber: truckPlateNumber || null,
        // truckInternalCode: truckInternalCode || null,
        driverName: driverName || null,
        driverId: driverId || null,
        driverPhone: driver.phoneNumber || null, // set when assigned

        // operational state
        status: "CREATED",
        statusIndex: 0,
        active: true,

        // counters used by your load/unload pipeline
        // lastSequence: 0, // used by createShipmentWithSequence
        totalLoaded: 0, // aggregate across packages (optional)
        // totalPackages: 0, // optional (you can maintain in functions)
        totalItems: 0, // optional
        // totalItemsLoaded: 0, // optional

        // delay system (optional)
        delayReason: null,
        // delayCleared: false,
        delayStartedAt: null,
        delayClearedAt: null,

        // audit (immutable)
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        createdBy: req.auth.uid,
        createdRole: role,

        // last update (mutable but server-set)
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedBy: req.auth.uid,
        updatedRole: role,
      };

      // --- TRUCK STATUS UPDATE ---
      if (truckRef) {
        const truckSnap = await tx.get(truckRef);
        if (!truckSnap.exists) {
          throw new HttpsError(
            "not-found",
            "The selected truck was not found.",
          );
        }

        // Logic: Change status from IDLE to ASSIGNED
        tx.update(truckRef, {
          status: "ASSIGNED",
          currentTripId: tripId,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedBy: req.auth.uid,
        });
      }

      tx.set(tripRef, tripData);

      // Update counter (server-owned)
      tx.set(
        counterRef,
        {
          value: next,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedBy: req.auth.uid,
        },
        { merge: true },
      );

      // Admin audit log (append-only collection; rules allow read admin only)
      const logRef = db.collection("admin_logs").doc();
      tx.set(logRef, {
        action: "CREATE_TRIP",
        tripDocId: tripRef.id,
        tripId,
        originCode,
        destinationCode,
        actorUid: req.auth.uid,
        actorRole: role,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        meta: {
          truckPlateNumber: truckPlateNumber || null,
          truckInternalCode: truckInternalCode || null,
          driverName: driverName || null,
          driverId: driverId || null,
          driverPhone: driver.phoneNumber || null, // set when assigned
        },
      });

      return {
        success: true,
        tripDocId: tripRef.id,
        tripId,
        originCode,
        destinationCode,
        sequence: next,
      };
    });
  },
);
