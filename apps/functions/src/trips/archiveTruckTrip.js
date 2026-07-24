"use strict";

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const { FieldValue } = require("firebase-admin/firestore");
const { requireString } = require("../utilities/helpers");
const { writeCustodyAuditLog } = require("../utilities/custodyAuditLog");
const {
  requireTripLifecycleAdmin,
  snapshotTripLifecycleState,
  assertTripNotArchived,
  updatedBy,
} = require("./tripLifecycleAdmin");
const { canAccessRecord } = require("../manager/managerAccess");

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

const ARCHIVE_ELIGIBLE_STATUSES = new Set([
  "COMPLETED",
  "DELIVERED",
  "CANCELLED",
]);

exports.archiveTruckTrip = onCall(
  { region: "asia-southeast1", maxInstances: 10 },
  async (req) => {
    const actor = await requireTripLifecycleAdmin(db, req);

    const { uid, role, name } = updatedBy(req);
    const tripDocId = requireString(
      req.data?.tripDocId || req.data?.tripId,
      "tripId",
    );
    const reason = requireString(req.data?.reason, "reason");

    const tripRef = db.collection("truck_trips").doc(tripDocId);

    await db.runTransaction(async (tx) => {
      const tripSnap = await tx.get(tripRef);
      if (!tripSnap.exists) {
        throw new HttpsError("not-found", "Trip not found");
      }

      const trip = tripSnap.data() || {};
      if (actor.role === "manager" && !canAccessRecord(actor.user, trip)) {
        throw new HttpsError(
          "permission-denied",
          "This trip is outside your assigned warehouse or municipality.",
        );
      }
      assertTripNotArchived(trip);

      const status = String(trip.status || "").toUpperCase();
      const canArchive =
        ARCHIVE_ELIGIBLE_STATUSES.has(status) || trip.active === false;

      if (!canArchive) {
        throw new HttpsError(
          "failed-precondition",
          "Only completed, cancelled, or inactive trips can be archived. Cancel the trip first if it is still active.",
        );
      }

      const before = snapshotTripLifecycleState(trip);
      const after = {
        ...before,
        archived: true,
        active: false,
      };

      tx.update(tripRef, {
        archived: true,
        active: false,
        archiveReason: reason,
        archivedAt: FieldValue.serverTimestamp(),
        archivedBy: uid,
        archivedByName: name || null,
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: name || uid,
      });

      writeCustodyAuditLog({
        db,
        tx,
        action: "ARCHIVE_TRIP",
        targetCollection: "truck_trips",
        targetId: tripDocId,
        tripDocId,
        tripId: trip.tripId || tripDocId,
        actorId: uid,
        actorName: name,
        actorRole: role,
        reason,
        previousValue: before,
        newValue: after,
        note: "Trip archived. Record retained for audit trail.",
      });

      const eventRef = tripRef.collection("manifest_events").doc();
      tx.set(eventRef, {
        type: "TRIP_ARCHIVED",
        reason,
        archivedBy: name || uid,
        createdAt: FieldValue.serverTimestamp(),
      });
    });

    return { success: true, tripId: tripDocId };
  },
);
