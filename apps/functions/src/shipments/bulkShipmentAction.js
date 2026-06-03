"use strict";

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const { FieldValue } = admin.firestore;
const { requireRole, updatedBy } = require("../utilities/helpers");
const { writeShipmentActionLog } = require("../utilities/shipmentLogger");
const { deriveMasterShipmentStatus } = require("../packages/shipmentStatus");
const { normalizeQty } = require("../utilities/packageHelpers");

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
    const userId = request.auth.uid;

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

        const normalizePackage = (pkg = {}) => {
          const quantity = normalizeQty(pkg.quantity, 1) || 1;
          const loadedQty = Math.min(normalizeQty(pkg.loadedQty, 0), quantity);
          const receivedQty = Math.min(
            normalizeQty(pkg.receivedQty, 0),
            quantity,
          );

          return {
            ...pkg,
            quantity,
            loadedQty,
            receivedQty,
          };
        };

        const sumTotalQty = (pkgs) =>
          pkgs.reduce((sum, pkg) => sum + normalizeQty(pkg.quantity, 1), 0);

        const sumLoadedQty = (pkgs) =>
          pkgs.reduce((sum, pkg) => {
            const quantity = normalizeQty(pkg.quantity, 1);
            if (pkg.status === "LOADED") return sum + quantity;
            if (pkg.status === "PARTIALLY_LOADED") {
              return sum + Math.min(normalizeQty(pkg.loadedQty, 0), quantity);
            }
            return sum;
          }, 0);

        const sumReceivedQty = (pkgs) =>
          pkgs.reduce((sum, pkg) => {
            const quantity = normalizeQty(pkg.quantity, 1);
            if (pkg.status === "DELIVERED") return sum + quantity;
            if (pkg.status === "PARTIALLY_RECEIVED") {
              return sum + Math.min(normalizeQty(pkg.receivedQty, 0), quantity);
            }
            return sum;
          }, 0);

        const deriveShipmentStatus = (pkgs) => deriveMasterShipmentStatus(pkgs);

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

          if (shipData.currentTripId && shipData.currentTripId !== tripId) {
            throw new HttpsError(
              "failed-precondition",
              `Shipment ${shipDoc.id} belongs to another trip (${shipData.currentTripId})`,
            );
          }

          const oldPackagesRaw = Array.isArray(shipData.packages)
            ? shipData.packages
            : [];
          const oldPackages = oldPackagesRaw.map(normalizePackage);

          const updatedPackages = oldPackages.map((pkg) => {
            const quantity = normalizeQty(pkg.quantity, 1);

            if (targetStatus === "LOADED") {
              return {
                ...pkg,
                status: "LOADED",
                loadedQty: quantity,
                updatedAt: new Date().toISOString(),
              };
            }

            if (targetStatus === "RECEIVED") {
              return {
                ...pkg,
                status: "RECEIVED",
                loadedQty: 0,
                updatedAt: new Date().toISOString(),
              };
            }

            if (targetStatus === "DELIVERED") {
              return {
                ...pkg,
                status: "DELIVERED",
                loadedQty: quantity,
                receivedQty: quantity,
                updatedAt: new Date().toISOString(),
              };
            }

            if (targetStatus === "MISSING") {
              return {
                ...pkg,
                status: "MISSING",
                updatedAt: new Date().toISOString(),
              };
            }

            return pkg;
          });

          const oldTotalQty = sumTotalQty(oldPackages);
          const newTotalQty = sumTotalQty(updatedPackages);

          const oldLoadedQty = sumLoadedQty(oldPackages);
          const newLoadedQty = sumLoadedQty(updatedPackages);

          const oldReceivedQty = sumReceivedQty(oldPackages);
          const newReceivedQty = sumReceivedQty(updatedPackages);

          const newPendingQty = Math.max(newTotalQty - newLoadedQty, 0);
          const oldPendingQty = Math.max(oldTotalQty - oldLoadedQty, 0);

          const deltaLoaded = newLoadedQty - oldLoadedQty;
          const deltaPending = newPendingQty - oldPendingQty;
          const deltaDelivered = newReceivedQty - oldReceivedQty;

          tripDeltaLoaded += deltaLoaded;
          tripDeltaPending += deltaPending;
          tripDeltaDelivered += deltaDelivered;
          tripDeltaArrived += deltaDelivered;

          const shipmentStatus = deriveShipmentStatus(updatedPackages);

          t.update(shipRef, {
            status: shipmentStatus,
            packages: updatedPackages,

            "totals.totalItems": updatedPackages.length,
            "totals.totalContentQty": newTotalQty,
            "totals.loaded": newLoadedQty,
            "totals.pending": newPendingQty,
            "totals.received": newReceivedQty,
            "totals.delivered": newReceivedQty,

            updatedAt: nowServer,
            updatedBy: name,
            updatedRole: "bulk-action",
            remarks: remarks || null,

            statusHistory: FieldValue.arrayUnion({
              status: shipmentStatus,
              at: new Date(),
              by: name,
              note: remarks || `Bulk ${action} applied.`,
              location: location || null,
            }),

            ...(location ? { lastLocation: location } : {}),
          });

          if (tripShipDoc.exists) {
            t.update(tripShipRef, {
              status: shipmentStatus,
              totalItems: newTotalQty,
              loadedCount: newLoadedQty,
              pendingCount: newPendingQty,
              deliveredCount: newReceivedQty,
              receivedCount: newReceivedQty,
              updatedAt: nowServer,
              updatedBy: name,
            });
          }
        }

        t.update(tripRef, {
          totalLoaded: FieldValue.increment(tripDeltaLoaded),
          itemPending: FieldValue.increment(tripDeltaPending),
          totalDelivered: FieldValue.increment(tripDeltaDelivered),
          totalArrived: FieldValue.increment(tripDeltaArrived),
          updatedAt: nowServer,
          updatedBy: name,
        });

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

      return { success: true };
    } catch (error) {
      console.error("Bulk Action Error:", error);
      throw new HttpsError("internal", error.message || "Bulk action failed");
    }
  },
);
