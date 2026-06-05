"use strict";

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const { FieldValue } = admin.firestore;
const { requireRole, updatedBy } = require("../utilities/helpers");
const { writeShipmentActionLog } = require("../utilities/shipmentLogger");
const {
  packageEligibleForLinehaulLoad,
  packageOnTrip,
  applyLinehaulLoad,
  applyLinehaulUnloadAtHub,
  applyLinehaulMissing,
  applyLinehaulDelivered,
  buildShipmentSnapshot,
  sumLoadedQty,
  sumReceivedQty,
  sumTotalQty,
  normalizePackageRow,
} = require("../packages/tripPackageOperations");
const { tryAutoCompleteTrip } = require("../trips/autoCompleteTrip");

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

exports.bulkShipmentAction = onCall(
  { region: "asia-southeast1", maxInstances: 10 },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Auth required");
    }

    await requireRole(db, request, ["admin", "manager", "checker"]);

    const { tripId, shipmentIds, action, location, remarks } =
      request.data || {};

    const { uid, role, name } = updatedBy(request);

    if (!tripId || typeof tripId !== "string") {
      throw new HttpsError("invalid-argument", "Missing tripId");
    }

    if (!Array.isArray(shipmentIds) || shipmentIds.length === 0) {
      throw new HttpsError("invalid-argument", "Missing shipmentIds");
    }

    if (!action || typeof action !== "string") {
      throw new HttpsError("invalid-argument", "Missing action");
    }

    let targetStatus = action;
    if (action === "LOAD") targetStatus = "LOADED";
    if (action === "UNLOAD") targetStatus = "RECEIVED";
    if (action === "DELIVER") targetStatus = "DELIVERED";
    if (action === "MARK_MISSING") targetStatus = "MISSING";

    const allowedStatuses = ["LOADED", "RECEIVED", "DELIVERED", "MISSING"];
    if (!allowedStatuses.includes(targetStatus)) {
      throw new HttpsError(
        "invalid-argument",
        `Unsupported action/status: ${action}`,
      );
    }

    try {
      await db.runTransaction(async (t) => {
        const tripRef = db.collection("truck_trips").doc(tripId);
        const tripSnap = await t.get(tripRef);

        if (!tripSnap.exists) {
          throw new HttpsError("not-found", "Trip not found");
        }

        const tripData = tripSnap.data() || {};

        if (tripData.active === false || tripData.status === "COMPLETED") {
          throw new HttpsError(
            "failed-precondition",
            "Cannot modify a completed/inactive trip",
          );
        }

        if (tripData.manifestLocked === true) {
          throw new HttpsError(
            "failed-precondition",
            "Trip Manifest is LOCKED. Unlock it first.",
          );
        }

        const shipmentRefs = shipmentIds.map((id) =>
          db.collection("shipments").doc(id),
        );
        const tripShipmentRefs = shipmentIds.map((id) =>
          tripRef.collection("trip_shipments").doc(id),
        );

        const [shipmentDocs, tripShipmentDocs] = await Promise.all([
          Promise.all(shipmentRefs.map((ref) => t.get(ref))),
          Promise.all(tripShipmentRefs.map((ref) => t.get(ref))),
        ]);

        const nowServer = FieldValue.serverTimestamp();
        const nowIso = new Date().toISOString();

        let tripDeltaLoaded = 0;
        let tripDeltaPending = 0;
        let tripDeltaDelivered = 0;
        let tripDeltaArrived = 0;

        for (let i = 0; i < shipmentIds.length; i++) {
          const shipDoc = shipmentDocs[i];
          const tripShipDoc = tripShipmentDocs[i];
          const shipRef = shipmentRefs[i];
          const tripShipRef = tripShipmentRefs[i];

          if (!shipDoc.exists) {
            continue;
          }

          const shipData = shipDoc.data() || {};
          const oldPackagesRaw = Array.isArray(shipData.packages)
            ? shipData.packages
            : [];
          const oldPackages = oldPackagesRaw.map(normalizePackageRow);

          const oldLoadedQty = sumLoadedQty(oldPackages);
          const oldReceivedQty = sumReceivedQty(oldPackages);
          const oldTotalQty = sumTotalQty(oldPackages);

          const updatedPackages = oldPackages.map((pkg) => {
            if (targetStatus === "LOADED") {
              if (!packageEligibleForLinehaulLoad(pkg)) return pkg;
              return applyLinehaulLoad(pkg, {
                tripId,
                actorName: name,
                nowIso,
              });
            }

            if (targetStatus === "RECEIVED") {
              if (!packageOnTrip(pkg, tripId)) return pkg;
              return applyLinehaulUnloadAtHub(pkg, { tripId, nowIso });
            }

            if (targetStatus === "DELIVERED") {
              if (!packageOnTrip(pkg, tripId)) return pkg;
              return applyLinehaulDelivered(pkg, { tripId, nowIso });
            }

            if (targetStatus === "MISSING") {
              if (!packageOnTrip(pkg, tripId)) return pkg;
              return applyLinehaulMissing(pkg, { tripId, nowIso });
            }

            return pkg;
          });

          const snapshot = buildShipmentSnapshot(updatedPackages, {
            previousStatus: shipData.status,
            isHubReceive: targetStatus === "RECEIVED",
          });

          const newLoadedQty = snapshot.totals.loaded;
          const newReceivedQty = snapshot.totals.received;
          const newTotalQty = snapshot.totals.totalContentQty;
          const newPendingQty = snapshot.totals.pending;

          const deltaLoaded = newLoadedQty - oldLoadedQty;
          const deltaPending = newPendingQty - Math.max(oldTotalQty - oldLoadedQty, 0);
          const deltaDelivered = newReceivedQty - oldReceivedQty;

          tripDeltaLoaded += deltaLoaded;
          tripDeltaPending += deltaPending;
          tripDeltaDelivered += deltaDelivered;
          tripDeltaArrived += deltaDelivered;

          t.update(shipRef, {
            status: snapshot.status,
            packages: snapshot.packages,
            packageBreakdown: snapshot.packageBreakdown,
            currentTripIds: snapshot.currentTripIds,
            currentTripId: snapshot.currentTripId,

            "totals.totalItems": snapshot.totals.totalItems,
            "totals.totalContentQty": newTotalQty,
            "totals.loaded": newLoadedQty,
            "totals.pending": newPendingQty,
            "totals.received": newReceivedQty,
            "totals.delivered": newReceivedQty,
            "totals.missing": snapshot.totals.missing,
            "totals.damaged": snapshot.totals.damaged,

            updatedAt: nowServer,
            updatedBy: name,
            updatedRole: "bulk-action",
            remarks: remarks || null,

            statusHistory: FieldValue.arrayUnion({
              status: snapshot.status,
              at: new Date(),
              by: name,
              note:
                remarks ||
                `Bulk ${action} applied to packages on trip ${tripId}.`,
              location: location || null,
            }),

            ...(location ? { lastLocation: location } : {}),
          });

          if (tripShipDoc.exists) {
            t.update(tripShipRef, {
              status: snapshot.status,
              totalItems: newTotalQty,
              loadedCount: newLoadedQty,
              pendingCount: newPendingQty,
              deliveredCount: newReceivedQty,
              receivedCount: newReceivedQty,
              missingCount: snapshot.totals.missing,
              damagedCount: snapshot.totals.damaged,
              updatedAt: nowServer,
              updatedBy: name,
            });
          }
        }

        const tripUpdate = {
          totalLoaded: FieldValue.increment(tripDeltaLoaded),
          itemPending: FieldValue.increment(tripDeltaPending),
          totalDelivered: FieldValue.increment(tripDeltaDelivered),
          totalArrived: FieldValue.increment(tripDeltaArrived),
          updatedAt: nowServer,
          updatedBy: name,
        };

        t.update(tripRef, tripUpdate);

        writeShipmentActionLog({
          db,
          tx: t,
          collection: "audit_logs",
          action: `BULK_${targetStatus}`,
          targetId: tripId,
          targetCollection: "truck_trips",
          tripId,
          actorId: uid,
          actorName: name,
          actorRole: role,
          at: nowServer,
          details: {
            shipmentCount: shipmentIds.length,
            remarks: remarks || "N/A",
            location: location || null,
            deltas: {
              loaded: tripDeltaLoaded,
              pending: tripDeltaPending,
              delivered: tripDeltaDelivered,
              arrived: tripDeltaArrived,
            },
          },
        });
      });

      try {
        await tryAutoCompleteTrip(tripId, {
          actorId: uid,
          actorName: name,
          actorRole: role,
          source: "BULK_SHIPMENT_ACTION",
        });
      } catch (autoCompleteError) {
        console.error("Auto-complete trip failed:", autoCompleteError);
      }

      return { success: true };
    } catch (error) {
      console.error("Bulk Action Error:", error);
      if (error instanceof HttpsError) throw error;
      throw new HttpsError("internal", error.message || "Bulk action failed");
    }
  },
);
