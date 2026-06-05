"use strict";

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const {
  requireRole,
  requireString,
  updatedBy,
} = require("../utilities/helpers");
const { writeTripActionLog } = require("../utilities/tripLogger");
const {
  MANIFEST_STATUS,
  canUnlockManifest,
  resolveManifestStatus,
} = require("./manifestStatus");

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

/* ======================================================
   unlockTripManifest
   ======================================================
   ✅ Allows Admin/Manager to edit a trip again
   ✅ Sets manifestLocked = false
   ✅ Logs the security event (Important!)
====================================================== */
exports.unlockTripManifest = onCall(
  { region: "asia-southeast1", maxInstances: 10 },
  async (req) => {
    // 1. Auth & Role Check
    await requireRole(db, req, ["admin", "manager"]);

    // const updatedBy = req.data?.updatedBy || {};

    const { uid, role, name } = updatedBy(req);

    const tripId = requireString(req.data?.tripId, "tripId");
    const reason = requireString(req.data?.reason, "reason"); // Reason is mandatory for audits

    const tripRef = db.collection("truck_trips").doc(tripId);

    // Get user details for the log
    const userSnap = await db.collection("users").doc(req.auth.uid).get();
    const actorName = userSnap.data()?.name || "Unknown Manager";

    await db.runTransaction(async (tx) => {
      const tripSnap = await tx.get(tripRef);
      if (!tripSnap.exists) throw new HttpsError("not-found", "Trip not found");

      const trip = tripSnap.data();

      // Check if it's actually locked
      if (trip.manifestLocked !== true) {
        return { success: true, message: "Trip was already unlocked." };
      }

      if (!canUnlockManifest(trip)) {
        throw new HttpsError(
          "failed-precondition",
          `Cannot unlock manifest while status is ${resolveManifestStatus(trip)}. Receiving must not be in progress.`,
        );
      }

      // 2. UNLOCK OPERATIONS
      tx.update(tripRef, {
        manifestLocked: false,
        // We DO NOT clear manifestId yet. We keep it as a reference to the "last generated" one.
        manifestStatus: MANIFEST_STATUS.OPEN,

        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedBy: name,
      });

      // 3. AUDIT LOG (Crucial for compliance)
      // Since Manifests are legal documents, unlocking them is a sensitive action.
      writeTripActionLog({
        db,
        tx,
        collection: "audit_logs",
        action: "UNLOCK_MANIFEST",
        tripId,
        targetId: tripId,
        targetCollection: "truck_trips",
        previousManifestId: trip.manifestId || null,
        reason: reason,
        at: admin.firestore.FieldValue.serverTimestamp(),
        actorId: uid,
        actorName: actorName,
        actorRole: role || null,
        note: `Manifest unlocked by manager. Reason: ${reason}`,
      });

      // Optional: Add event to trip subcollection history
      const eventRef = tripRef.collection("manifest_events").doc();
      tx.set(eventRef, {
        type: "MANIFEST_UNLOCKED",
        reason,
        unlockedBy: name,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    });

    return { success: true };
  },
);
