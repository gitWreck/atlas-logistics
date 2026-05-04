"use strict";

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const { requireAuth } = require("../utilities/helpers");
const { writeShipmentActionLog } = require("../utilities/shipmentLogger");

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

exports.bulkUpdateShipmentStatus = onCall(
  { region: "asia-southeast1", maxInstances: 10 },
  async (req) => {
    // 1. AUTHENTICATION
    const uid = await requireAuth(req);
    const { tripId, shipmentIds, newStatus, location } = req.data || {};

    // 2. VALIDATION
    if (!tripId || !shipmentIds || !Array.isArray(shipmentIds) || !newStatus) {
      throw new HttpsError("invalid-argument", "Missing required fields.");
    }

    // Firestore Batch Limit is 500 operations.
    // Each shipment uses ~3 ops (Shipment + TripShipment + Event).
    // Safe limit is ~150 items.
    if (shipmentIds.length > 150) {
      throw new HttpsError(
        "invalid-argument",
        "Too many items. Select fewer than 150.",
      );
    }

    const timestamp = admin.firestore.FieldValue.serverTimestamp();
    const isoDate = new Date().toISOString();
    const batch = db.batch();

    // Track Deltas for Parent Trip Counters
    let tripPendingDelta = 0;
    let tripLoadedDelta = 0;
    let tripDeliveredDelta = 0;
    let updateCount = 0;

    // 3. FETCH CURRENT DATA (Parallel Read)
    const shipmentRefs = shipmentIds.map((id) =>
      db.collection("shipments").doc(id),
    );
    const snapshots = await db.getAll(...shipmentRefs);

    // 4. PROCESS EACH SHIPMENT
    snapshots.forEach((doc) => {
      if (!doc.exists) return;

      const data = doc.data();
      const currentStatus = data.status || "PENDING";

      // 🛡️ GUARD 1: Idempotency (Skip if no change)
      if (currentStatus === newStatus) return;

      // 🛡️ GUARD 2: Protect Final States
      // Don't let a bulk action revert a Completed shipment back to something else
      if (currentStatus === "COMPLETED" || currentStatus === "DELIVERED") {
        return;
      }

      updateCount++;
      const shipmentRef = db.collection("shipments").doc(doc.id);
      const tripShipmentRef = db
        .collection("truck_trips")
        .doc(tripId)
        .collection("trip_shipments")
        .doc(doc.id);

      // ====================================================
      // SCENARIO A: FORCE DELIVERED / COMPLETED
      // ====================================================
      if (newStatus === "DELIVERED" || newStatus === "COMPLETED") {
        const totals = data.totals || {};
        const currentPending = totals.pending || 0;
        const currentLoaded = totals.loaded || 0;
        const totalItems = totals.totalItems || 0;

        // 1. Calculate Deltas (Drain Pending/Loaded -> Fill Delivered)
        // We subtract whatever is currently in the "Active" buckets
        const pendingChange = -currentPending;
        const loadedChange = -currentLoaded;
        // We add whatever is needed to reach 100% delivered
        const deliveredChange = totalItems - (totals.delivered || 0);

        // 2. Accumulate Trip Deltas
        tripPendingDelta += pendingChange;
        tripLoadedDelta += loadedChange;
        tripDeliveredDelta += deliveredChange;

        // 3. Update Individual Packages (Visual Sync)
        const updatedPackages = (data.packages || []).map((p) => ({
          ...p,
          status: "DELIVERED",
          deliveredAt: p.deliveredAt || isoDate,
          deliveredBy: p.deliveredBy || uid,
        }));

        // 4. Update Shipment Doc
        const historyEntry = {
          status: "COMPLETED",
          at: new Date(),
          by: uid,
          note: "Bulk status update to COMPLETED",
          location: location || null,
        };

        batch.update(shipmentRef, {
          status: "COMPLETED",
          "totals.pending": 0,
          "totals.loaded": 0,
          "totals.received": 0, // Assuming they are gone from warehouse
          "totals.delivered": totalItems,
          packages: updatedPackages,
          updatedAt: timestamp,
          updatedBy: uid,
          statusHistory: admin.firestore.FieldValue.arrayUnion(historyEntry),
          ...(location ? { lastLocation: location } : {}),
        });

        // 5. Update Trip Manifest Doc
        batch.update(tripShipmentRef, {
          status: "COMPLETED",
          pendingCount: 0,
          loadedCount: 0,
          deliveredCount: totalItems,
          updatedAt: timestamp,
        });
      }
      // ====================================================
      // SCENARIO B: SIMPLE STATUS CHANGE (e.g. Out For Delivery)
      // ====================================================
      else {
        // Just update the status text. Do not touch the counters.
        const historyEntry = {
          status: newStatus,
          at: new Date(),
          by: uid,
          note: `Bulk status update to ${newStatus}`,
          location: location || null,
        };

        batch.update(shipmentRef, {
          status: newStatus,
          updatedAt: timestamp,
          updatedBy: uid,
          statusHistory: admin.firestore.FieldValue.arrayUnion(historyEntry),
          ...(location ? { lastLocation: location } : {}),
        });

        // Map status for manifest (Optional logic)
        let manifestStatus = newStatus;
        if (newStatus === "OUT_FOR_DELIVERY") manifestStatus = "UNLOADING";

        batch.update(tripShipmentRef, {
          status: manifestStatus,
          updatedAt: timestamp,
        });
      }

      // 6. ADD SHIPMENT STATUS EVENT
      const shipEventRef = shipmentRef.collection("status_events").doc();
      batch.set(shipEventRef, {
        type: "BULK_UPDATE",
        status: newStatus,
        message: `Bulk updated to ${newStatus}`,
        updatedBy: uid,
        createdAt: timestamp,
      });
    });

    // 5. UPDATE PARENT TRIP COUNTERS (Only if needed)
    const tripRef = db.collection("truck_trips").doc(tripId);

    if (
      tripPendingDelta !== 0 ||
      tripLoadedDelta !== 0 ||
      tripDeliveredDelta !== 0
    ) {
      batch.update(tripRef, {
        itemPending: admin.firestore.FieldValue.increment(tripPendingDelta),
        totalLoaded: admin.firestore.FieldValue.increment(tripLoadedDelta),
        totalDelivered:
          admin.firestore.FieldValue.increment(tripDeliveredDelta),
        updatedAt: timestamp,
      });
    }

    // 6. ADD TRIP TIMELINE EVENT
    if (updateCount > 0) {
      const tripEventRef = tripRef.collection("status_events").doc();
      batch.set(tripEventRef, {
        type: "BULK_UPDATE",
        message: `Bulk updated ${updateCount} shipments to ${newStatus}`,
        newStatus: newStatus,
        affectedCount: updateCount,
        performedBy: uid,
        createdAt: timestamp,
      });

      // 7. GLOBAL AUDIT LOG
      writeShipmentActionLog({
        db,
        batch,
        collection: "audit_logs",
        action: "BULK_STATUS_UPDATE",
        tripId: tripId,
        newStatus: newStatus,
        count: updateCount,
        actorId: uid,
        performedBy: uid,
        timestamp: timestamp,
      });
    }

    // 8. COMMIT
    await batch.commit();

    return {
      success: true,
      count: updateCount,
      message: `Successfully updated ${updateCount} shipments.`,
    };
  },
);
