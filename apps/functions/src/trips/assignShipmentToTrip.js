"use strict";

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const { requireRole } = require("../utilities/helpers");
const {
  getActorFromRequest,
  writeTripActionLog,
} = require("../utilities/tripLogger");
const { buildDerivedShipmentSnapshot } = require("../packages/shipmentStatus");

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

/* ======================================================
   ASSIGN SHIPMENT TO TRUCK TRIP (OPTION B — CANONICAL)
====================================================== */
exports.assignShipmentToTrip = onCall(
  { region: "asia-southeast1", maxInstances: 10 },
  async (req) => {
    await requireRole(db, req, ["admin", "manager"]);

    const { trackingShipmentId, tripId } = req.data || {};
    if (!trackingShipmentId || typeof trackingShipmentId !== "string") {
      throw new HttpsError("invalid-argument", "trackingShipmentId required");
    }
    if (!tripId || typeof tripId !== "string") {
      throw new HttpsError("invalid-argument", "tripId required");
    }

    const uid = req.auth.uid;

    const userSnap = await db.collection("users").doc(uid).get();
    if (!userSnap.exists || userSnap.data().active !== true) {
      throw new HttpsError("permission-denied", "Inactive user");
    }
    const userData = userSnap.data();
    const role = userData.role;
    const actor = getActorFromRequest(req, userData);

    const shipmentRef = db.collection("shipments").doc(trackingShipmentId);
    const tripRef = db.collection("truck_trips").doc(tripId);
    const shipRef = tripRef
      .collection("trip_shipments")
      .doc(trackingShipmentId);

    await db.runTransaction(async (tx) => {
      const [trackingSnap, tripSnap, shipSnap] = await Promise.all([
        tx.get(shipmentRef),
        tx.get(tripRef),
        tx.get(shipRef),
      ]);

      if (!trackingSnap.exists)
        throw new HttpsError("not-found", "Shipment not found");
      if (!tripSnap.exists) throw new HttpsError("not-found", "Trip not found");

      const tracking = trackingSnap.data();
      const trip = tripSnap.data();

      // 🔒 Hard stop: completed trip
      if (trip.active === false || trip.status === "COMPLETED") {
        throw new HttpsError(
          "failed-precondition",
          "Cannot assign shipment to completed trip",
        );
      }

      // ❌ NEW CHECK: Do not allow changes if Manifest is Locked
      if (trip.manifestLocked === true) {
        throw new HttpsError(
          "failed-precondition",
          "Trip Manifest is LOCKED. Unlock it first.",
        );
      }

      // 🔁 Idempotency: already assigned to this trip
      if (tracking.currentTripId === tripId) {
        return;
      }

      // 🛑 CRITICAL FIX: PREVENT DOUBLE ASSIGNMENT
      if (tracking.currentTripId && tracking.currentTripId !== tripId) {
        throw new HttpsError(
          "failed-precondition",
          `Shipment is already assigned to another trip (${tracking.currentTripId}). Please unassign it there first.`,
        );
      }

      const now = admin.firestore.FieldValue.serverTimestamp();
      const packages = Array.isArray(tracking.packages) ? tracking.packages : [];
      const derivedSnapshot = buildDerivedShipmentSnapshot(packages, {
        previousStatus: tracking.status,
      });

      // Calculate Items to Add (Safely handle missing totals)
      const itemsToAdd = Number(
        tracking.totals?.totalContentQty || tracking.totals?.totalItems || 0,
      );

      // 📦 Ensure trip_shipments exists (NO loading yet)
      if (!shipSnap.exists) {
        tx.set(shipRef, {
          trackingShipmentId,
          shipmentId: tracking.shipmentId || null,
          route:
            tracking.originCode + " -> " + tracking.destinationCode || null,

          totalItems: itemsToAdd || 0,
          pendingCount: itemsToAdd, // Initially, all items are pending
          loadedCount: 0,
          deliveredCount: 0,

          sender: tracking.sender,
          recipient: tracking.recipient,

          // Copy barcodes for the Checker API (Important for scanning!)
          packageBarcodes: tracking.packageBarcodes || [],

          createdAt: now,
          createdBy: uid,

          updatedAt: now,
          updatedBy: uid,
          updatedRole: role,

          status: "ASSIGNED",
        });
      }

      // 🔗 Update tracking record (master status derived from packages)
      tx.update(shipmentRef, {
        currentTripId: tripId,
        assignedToTripAt: now,

        updatedAt: now,
        updatedBy: uid,

        status: derivedSnapshot.status,
        packages: derivedSnapshot.packages,
        packageBreakdown: derivedSnapshot.packageBreakdown,
        availableForDelivery: derivedSnapshot.availableForDelivery,
        statusHistory: [
          ...(tracking.statusHistory ?? []),
          {
            status: "ASSIGNED",
            at: admin.firestore.Timestamp.now(),
            note: `Assigned to trip ${tripId}`,
          },
        ],

        updatedRole: role,
      });

      // --------------------------------------------------------
      // 🆕 NEW: Update Trip Counters (itemPending)
      // --------------------------------------------------------
      tx.update(tripRef, {
        // Also update totalItems (optional, but good practice to track capacity)
        totalItems: admin.firestore.FieldValue.increment(itemsToAdd),
        itemPending: admin.firestore.FieldValue.increment(itemsToAdd),

        // totalLoaded: 0,
        // totalDelivered: 0,

        updatedAt: now,
        updatedBy: uid,
      });

      // 🧾 Status event (timeline-visible)
      tx.set(shipmentRef.collection("status_events").doc(), {
        type: "ASSIGN_TO_TRIP",
        message: "Assigned to truck trip",
        tripId,
        createdAt: now,
        createdBy: uid,
        // createdRole: role,
      });

      // 🧾 Admin audit log
      writeTripActionLog({
        db,
        tx,
        action: "ASSIGN_SHIPMENT_TO_TRIP",
        tripId,
        trackingShipmentId,
        ...actor,
        createdAt: now,
      });
    });

    return {
      success: true,
      trackingShipmentId,
      tripId,
    };
  },
);
