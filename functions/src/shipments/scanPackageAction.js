"use strict";

/**
 * scanPackageAction (Callable)
 * ---------------------------------------------------------
 * ✅ One canonical scan endpoint for Web + RN
 * ✅ Role-gated (checker/driver/manager/admin)
 * ✅ Transaction-safe
 * ✅ Writes status_events
 * ✅ Updates tracking_records + trip_packages
 * ✅ Optional partial counts
 *
 * Actions:
 * - RECEIVE
 * - LOAD
 * - UNLOAD
 * - DELIVER
 * - PARTIAL
 */

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;

// -------- Helpers --------
function requireAuth(request) {
  if (!request.auth?.uid) throw new HttpsError("unauthenticated", "Login required");
  return request.auth.uid;
}

function str(v) {
  return typeof v === "string" ? v.trim() : "";
}

function normalizeTracking(s) {
  return str(s).toUpperCase();
}

function asInt(v, def = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.floor(n) : def;
}

async function getUserRoleTx(tx, uid) {
  const uref = db.collection("users").doc(uid);
  const snap = await tx.get(uref);
  if (!snap.exists) throw new HttpsError("permission-denied", "User not found");
  const u = snap.data() || {};
  if (u.active !== true) throw new HttpsError("permission-denied", "Inactive user");
  const role = String(u.role || "").toLowerCase();
  if (!["admin", "manager", "checker", "driver"].includes(role)) {
    throw new HttpsError("permission-denied", "Invalid role");
  }
  return { role, name: u.name || u.fullName || null };
}

function assertRole(role, allowed) {
  if (!allowed.includes(role)) {
    throw new HttpsError("permission-denied", `Role ${role} not allowed for this action`);
  }
}

// status map (adjust labels to match your current strings if needed)
const STATUS = {
  CREATED: "Created",
  RECEIVED: "Received",
  LOADED: "Loaded",
  IN_TRANSIT: "In Transit",
  OUT_FOR_DELIVERY: "Out for Delivery",
  DELIVERED: "Delivered",
  DELAYED: "Delayed",
};

// -------- Main --------
exports.scanPackageAction = onCall(
  { region: "asia-southeast1", timeoutSeconds: 60, memory: "512MiB" },
  async (request) => {
    const uid = requireAuth(request);

    const action = str(request.data?.action).toUpperCase();
    const trackingNumber = normalizeTracking(request.data?.trackingNumber);
    const tripDocId = str(request.data?.tripDocId) || null; // Firestore doc id in /truck_trips
    const count = asInt(request.data?.count, 0);
    const note = str(request.data?.note) || null;

    if (!action) throw new HttpsError("invalid-argument", "action is required");
    if (!trackingNumber) throw new HttpsError("invalid-argument", "trackingNumber is required");

    const allowedActions = ["RECEIVE", "LOAD", "UNLOAD", "DELIVER", "PARTIAL"];
    if (!allowedActions.includes(action)) {
      throw new HttpsError("invalid-argument", `Invalid action. Use ${allowedActions.join(", ")}`);
    }

    // LOAD/UNLOAD/DELIVER/PARTIAL require a trip
    if (["LOAD", "UNLOAD", "DELIVER", "PARTIAL"].includes(action) && !tripDocId) {
      throw new HttpsError("invalid-argument", "tripDocId is required for this action");
    }

    return db.runTransaction(async (tx) => {
      const actor = await getUserRoleTx(tx, uid);

      // Role gating
      if (action === "RECEIVE") assertRole(actor.role, ["admin", "manager", "checker"]);
      if (action === "LOAD") assertRole(actor.role, ["admin", "manager", "checker"]);
      if (action === "UNLOAD") assertRole(actor.role, ["admin", "manager", "checker"]);
      if (action === "DELIVER") assertRole(actor.role, ["admin", "manager", "checker", "driver"]);
      if (action === "PARTIAL") assertRole(actor.role, ["admin", "manager", "checker", "driver"]);

      // Find tracking_records doc by trackingNumber (your trackShipment does this)
      const snap = await tx.get(
        db.collection("tracking_records").where("trackingNumber", "==", trackingNumber).limit(1)
      );
      if (snap.empty) {
        throw new HttpsError("not-found", `Tracking number not found: ${trackingNumber}`);
      }

      const shipDoc = snap.docs[0];
      const shipRef = shipDoc.ref;
      const ship = shipDoc.data() || {};

      // Optional: guard archived
      if (ship.archived === true) {
        throw new HttpsError("failed-precondition", "Shipment is archived");
      }

      // Trip refs if needed
      let tripRef = null;
      let pkgRef = null;
      let trip = null;
      let pkg = null;

      if (tripDocId) {
        tripRef = db.collection("truck_trips").doc(tripDocId);
        const tripSnap = await tx.get(tripRef);
        if (!tripSnap.exists) throw new HttpsError("not-found", "Trip not found");
        trip = tripSnap.data() || {};

        // Block if completed/closed
        const tripClosed =
          trip.active === false ||
          String(trip.status || "").toUpperCase() === "COMPLETED" ||
          !!trip.completedAt;

        if (tripClosed) {
          throw new HttpsError("failed-precondition", "Trip is closed/completed");
        }

        // package doc id pattern:
        // In your manifest code, doc.id is treated as trackingDocId.
        // Many Atlas builds use tracking_records docId as trip_packages docId.
        // We'll support BOTH:
        // 1) trip_packages/{tracking_records_docId}  (preferred)
        // 2) trip_packages/{any} where trackingNumber == ...
        pkgRef = tripRef.collection("trip_packages").doc(shipDoc.id);

        const pkgSnap = await tx.get(pkgRef);
        if (pkgSnap.exists) {
          pkg = pkgSnap.data() || {};
        } else {
          // fallback lookup by trackingNumber
          const pkgQuery = await tx.get(
            tripRef.collection("trip_packages").where("trackingNumber", "==", trackingNumber).limit(1)
          );
          if (!pkgQuery.empty) {
            const d = pkgQuery.docs[0];
            pkgRef = d.ref;
            pkg = d.data() || {};
          } else {
            // If loading, we can create the pkg doc (minimal fields)
            if (action === "LOAD") {
              pkg = {
                trackingNumber,
                status: ship.status || STATUS.CREATED,
                statusIndex: Number.isInteger(ship.statusIndex) ? ship.statusIndex : 0,
                packageCount: Number(ship.totalItems || 0),
                loadedCount: Number(ship.loadedCount || 0),
                pendingCount: Number(ship.pendingCount || ship.totalItems || 0),
                createdAt: FieldValue.serverTimestamp(),
              };
              tx.set(pkgRef, pkg, { merge: true });
            } else {
              throw new HttpsError(
                "failed-precondition",
                "Shipment is not attached to this trip_packages"
              );
            }
          }
        }

        // Ensure shipment points to this trip (unless UNLOAD)
        const currentTripDocId = ship.currentTruckTripId || ship.tripDocId || null;
        if (action !== "UNLOAD" && currentTripDocId && String(currentTripDocId) !== String(tripDocId)) {
          throw new HttpsError(
            "failed-precondition",
            `Shipment is attached to another trip: ${currentTripDocId}`
          );
        }
      }

      // --- Apply action ---
      const updatesShip = {};
      const updatesPkg = {};

      const now = FieldValue.serverTimestamp();

      // Existing counts
      const totalItems = asInt(ship.totalItems, asInt(ship.packageCount, 0));
      const loadedCount = asInt(ship.loadedCount, 0);
      const pendingCount = typeof ship.pendingCount === "number" ? asInt(ship.pendingCount, 0) : Math.max(0, totalItems - loadedCount);

      // Status event helper
      const eventsRef = shipRef.collection("status_events").doc();

      function writeEvent(statusText, statusIndexMaybe) {
        tx.set(eventsRef, {
          status: statusText,
          statusIndex: Number.isInteger(statusIndexMaybe) ? statusIndexMaybe : null,
          at: now,
          byUid: uid,
          byRole: actor.role,
          note: note || null,
          source: "scanPackageAction",
          tripDocId: tripDocId || null,
        });
      }

      if (action === "RECEIVE") {
        updatesShip.status = STATUS.RECEIVED;
        updatesShip.statusIndex = 1;
        updatesShip.lastUpdatedAt = now;
        updatesShip.lastUpdatedBy = uid;
        updatesShip.lastUpdatedRole = actor.role;

        writeEvent(STATUS.RECEIVED, 1);
      }

      if (action === "LOAD") {
        // LOAD means itemsLoaded becomes totalItems (unless you want per-scan piecewise load)
        // If you want piecewise load, replace with: delta = count > 0 ? count : 1
        const newLoaded = totalItems;
        const newPending = Math.max(0, totalItems - newLoaded);

        updatesShip.loadedCount = newLoaded;
        updatesShip.pendingCount = newPending;

        updatesShip.status = STATUS.LOADED;
        updatesShip.statusIndex = 2;

        updatesShip.currentTruckTripId = tripDocId;
        updatesShip.lastUpdatedAt = now;
        updatesShip.lastUpdatedBy = uid;
        updatesShip.lastUpdatedRole = actor.role;

        updatesPkg.loadedCount = newLoaded;
        updatesPkg.pendingCount = newPending;
        updatesPkg.status = STATUS.LOADED;
        updatesPkg.statusIndex = 2;

        writeEvent(STATUS.LOADED, 2);
      }

      if (action === "UNLOAD") {
        // unload resets loadedCount to 0 by default
        // If you want partial unload, use count as delta.
        const newLoaded = 0;
        const newPending = totalItems;

        updatesShip.loadedCount = newLoaded;
        updatesShip.pendingCount = newPending;

        updatesShip.status = STATUS.RECEIVED;
        updatesShip.statusIndex = 1;

        // Detach from trip
        updatesShip.currentTruckTripId = null;

        updatesShip.lastUpdatedAt = now;
        updatesShip.lastUpdatedBy = uid;
        updatesShip.lastUpdatedRole = actor.role;

        if (pkgRef) {
          updatesPkg.loadedCount = newLoaded;
          updatesPkg.pendingCount = newPending;
          updatesPkg.status = STATUS.RECEIVED;
          updatesPkg.statusIndex = 1;
        }

        writeEvent("Unloaded", null);
      }

      if (action === "DELIVER") {
        // delivered means pendingCount -> 0
        updatesShip.pendingCount = 0;
        updatesShip.status = STATUS.DELIVERED;
        updatesShip.statusIndex = 99;

        updatesShip.lastUpdatedAt = now;
        updatesShip.lastUpdatedBy = uid;
        updatesShip.lastUpdatedRole = actor.role;

        if (pkgRef) {
          updatesPkg.pendingCount = 0;
          updatesPkg.status = STATUS.DELIVERED;
          updatesPkg.statusIndex = 99;
        }

        writeEvent(STATUS.DELIVERED, 99);
      }

      if (action === "PARTIAL") {
        // Partial delivery reduces pending by `count`
        if (count <= 0) throw new HttpsError("invalid-argument", "count must be > 0 for PARTIAL");
        const currentPending = pendingCount;
        const newPending = Math.max(0, currentPending - count);

        updatesShip.pendingCount = newPending;
        updatesShip.status = newPending === 0 ? STATUS.DELIVERED : "Partial";
        updatesShip.statusIndex = newPending === 0 ? 99 : 50;

        updatesShip.lastUpdatedAt = now;
        updatesShip.lastUpdatedBy = uid;
        updatesShip.lastUpdatedRole = actor.role;

        if (pkgRef) {
          updatesPkg.pendingCount = newPending;
          updatesPkg.status = updatesShip.status;
          updatesPkg.statusIndex = updatesShip.statusIndex;
        }

        writeEvent(
          newPending === 0 ? STATUS.DELIVERED : "Partial Delivery",
          updatesShip.statusIndex
        );
      }

      // Write updates
      tx.set(shipRef, updatesShip, { merge: true });
      if (pkgRef && Object.keys(updatesPkg).length) {
        tx.set(pkgRef, updatesPkg, { merge: true });
      }

      // Admin log
      tx.set(db.collection("admin_logs").doc(), {
        action: "SCAN_PACKAGE_ACTION",
        trackingDocId: shipRef.id,
        trackingNumber,
        tripDocId: tripDocId || null,
        actorUid: uid,
        actorRole: actor.role,
        meta: { action, count: count || null, note: note || null },
        createdAt: now,
      });

      return {
        ok: true,
        trackingNumber,
        action,
        tripDocId: tripDocId || null,
        status: updatesShip.status || ship.status || null,
        pendingCount: typeof updatesShip.pendingCount === "number" ? updatesShip.pendingCount : null,
      };
    });
  }
);
