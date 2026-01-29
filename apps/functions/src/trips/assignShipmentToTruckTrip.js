"use strict";

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const { requireRole } = require("../utilities/helpers");

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

/* ======================================================
   ASSIGN SHIPMENT TO TRUCK TRIP (OPTION B — CANONICAL)
====================================================== */
exports.assignShipmentToTruckTrip = onCall(
  { region: "asia-southeast1", maxInstances: 10 },
  async (req) => {
    await requireRole(db, req, ["admin", "manager"]);

    const { trackingDocId, truckTripId } = req.data || {};
    if (!trackingDocId || typeof trackingDocId !== "string") {
      throw new HttpsError("invalid-argument", "trackingDocId required");
    }
    if (!truckTripId || typeof truckTripId !== "string") {
      throw new HttpsError("invalid-argument", "truckTripId required");
    }

    const uid = req.auth.uid;

    const userSnap = await db.collection("users").doc(uid).get();
    if (!userSnap.exists || userSnap.data().active !== true) {
      throw new HttpsError("permission-denied", "Inactive user");
    }
    const role = userSnap.data().role;

    const trackingRef = db.collection("shipments").doc(trackingDocId);
    const tripRef = db.collection("truck_trips").doc(truckTripId);
    const shipRef = tripRef.collection("trip_shipments").doc(trackingDocId);

    await db.runTransaction(async (tx) => {
      const [trackingSnap, tripSnap, shipSnap] = await Promise.all([
        tx.get(trackingRef),
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
      if (tracking.currentTruckTripId === truckTripId) {
        return;
      }

      // 🛑 CRITICAL FIX: PREVENT DOUBLE ASSIGNMENT
      if (
        tracking.currentTruckTripId &&
        tracking.currentTruckTripId !== truckTripId
      ) {
        throw new HttpsError(
          "failed-precondition",
          `Shipment is already assigned to another trip (${tracking.currentTruckTripId}). Please unassign it there first.`,
        );
      }

      const now = admin.firestore.FieldValue.serverTimestamp();

      // Calculate Items to Add (Safely handle missing totals)
      const itemsToAdd = Number(tracking.totals?.totalItems || 0);

      // 📦 Ensure trip_package exists (NO loading yet)
      if (!shipSnap.exists) {
        tx.set(shipRef, {
          trackingDocId,
          trackingNumber: tracking.trackingNumber || null,
          route:
            tracking.originCode + " -> " + tracking.destinationCode || null,

          totalItems: itemsToAdd || null,
          pendingCount: itemsToAdd, // Initially, all items are pending
          loadedCount: 0,
          deliveredCount: 0,

          sender: tracking.sender,
          receiver: tracking.recipient,

          createdAt: now,
          createdBy: uid,

          updatedAt: now,
          updatedBy: uid,
          updatedRole: role,

          status: "ASSIGNED",
        });
      }

      // 🔗 Update tracking record
      tx.update(trackingRef, {
        currentTruckTripId: truckTripId,
        assignedToTruckTripAt: now,

        updatedAt: now,
        updatedBy: uid,

        status: "ASSIGNED",
        statusHistory: [
          ...(tracking.statusHistory ?? []),
          {
            status: "ASSIGNED",
            at: admin.firestore.Timestamp.now(),
            note: `Assigned to trip ${truckTripId}`,
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
      tx.set(trackingRef.collection("status_events").doc(), {
        type: "ASSIGN_TO_TRIP",
        message: "Assigned to truck trip",
        truckTripId,
        createdAt: now,
        createdBy: uid,
        // createdRole: role,
      });

      // 🧾 Admin audit log
      tx.set(db.collection("admin_logs").doc(), {
        action: "ASSIGN_SHIPMENT_TO_TRIP",
        trackingDocId,
        truckTripId,
        actorId: uid,
        actorRole: role,
        // createdAt: now,
      });
    });

    return {
      success: true,
      trackingDocId,
      truckTripId,
    };
  },
);
