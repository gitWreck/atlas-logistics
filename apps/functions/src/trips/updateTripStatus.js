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

const { writeTripActionLog } = require("../utilities/tripLogger");
const { MANIFEST_STATUS } = require("./manifestStatus");
const { sealTripDeliveryManifest } = require("./tripDeliveryManifest");
const {
  sendTripStatusCustomerNotifications,
} = require("../notifications/customerNotificationService");

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
    const actor = await requireRole(db, req, ["admin", "manager", "driver", "checker"]);
    // const uid = req.auth.uid;

    const tripId = requireString(req.data?.tripId, "tripId");
    const newStatus = requireString(req.data?.status, "status").toUpperCase();
    const notify = !!req.data?.notify;
    const promotionSource = String(req.data?.promotionSource || "").trim();
    const markReconciled = !!req.data?.markReconciled;

    // Validate Status Enum

    const actorMeta = updatedBy(req);
    const uid = actor.uid;
    const name = actor.user?.name || actor.user?.fullName || actorMeta.name || uid;
    const role = actor.role;

    if (role === "driver") {
      if (!["IN_TRANSIT", "ARRIVED", "COMPLETED"].includes(newStatus)) {
        throw new HttpsError(
          "permission-denied",
          "Drivers cannot perform loading, unloading, warehouse, or assignment trip actions.",
        );
      }
      if (markReconciled || promotionSource) {
        throw new HttpsError(
          "permission-denied",
          "Drivers cannot reconcile or override trip manifests.",
        );
      }
    }

    if (!VALID_TRIP_STATUSES.includes(newStatus)) {
      throw new HttpsError(
        "invalid-argument",
        `Invalid status. Must be one of: ${VALID_TRIP_STATUSES.join(", ")}`,
      );
    }

    const tripRef = db.collection("truck_trips").doc(tripId);
    const userSnap = await db.collection("users").doc(req.auth.uid).get();
    const actorName = userSnap.data()?.name || "Unknown Admin";
    let oldTripStatus = null;

    await db.runTransaction(async (tx) => {
      const tripSnap = await tx.get(tripRef);
      if (!tripSnap.exists) throw new HttpsError("not-found", "Trip not found");

      if (
        role === "driver" &&
        String(tripSnap.data().driverId || "") !== String(actor.uid)
      ) {
        throw new HttpsError("permission-denied", "This trip is not assigned to your Driver account.");
      }

      const oldStatus = tripSnap.data().status;
      oldTripStatus = oldStatus;

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
        if (!tripSnap.data().arrivedAt) {
          updates.arrivedAt = admin.firestore.FieldValue.serverTimestamp();
        }
        if (markReconciled || promotionSource === "RECONCILIATION") {
          updates.reconciledAt = admin.firestore.FieldValue.serverTimestamp();
          updates.manifestStatus = MANIFEST_STATUS.RECONCILED;
          updates.manifestLocked = true;
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

      // C. If Reactivating (e.g. from Completed back to an operational status)
      else if (["CREATED", "LOADED", "IN_TRANSIT"].includes(newStatus)) {
        updates.active = true;
        // Clear completion data if we are 'undoing' a completion
        updates.completedAt = admin.firestore.FieldValue.delete();
        updates.cancelledAt = admin.firestore.FieldValue.delete();
      }

      // D. Undo mistaken completion while keeping hub trip at ARRIVED (or LOADING)
      if (
        newStatus !== "COMPLETED" &&
        newStatus !== "CANCELLED" &&
        (String(oldStatus || "").toUpperCase() === "COMPLETED" ||
          tripSnap.data().completedAt ||
          tripSnap.data().active === false)
      ) {
        updates.active = true;
        updates.completedAt = admin.firestore.FieldValue.delete();
        updates.autoCompletedAt = admin.firestore.FieldValue.delete();
        updates.autoCompletedReason = admin.firestore.FieldValue.delete();
        updates.autoCompletedBy = admin.firestore.FieldValue.delete();
      }

      // 3. Apply Update
      tx.update(tripRef, updates);

      if (
        (markReconciled || promotionSource === "RECONCILIATION") &&
        tripSnap.data().manifestId
      ) {
        const manifestRef = db
          .collection("manifests")
          .doc(tripSnap.data().manifestId);
        tx.update(manifestRef, {
          status: MANIFEST_STATUS.RECONCILED,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }

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
        if (
          tripStatus === "ARRIVED" ||
          tripStatus === "COMPLETED" ||
          tripStatus === "IN_TRANSIT" ||
          tripStatus === "LOADED"
        ) {
          // Trip LOADED = truck ready to lock/dispatch, not every piece scanned.
          // IN_TRANSIT promotion is package-aware (dispatchTrip / startTrip).
          // Shipment master status must stay derived from package rows.
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

    if (notify === true) {
      try {
        await sendTripStatusCustomerNotifications({
          db,
          tripId,
          oldStatus: oldTripStatus,
          newStatus,
          notify: true,
          promotionSource,
          source:
            promotionSource === "RECONCILIATION"
              ? "RECONCILIATION"
              : "TRIP_STATUS_OVERRIDE",
          channels: { sms: true, email: false, push: true },
          actor: {
            uid: uid || "SYSTEM",
            name: actorName || "SYSTEM",
            role: role || "SYSTEM",
          },
        });
      } catch (err) {
        console.error("[Notify] Failed to send trip customer notifications:", err);
      }
    }

    if (newStatus === "COMPLETED") {
      try {
        await sealTripDeliveryManifest({
          db,
          tripDocId: tripId,
          actorId: uid,
          actorName: name || null,
          actorRole: role || null,
        });
      } catch (error) {
        console.warn("Delivery manifest seal skipped:", error?.message || error);
      }
    }

    return { success: true, oldStatus: oldTripStatus, newStatus };
  },
);
