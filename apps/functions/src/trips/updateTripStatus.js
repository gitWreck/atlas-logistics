"use strict";

const { onCall, HttpsError } = require("firebase-functions/v2/https");
// const { defineSecret } = require("firebase-functions/params"); // 1. Import this
const admin = require("firebase-admin");
const {
  requireRole,
  requireString,
  updatedBy,
} = require("../utilities/helpers");
const { VALID_TRIP_STATUSES } = require("../utilities/dataDetails");
const { isAllowedTripTransition } = require("./tripLifecycle");
const {
  SEMAPHORE_API_KEY,
  SEMAPHORE_SENDER_NAME,
} = require("../../shared/sms-service");
const { broadcastTripLogic } = require("../messaging/broadcastTripMessage"); // Import if you want to call it directly
const { STATUS_MESSAGES } = require("../utilities/dataDetails");
const { writeTripActionLog } = require("../utilities/tripLogger");

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
  {
    region: "asia-southeast1",
    secrets: [SEMAPHORE_API_KEY, SEMAPHORE_SENDER_NAME],
    maxInstances: 10,
  },
  async (req) => {
    // 1. Auth & Role Check
    await requireRole(db, req, ["admin", "manager", "driver", "checker"]);
    // const uid = req.auth.uid;

    const tripId = requireString(req.data?.tripId, "tripId");
    const newStatus = requireString(req.data?.status, "status").toUpperCase();
    const notify = !!req.data?.notify;
    const promotionSource = String(req.data?.promotionSource || "").trim();
    const markReconciled = !!req.data?.markReconciled;

    // Validate Status Enum

    const { uid, role, name } = updatedBy(req);

    if (!VALID_TRIP_STATUSES.includes(newStatus)) {
      throw new HttpsError(
        "invalid-argument",
        `Invalid status. Must be one of: ${VALID_TRIP_STATUSES.join(", ")}`,
      );
    }

    const tripRef = db.collection("truck_trips").doc(tripId);
    const userSnap = await db.collection("users").doc(req.auth.uid).get();
    const actorName = userSnap.data()?.name || "Unknown Admin";

    await db.runTransaction(async (tx) => {
      const tripSnap = await tx.get(tripRef);
      if (!tripSnap.exists) throw new HttpsError("not-found", "Trip not found");

      const oldStatus = tripSnap.data().status;

      if (
        oldStatus &&
        newStatus &&
        !isAllowedTripTransition(oldStatus, newStatus)
      ) {
        console.warn(
          `[updateTripStatus] Non-forward transition ${oldStatus} → ${newStatus} for trip ${tripId}`,
        );
      }

      // 2. Prepare Updates
      const updates = {
        status: newStatus,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedBy: name,
      };

      // --- STATUS SPECIFIC LOGIC ---

      if (newStatus === "ARRIVED") {
        updates.arrivedAt = admin.firestore.FieldValue.serverTimestamp();
        if (
          markReconciled ||
          promotionSource === "RECONCILIATION"
        ) {
          updates.reconciledAt = admin.firestore.FieldValue.serverTimestamp();
        }
      }

      // A. If Completing -> Set timestamps & archive flag
      if (newStatus === "COMPLETED") {
        updates.completedAt = admin.firestore.FieldValue.serverTimestamp();
        updates.active = false;
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
      writeTripActionLog({
        db,
        tx,
        collection: "audit_logs",
        action: "FORCE_UPDATE_TRIP_STATUS",
        tripId,
        targetId: tripId,
        targetCollection: "truck_trips",
        details: {
          oldStatus,
          newStatus,
        },
        at: admin.firestore.FieldValue.serverTimestamp(),
        actorId: uid,
        actorName,
        actorRole: role || userSnap.data()?.role || null,
        note: `Status forced from ${oldStatus} to ${newStatus} by ${actorName}`,
      });

      // 5. Trip History Log
      const eventRef = tripRef.collection("trip_events").doc();
      tx.set(eventRef, {
        type: "STATUS_CHANGE",
        oldStatus,
        newStatus,
        method:
          promotionSource === "RECONCILIATION"
            ? "RECONCILIATION"
            : "MANUAL_OVERRIDE",
        promotionSource: promotionSource || null,
        by: uid,
        at: admin.firestore.FieldValue.serverTimestamp(),
      });
    });

    try {
      const batch = db.batch();
      let operationCount = 0;

      // A. Get all shipments on this trip
      const shipmentsSnap = await db
        .collection("shipments")
        .where("currentTripId", "==", tripId)
        .get();

      // B. Get all truck_shipments (if using a separate collection)
      const truckShipmentsSnap = await db
        .collection("truck_shipments")
        .where("truckTripId", "==", tripId)
        .get();

      // Helper to add updates to batch safely
      const addToBatch = (docRef, tripStatus) => {
        let safeShipmentStatus = tripStatus;

        // 1. Protect the Chain of Custody
        if (tripStatus === "ARRIVED" || tripStatus === "COMPLETED") {
          // Do nothing to the shipments! They stay IN_TRANSIT until the
          // warehouse workers physically scan the barcodes.
          return;
        }

        // 2. Handle Cancellations Safely
        if (tripStatus === "CANCELLED") {
          // Send the boxes back to the warehouse floor status, don't cancel the customer's order!
          safeShipmentStatus = "RECEIVED";
        }

        // Apply the safe update
        batch.update(docRef, {
          status: safeShipmentStatus,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        operationCount++;
      };

      shipmentsSnap.forEach((doc) => addToBatch(doc.ref, newStatus));
      truckShipmentsSnap.forEach((doc) => addToBatch(doc.ref, newStatus));

      if (operationCount > 0) {
        await batch.commit();
        console.log(`[Cascade] Updated ${operationCount} related shipments.`);
      }
    } catch (err) {
      console.error("Failed to cascade status update:", err);
      // We don't throw here because the main Trip Update succeeded.
      // We just log the error so you can debug.
    }

    // If user checked the box, trigger the notification
    // --- 4. OPTIONAL: AUTOMATED SMS NOTIFICATION ---
    if (notify === true) {
      // 1. Define Standard Messages

      const messageText = STATUS_MESSAGES[newStatus];

      if (messageText) {
        console.log(
          `[Notify] Sending broadcast for trip ${tripId} with status ${newStatus}`,
        );

        // 2. Reuse your broadcast logic (Internal Call)
        // We import the logic from your existing broadcast function or just invoke it here.
        // Since this is "server-side to server-side", we can just call the logic directly.

        try {
          await broadcastTripLogic({
            tripId: tripId,
            message: messageText,
            actorUid: uid || "SYSTEM",
            actorName: actorName || "SYSTEM",
            actorRole: role || "SYSTEM",
          }).catch((err) => console.error("Broadcast failed:", err));
        } catch (err) {
          console.error("[Notify] Failed to queue SMS:", err);
          // Don't throw error here, or you will roll back the Status Update!
          // We want the status to change even if SMS fails.
        }
      }
    }

    return { success: true, oldStatus: "FETCHED_INSIDE", newStatus };
  },
);
