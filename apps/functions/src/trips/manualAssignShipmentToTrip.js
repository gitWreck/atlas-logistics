"use strict";

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const {
  requireRole,
  requireString,
  updatedBy,
} = require("../utilities/helpers");
const { getActorFromRequest } = require("../utilities/tripLogger");
const { writeCustodyAuditLog } = require("../utilities/custodyAuditLog");
const { buildDerivedShipmentSnapshot } = require("../packages/shipmentStatus");
const {
  normalizeCode,
  resolveShipmentReference,
} = require("../shipments/resolveShipmentReference");
const {
  appendPendingAmendmentEntry,
  tripRequiresAmendmentTracking,
} = require("./manifestAmendment");

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

exports.manualAssignShipmentToTrip = onCall(
  { region: "asia-southeast1", maxInstances: 10 },
  async (req) => {
    await requireRole(db, req, ["admin"]);

    const { uid, role, name } = updatedBy(req);
    const userSnap = await db.collection("users").doc(req.auth.uid).get();
    const userData = userSnap.exists ? userSnap.data() : {};
    const actor = getActorFromRequest(req, userData);

    const tripId = requireString(req.data?.tripId, "tripId");
    const shipmentRef = normalizeCode(req.data?.shipmentRef || req.data?.shipmentId);
    const reason = requireString(req.data?.reason, "reason");

    if (!shipmentRef) {
      throw new HttpsError("invalid-argument", "Shipment or package label is required.");
    }

    const resolved = await resolveShipmentReference(db, shipmentRef);
    const trackingShipmentId = resolved.shipmentDocId;
    const tracking = resolved.shipment;

    const tripRef = db.collection("truck_trips").doc(tripId);
    const shipmentDocRef = db.collection("shipments").doc(trackingShipmentId);
    const tripShipmentRef = tripRef.collection("trip_shipments").doc(trackingShipmentId);

    let alreadyAssigned = false;

    await db.runTransaction(async (tx) => {
      const [tripSnap, shipmentSnap, tripShipmentSnap] = await Promise.all([
        tx.get(tripRef),
        tx.get(shipmentDocRef),
        tx.get(tripShipmentRef),
      ]);

      if (!tripSnap.exists) {
        throw new HttpsError("not-found", "Trip not found");
      }
      if (!shipmentSnap.exists) {
        throw new HttpsError("not-found", "Shipment not found");
      }

      const trip = tripSnap.data() || {};

      if (trip.active === false || trip.status === "COMPLETED") {
        throw new HttpsError(
          "failed-precondition",
          "Cannot assign shipment to completed trip",
        );
      }

      if (trip.manifestLocked === true) {
        throw new HttpsError(
          "failed-precondition",
          "Trip manifest is locked. Unlock it first.",
        );
      }

      if (tracking.currentTripId === tripId) {
        alreadyAssigned = true;
        if (!tripShipmentSnap.exists) {
          const packages = Array.isArray(tracking.packages) ? tracking.packages : [];
          const derivedSnapshot = buildDerivedShipmentSnapshot(packages, {
            previousStatus: tracking.status,
          });

          tx.set(tripShipmentRef, {
            trackingShipmentId,
            shipmentId: tracking.shipmentId || null,
            route:
              (tracking.originCode || "?") +
              " -> " +
              (tracking.destinationCode || "?"),
            totalItems: 0,
            pendingCount: 0,
            loadedCount: 0,
            deliveredCount: 0,
            receivedCount: 0,
            missingCount: 0,
            sender: tracking.sender || null,
            recipient: tracking.recipient || null,
            packageBarcodes: tracking.packageBarcodes || [],
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            createdBy: uid,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedBy: name,
            updatedRole: role,
            status: "ASSIGNED",
          });

          tx.update(shipmentDocRef, {
            currentTripId: tripId,
            assignedToTripAt: admin.firestore.FieldValue.serverTimestamp(),
            status: derivedSnapshot.status,
            packages: derivedSnapshot.packages,
            packageBreakdown: derivedSnapshot.packageBreakdown,
            availableForDelivery: derivedSnapshot.availableForDelivery,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedBy: name,
            updatedRole: role,
          });
        }
        return;
      }

      if (tracking.currentTripId && tracking.currentTripId !== tripId) {
        throw new HttpsError(
          "failed-precondition",
          `Shipment is already assigned to another trip (${tracking.currentTripId}). Unassign it there first.`,
        );
      }

      const now = admin.firestore.FieldValue.serverTimestamp();
      const packages = Array.isArray(tracking.packages) ? tracking.packages : [];
      const derivedSnapshot = buildDerivedShipmentSnapshot(packages, {
        previousStatus: tracking.status,
      });

      if (!tripShipmentSnap.exists) {
        tx.set(tripShipmentRef, {
          trackingShipmentId,
          shipmentId: tracking.shipmentId || null,
          route:
            (tracking.originCode || "?") +
            " -> " +
            (tracking.destinationCode || "?"),
          totalItems: 0,
          pendingCount: 0,
          loadedCount: 0,
          deliveredCount: 0,
          receivedCount: 0,
          missingCount: 0,
          sender: tracking.sender || null,
          recipient: tracking.recipient || null,
          packageBarcodes: tracking.packageBarcodes || [],
          createdAt: now,
          createdBy: uid,
          updatedAt: now,
          updatedBy: name,
          updatedRole: role,
          status: "ASSIGNED",
        });
      }

      tx.update(shipmentDocRef, {
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
            note: `Manually assigned to trip ${trip.tripId || tripId}`,
          },
        ],
        updatedRole: role,
      });

      tx.update(tripRef, {
        updatedAt: now,
        updatedBy: name,
      });

      tx.set(shipmentDocRef.collection("status_events").doc(), {
        type: "MANUAL_ASSIGN_TO_TRIP",
        message: "Manually assigned to truck trip",
        tripId,
        reason,
        packageLabel: resolved.packageLabel,
        enteredRef: shipmentRef,
        createdAt: now,
        createdBy: uid,
      });

      writeCustodyAuditLog({
        db,
        tx,
        action: "MANUAL_ASSIGN_TO_TRIP",
        targetCollection: "shipments",
        targetId: trackingShipmentId,
        tripId: trip.tripId || tripId,
        tripDocId: tripId,
        actorId: actor.actorId,
        actorName: actor.actorName,
        actorRole: actor.actorRole,
        reason,
        previousValue: {
          currentTripId: tracking.currentTripId || null,
          enteredRef: shipmentRef,
          packageLabel: resolved.packageLabel,
        },
        newValue: {
          currentTripId: tripId,
          shipmentId: tracking.shipmentId || trackingShipmentId,
          matchedBy: resolved.matchedBy,
        },
        note: `Manual assignment to trip ${trip.tripId || tripId}.`,
      });

      if (tripRequiresAmendmentTracking(trip)) {
        appendPendingAmendmentEntry(tx, tripRef, trip, {
          changeType: resolved.packageLabel ? "CORRECTED" : "ADDED",
          shipmentId: tracking.shipmentId || trackingShipmentId,
          shipmentDocId: trackingShipmentId,
          packageId: resolved.packageLabel || null,
          reason,
          recordedBy: actor.actorId,
          recordedByName: actor.actorName,
        });
      }
    });

    return {
      success: true,
      alreadyAssigned,
      tripId,
      shipmentDocId: trackingShipmentId,
      shipmentId: tracking.shipmentId || trackingShipmentId,
      packageLabel: resolved.packageLabel,
      matchedBy: resolved.matchedBy,
    };
  },
);
