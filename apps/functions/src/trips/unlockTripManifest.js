"use strict";

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const {
  requireRole,
  requireString,
  updatedBy,
} = require("../utilities/helpers");
const { writeCustodyAuditLog } = require("../utilities/custodyAuditLog");
const {
  MANIFEST_STATUS,
  canUnlockManifest,
  resolveManifestStatus,
} = require("./manifestStatus");
const { resetPendingAmendmentSession } = require("./manifestAmendment");

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

function resolveNextManifestStatusAfterUnlock() {
  return MANIFEST_STATUS.OPEN;
}

/* ======================================================
   unlockTripManifest
   ======================================================
   ✅ Allows Admin/Manager to edit a trip again
   ✅ Admin may reopen RECONCILED manifests for corrections
   ✅ Sets manifestLocked = false
   ✅ Logs the security event (Important!)
====================================================== */
exports.unlockTripManifest = onCall(
  { region: "asia-southeast1", maxInstances: 10 },
  async (req) => {
    await requireRole(db, req, ["admin", "manager"]);

    const { uid, role, name } = updatedBy(req);
    const isAdmin = String(role || "").toLowerCase() === "admin";

    const tripId = requireString(req.data?.tripId, "tripId");
    const reason = requireString(req.data?.reason, "reason");

    const tripRef = db.collection("truck_trips").doc(tripId);

    const userSnap = await db.collection("users").doc(req.auth.uid).get();
    const actorName = userSnap.data()?.name || name || "Unknown User";

    await db.runTransaction(async (tx) => {
      const tripSnap = await tx.get(tripRef);
      if (!tripSnap.exists) throw new HttpsError("not-found", "Trip not found");

      const trip = tripSnap.data();
      const manifestStatus = resolveManifestStatus(trip);
      const wasReconciled = manifestStatus === MANIFEST_STATUS.RECONCILED;
      const wasLocked = trip.manifestLocked === true;

      if (!canUnlockManifest(trip, { isAdmin })) {
        const hint =
          wasReconciled && !isAdmin
            ? " Only an Admin can unlock a reconciled manifest."
            : "";
        throw new HttpsError(
          "failed-precondition",
          `Cannot unlock manifest while status is ${manifestStatus}.${hint}`,
        );
      }

      if (!wasLocked && !wasReconciled) {
        return;
      }

      const nextManifestStatus = resolveNextManifestStatusAfterUnlock();

      const previousValue = {
        manifestLocked: wasLocked,
        manifestStatus,
        manifestId: trip.manifestId || null,
        reconciledAt: trip.reconciledAt || null,
      };
      const newValue = {
        manifestLocked: false,
        manifestStatus: nextManifestStatus,
        manifestId: trip.manifestId || null,
        reconciledAt: null,
      };

      const tripUpdate = {
        manifestLocked: false,
        manifestStatus: nextManifestStatus,
        manifestReopenedAt: admin.firestore.FieldValue.serverTimestamp(),
        manifestReopenedBy: uid,
        manifestReopenReason: reason,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedBy: name,
        reconciledAt: admin.firestore.FieldValue.delete(),
        reconciledBy: admin.firestore.FieldValue.delete(),
        correctionDispatchedAt: admin.firestore.FieldValue.delete(),
        correctionDispatchedBy: admin.firestore.FieldValue.delete(),
        correctionDispatchedByName: admin.firestore.FieldValue.delete(),
        receivingResumedAt: admin.firestore.FieldValue.delete(),
        receivingResumedBy: admin.firestore.FieldValue.delete(),
        receivingResumedByName: admin.firestore.FieldValue.delete(),
      };

      tx.update(tripRef, tripUpdate);

      if (trip.manifestId) {
        resetPendingAmendmentSession(tx, tripRef);
      }

      writeCustodyAuditLog({
        db,
        tx,
        action: wasReconciled ? "REOPEN_RECONCILED_MANIFEST" : "UNLOCK_MANIFEST",
        tripId: trip.tripId || tripId,
        tripDocId: tripId,
        targetId: tripId,
        targetCollection: "truck_trips",
        actorId: uid,
        actorName,
        actorRole: role || null,
        reason,
        previousValue,
        newValue,
        note: wasReconciled
          ? `Reconciled manifest reopened by admin for corrections. Reason: ${reason}`
          : `Manifest unlocked. Reason: ${reason}`,
      });

      const eventRef = tripRef.collection("manifest_events").doc();
      tx.set(eventRef, {
        type: wasReconciled ? "MANIFEST_REOPENED" : "MANIFEST_UNLOCKED",
        reason,
        unlockedBy: actorName,
        unlockedByUid: uid,
        unlockedByRole: role || null,
        previousManifestStatus: manifestStatus,
        nextManifestStatus,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    });

    return { success: true };
  },
);
