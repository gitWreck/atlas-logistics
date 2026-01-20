"use strict";

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

/* =========================
   HELPERS
========================= */
function requireString(v, field) {
  if (typeof v !== "string" || !v.trim()) {
    throw new HttpsError("invalid-argument", `Missing/invalid: ${field}`);
  }
  return v.trim();
}

function optionalString(v) {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

function cleanCode(code) {
  return String(code || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

function yyyymmddFromDate(d) {
  return (
    d.getFullYear().toString() +
    String(d.getMonth() + 1).padStart(2, "0") +
    String(d.getDate()).padStart(2, "0")
  );
}

function pad4(n) {
  return String(n).padStart(4, "0");
}

async function assertAdminOrManager(tx, uid) {
  const userRef = db.collection("users").doc(uid);
  const userSnap = await tx.get(userRef);

  if (!userSnap.exists) {
    throw new HttpsError("permission-denied", "User profile missing");
  }

  const u = userSnap.data() || {};
  if (u.active !== true) {
    throw new HttpsError("permission-denied", "User is inactive");
  }

  const role = String(u.role || "").toLowerCase();
  if (role !== "admin" && role !== "manager") {
    throw new HttpsError("permission-denied", "Admin/Manager only");
  }

  return { role, name: u.name || null };
}

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
exports.createTruckTrip = onCall(async (req) => {
  if (!req.auth?.uid) {
    throw new HttpsError("unauthenticated", "Login required");
  }

  // Required route
  const originCode = cleanCode(requireString(req.data?.originCode, "originCode"));
  const destCode = cleanCode(requireString(req.data?.destCode, "destCode"));

  // Optional fields
  const truckPlateNumber = optionalString(req.data?.truckPlateNumber);
  const truckInternalCode = optionalString(req.data?.truckInternalCode);
  const driverName = optionalString(req.data?.driverName);
  const driverId = optionalString(req.data?.driverId);

  // Optional: client-side idempotency to prevent duplicate trips on retries/double click
  const idempotencyKey =
    typeof req.data?.idempotencyKey === "string" && req.data.idempotencyKey.trim()
      ? req.data.idempotencyKey.trim()
      : null;

  // We store a trip counter per day+route to generate a nice tripId
  const today = yyyymmddFromDate(new Date());
  const counterKey = `${today}_${originCode}_${destCode}`;

  const counterRef = db.collection("counters").doc(`trip_${counterKey}`);

  // Deterministic doc id if idempotencyKey provided (prevents duplicates)
  // NOTE: this is safe because only Admin/Manager can call function.
  const tripRef = idempotencyKey
    ? db.collection("truck_trips").doc(`${counterKey}_${idempotencyKey}`)
    : db.collection("truck_trips").doc();

  return db.runTransaction(async (tx) => {
    const { role } = await assertAdminOrManager(tx, req.auth.uid);

    // If idempotencyKey doc already exists -> return it (no new sequence allocation)
    if (idempotencyKey) {
      const existing = await tx.get(tripRef);
      if (existing.exists) {
        const d = existing.data() || {};
        return {
          success: true,
          reused: true,
          tripDocId: tripRef.id,
          tripId: d.tripId || null,
        };
      }
    }

    // Allocate the next trip number for the day+route
    const counterSnap = await tx.get(counterRef);
    const last = counterSnap.exists ? Number(counterSnap.data()?.value || 0) : 0;
    const next = last + 1;

    // Human ID you can show in UI
    const tripId = `TRIP-${today}-${originCode}-${destCode}-${pad4(next)}`;

    // Core trip record
    const tripData = {
      // identity
      tripId,
      originCode,
      destCode,

      // assignment (optional)
      truckPlateNumber: truckPlateNumber || null,
      truckInternalCode: truckInternalCode || null,
      driverName: driverName || null,
      driverId: driverId || null,

      // operational state
      status: "CREATED",
      statusIndex: 0,
      active: true,

      // counters used by your load/unload pipeline
      lastSequence: 0,        // used by createShipmentWithSequence
      totalLoaded: 0,         // aggregate across packages (optional)
      totalPackages: 0,       // optional (you can maintain in functions)
      totalItemsPlanned: 0,   // optional
      totalItemsLoaded: 0,    // optional

      // delay system (optional)
      delayReason: null,
      delayCleared: false,
      delayStartedAt: null,
      delayClearedAt: null,

      // audit (immutable)
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      createdBy: req.auth.uid,
      createdRole: role,

      // last update (mutable but server-set)
      lastUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
      lastUpdatedBy: req.auth.uid,
      lastUpdatedRole: role,
    };

    tx.set(tripRef, tripData);

    // Update counter (server-owned)
    tx.set(counterRef, {
      value: next,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedBy: req.auth.uid,
    }, { merge: true });

    // Admin audit log (append-only collection; rules allow read admin only)
    const logRef = db.collection("admin_logs").doc();
    tx.set(logRef, {
      action: "CREATE_TRIP",
      tripDocId: tripRef.id,
      tripId,
      originCode,
      destCode,
      actorUid: req.auth.uid,
      actorRole: role,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      meta: {
        truckPlateNumber: truckPlateNumber || null,
        truckInternalCode: truckInternalCode || null,
        driverName: driverName || null,
        driverId: driverId || null,
      },
    });

    return {
      success: true,
      tripDocId: tripRef.id,
      tripId,
      originCode,
      destCode,
      sequence: next,
    };
  });
});
