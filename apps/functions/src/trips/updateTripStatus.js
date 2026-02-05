"use strict";

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const { requireRole, requireString } = require("../utilities/helpers");

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

/* ======================================================
   updateTripStatus (Force Status Change)
   ======================================================
   ✅ Admin/Manager tool to manually override trip status
   ✅ Handles side-effects for COMPLETED/CANCELLED
   ✅ Logs the action securely
====================================================== */
exports.updateTripStatus = onCall(
  { region: "asia-southeast1" },
  async (req) => {
    // 1. Auth & Role Check
    await requireRole(db, req, ["admin", "manager"]);
    const uid = req.auth.uid;

    const tripId = requireString(req.data?.tripId, "tripId");
    const newStatus = requireString(req.data?.status, "status").toUpperCase();

    // Validate Status Enum
    const VALID_STATUSES = [
      "CREATED",
      "LOADED",
      "IN_TRANSIT",
      "COMPLETED",
      "CANCELLED",
    ];
    if (!VALID_STATUSES.includes(newStatus)) {
      throw new HttpsError(
        "invalid-argument",
        `Invalid status. Must be one of: ${VALID_STATUSES.join(", ")}`,
      );
    }

    const tripRef = db.collection("truck_trips").doc(tripId);

    // Get actor name for logs
    const userSnap = await db.collection("users").doc(uid).get();
    const actorName = userSnap.data()?.name || "Unknown Admin";

    await db.runTransaction(async (tx) => {
      const tripSnap = await tx.get(tripRef);
      if (!tripSnap.exists) throw new HttpsError("not-found", "Trip not found");

      const oldStatus = tripSnap.data().status;

      // 2. Prepare Updates
      const updates = {
        status: newStatus,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedBy: uid,
      };

      // --- STATUS SPECIFIC LOGIC ---

      // A. If Completing -> Set timestamps & archive flag
      if (newStatus === "COMPLETED") {
        updates.completedAt = admin.firestore.FieldValue.serverTimestamp();
        updates.active = false;
        // Optional: unlock manifest if you want it editable after completion (unlikely)
        // updates.manifestLocked = true;
      }

      // B. If Cancelling -> Set active false
      else if (newStatus === "CANCELLED") {
        updates.active = false;
        updates.cancelledAt = admin.firestore.FieldValue.serverTimestamp();
      }

      // C. If Reactivating (e.g. from Completed back to In Transit)
      else if (["CREATED", "LOADED", "IN_TRANSIT"].includes(newStatus)) {
        updates.active = true;
        // Clear completion data if we are 'undoing' a completion
        updates.completedAt = admin.firestore.FieldValue.delete();
        updates.cancelledAt = admin.firestore.FieldValue.delete();
      }

      // 3. Apply Update
      tx.update(tripRef, updates);

      // 4. Audit Log
      const logRef = db.collection("audit_log").doc();
      tx.set(logRef, {
        action: "FORCE_UPDATE_TRIP_STATUS",
        targetId: tripId,
        targetCollection: "truck_trips",
        details: {
          oldStatus,
          newStatus,
        },
        at: admin.firestore.FieldValue.serverTimestamp(),
        by: uid,
        note: `Status forced from ${oldStatus} to ${newStatus} by ${actorName}`,
      });

      // 5. Trip History Log
      const eventRef = tripRef.collection("trip_events").doc();
      tx.set(eventRef, {
        type: "STATUS_CHANGE",
        oldStatus,
        newStatus,
        method: "MANUAL_OVERRIDE",
        by: uid,
        at: admin.firestore.FieldValue.serverTimestamp(),
      });
    });

    return { success: true, oldStatus: "FETCHED_INSIDE", newStatus };
  },
);
