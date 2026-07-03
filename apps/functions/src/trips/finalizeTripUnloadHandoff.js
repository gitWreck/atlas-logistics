"use strict";

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const { FieldValue } = admin.firestore;
const {
  requireRole,
  requireString,
  updatedBy,
} = require("../utilities/helpers");
const { writeShipmentActionLog } = require("../utilities/shipmentLogger");
const { writeTripActionLog } = require("../utilities/tripLogger");
const { normalizeQty } = require("../utilities/packageHelpers");

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

const shipmentTotalQty = (
  shipment = {},
  tripShipment = {},
  manifestItem = {},
) =>
  normalizeQty(
    shipment.totals?.totalContentQty ??
      shipment.totals?.totalItems ??
      tripShipment.totalItems ??
      manifestItem.totalCount ??
      manifestItem.loadedCount,
    0,
  );

const stampPackagesReadyForDelivery = (packages = []) =>
  packages.map((pkg) => {
    const quantity = Math.max(normalizeQty(pkg.quantity, 1), 1);

    return {
      ...pkg,
      status: "READY_FOR_DELIVERY",
      loadedQty: 0,
      updatedAt: new Date().toISOString(),
    };
  });

exports.finalizeTripUnloadHandoff = onCall(
  { region: "asia-southeast1", maxInstances: 10 },
  async (req) => {
    // const actor = await requireRole(db, req, ["admin", "manager"]);
    // const uid = req.auth.uid;

    const { uid, role, name } = updatedBy(req);

    const sourceTripId = requireString(req.data?.sourceTripId, "sourceTripId");
    const deliveryTripId = requireString(
      req.data?.deliveryTripId,
      "deliveryTripId",
    );
    const missingRemarks =
      req.data?.missingRemarks && typeof req.data.missingRemarks === "object"
        ? req.data.missingRemarks
        : {};

    if (sourceTripId === deliveryTripId) {
      throw new HttpsError(
        "invalid-argument",
        "Source trip and delivery trip must be different.",
      );
    }

    const sourceTripRef = db.collection("truck_trips").doc(sourceTripId);
    const deliveryTripRef = db.collection("truck_trips").doc(deliveryTripId);
    const now = FieldValue.serverTimestamp();
    const nowTs = admin.firestore.Timestamp.now();

    const result = await db.runTransaction(async (tx) => {
      const [sourceTripSnap, deliveryTripSnap] = await Promise.all([
        tx.get(sourceTripRef),
        tx.get(deliveryTripRef),
      ]);

      if (!sourceTripSnap.exists) {
        throw new HttpsError("not-found", "Source trip not found.");
      }
      if (!deliveryTripSnap.exists) {
        throw new HttpsError("not-found", "Delivery trip not found.");
      }

      const sourceTrip = sourceTripSnap.data() || {};
      const deliveryTrip = deliveryTripSnap.data() || {};
      const deliveryTripType = String(
        deliveryTrip.tripType || "",
      ).toUpperCase();

      if (deliveryTripType !== "DELIVERY") {
        throw new HttpsError(
          "failed-precondition",
          "Selected trip is not a DELIVERY trip.",
        );
      }

      if (
        deliveryTrip.active === false ||
        String(deliveryTrip.status || "").toUpperCase() === "COMPLETED"
      ) {
        throw new HttpsError(
          "failed-precondition",
          "Cannot assign to a completed or inactive delivery trip.",
        );
      }

      if (deliveryTrip.manifestLocked === true) {
        throw new HttpsError(
          "failed-precondition",
          "Delivery trip manifest is locked. Unlock it first.",
        );
      }

      const manifestId = sourceTrip.manifestId;
      if (!manifestId) {
        throw new HttpsError(
          "failed-precondition",
          "Source trip has no manifest to reconcile.",
        );
      }

      const manifestRef = db.collection("manifests").doc(manifestId);
      const manifestSnap = await tx.get(manifestRef);
      if (!manifestSnap.exists) {
        throw new HttpsError("not-found", "Source manifest not found.");
      }

      const manifest = manifestSnap.data() || {};
      const manifestItems = Array.isArray(manifest.shipments)
        ? manifest.shipments
        : [];

      if (!manifestItems.length) {
        throw new HttpsError(
          "failed-precondition",
          "Source manifest has no shipments to hand off.",
        );
      }

      const normalizedManifestItems = manifestItems.map((item) => ({
        ...item,
        trackingShipmentId:
          item.trackingShipmentId || item.shipmentId || item.id || null,
      }));
      const handoffItems = normalizedManifestItems.filter(
        (item) => item.trackingShipmentId,
      );

      const manifestShipmentIds = handoffItems.map(
        (item) => item.trackingShipmentId,
      );

      if (!manifestShipmentIds.length) {
        throw new HttpsError(
          "failed-precondition",
          "Source manifest has no valid shipment IDs to hand off.",
        );
      }

      const sourceTripShipmentRefs = manifestShipmentIds.map((id) =>
        sourceTripRef.collection("trip_shipments").doc(id),
      );
      const deliveryTripShipmentRefs = manifestShipmentIds.map((id) =>
        deliveryTripRef.collection("trip_shipments").doc(id),
      );
      const shipmentRefs = manifestShipmentIds.map((id) =>
        db.collection("shipments").doc(id),
      );

      const [
        sourceTripShipmentSnaps,
        deliveryTripShipmentSnaps,
        shipmentSnaps,
      ] = await Promise.all([
        tx.getAll(...sourceTripShipmentRefs),
        tx.getAll(...deliveryTripShipmentRefs),
        tx.getAll(...shipmentRefs),
      ]);

      const missing = [];
      const blockers = [];
      let assigned = 0;
      let aggregateTotalItems = 0;

      handoffItems.forEach((manifestItem, index) => {
        const shipmentId = manifestItem.trackingShipmentId;

        const sourceTripShipmentSnap = sourceTripShipmentSnaps[index];
        const deliveryTripShipmentSnap = deliveryTripShipmentSnaps[index];
        const shipmentSnap = shipmentSnaps[index];

        if (!shipmentSnap.exists) {
          blockers.push(`Shipment ${shipmentId} was not found.`);
          return;
        }

        const shipment = shipmentSnap.data() || {};
        const sourceTripShipment = sourceTripShipmentSnap.exists
          ? sourceTripShipmentSnap.data() || {}
          : {};
        const remainingLoaded = normalizeQty(sourceTripShipment.loadedCount, 0);
        const remark = String(missingRemarks[shipmentId] || "").trim();

        if (remainingLoaded > 0) {
          missing.push({
            shipmentId,
            remainingLoaded,
          });

          if (!remark) {
            blockers.push(
              `Remarks are required for missing shipment ${shipmentId}.`,
            );
            return;
          }
        }

        if (
          shipment.currentTripId &&
          shipment.currentTripId !== sourceTripId &&
          shipment.currentTripId !== deliveryTripId &&
          !sourceTripShipmentSnap.exists
        ) {
          blockers.push(
            `Shipment ${shipmentId} belongs to another trip (${shipment.currentTripId}).`,
          );
          return;
        }

        const totalItems = shipmentTotalQty(
          shipment,
          sourceTripShipment,
          manifestItem,
        );
        const packages = stampPackagesReadyForDelivery(shipment.packages || []);
        const publicShipmentId =
          shipment.shipmentId || manifestItem.shipmentId || shipmentId;
        const route =
          sourceTripShipment.route ||
          `${shipment.originCode || "?"} -> ${shipment.destinationCode || "?"}`;

        tx.set(
          deliveryTripShipmentRefs[index],
          {
            ...sourceTripShipment,
            trackingShipmentId: shipmentId,
            shipmentId: publicShipmentId,
            route,
            totalItems,
            pendingCount: totalItems,
            loadedCount: 0,
            deliveredCount: 0,
            receivedCount: 0,
            sender: shipment.sender || sourceTripShipment.sender || null,
            recipient:
              shipment.recipient || sourceTripShipment.recipient || null,
            packageBarcodes:
              shipment.packageBarcodes ||
              sourceTripShipment.packageBarcodes ||
              [],
            sourceTripId,
            missingOnSourceTrip: remainingLoaded > 0,
            missingRemarks: remainingLoaded > 0 ? remark : null,
            status: "READY_FOR_DELIVERY",
            createdAt: deliveryTripShipmentSnap.exists
              ? deliveryTripShipmentSnap.data()?.createdAt || now
              : now,
            createdBy: deliveryTripShipmentSnap.exists
              ? deliveryTripShipmentSnap.data()?.createdBy || name
              : name,
            updatedAt: now,
            updatedBy: name,
            updatedRole: role,
          },
          { merge: true },
        );

        if (sourceTripShipmentSnap.exists) {
          tx.update(sourceTripShipmentRefs[index], {
            handoffTripId: deliveryTripId,
            missingOnHandoff: remainingLoaded > 0,
            missingRemarks: remainingLoaded > 0 ? remark : null,
            status: "COMPLETED",
            updatedAt: now,
            updatedBy: name,
          });
        }

        const shipmentUpdate = {
          currentTripId: deliveryTripId,
          assignedToTripAt: now,
          status: "READY_FOR_DELIVERY",
          packages,
          updatedAt: now,
          updatedBy: name,
          updatedRole: role,
          handoff: {
            sourceTripId,
            deliveryTripId,
            completedAt: now,
            missingOnSourceTrip: remainingLoaded > 0,
            missingRemarks: remainingLoaded > 0 ? remark : null,
          },
          statusHistory: FieldValue.arrayUnion({
            status: "READY_FOR_DELIVERY",
            at: nowTs,
            by: name,
            note:
              remainingLoaded > 0
                ? `Ready for delivery trip ${deliveryTripId}. Missing remark: ${remark}`
                : `Ready for delivery trip ${deliveryTripId}`,
            location: deliveryTrip.destination || null,
          }),
        };

        if (remainingLoaded > 0) {
          shipmentUpdate.remarks = remark;
          shipmentUpdate.handoffRemarks = remark;
        }

        tx.update(shipmentRefs[index], shipmentUpdate);

        writeShipmentActionLog({
          db,
          tx,
          action: "FINALIZE_UNLOAD_HANDOFF",
          shipmentId: publicShipmentId,
          shipmentDocId: shipmentId,
          tripId: deliveryTripId,
          actorId: uid,
          actorName: name,
          actorRole: role,
          details: {
            sourceTripId,
            deliveryTripId,
            missingOnSourceTrip: remainingLoaded > 0,
            missingRemarks: remainingLoaded > 0 ? remark : null,
          },
          createdAt: now,
        });

        if (!deliveryTripShipmentSnap.exists) {
          aggregateTotalItems += totalItems;
        }

        assigned += 1;
      });

      if (blockers.length) {
        throw new HttpsError("failed-precondition", blockers.join(" "));
      }

      const deliveryTripUpdate = {
        updatedAt: now,
        updatedBy: name,
      };

      if (aggregateTotalItems > 0) {
        deliveryTripUpdate.totalItems =
          FieldValue.increment(aggregateTotalItems);
      }
      if (aggregateTotalItems > 0) {
        deliveryTripUpdate.itemPending =
          FieldValue.increment(aggregateTotalItems);
      }

      tx.update(deliveryTripRef, deliveryTripUpdate);

      tx.update(sourceTripRef, {
        status: "COMPLETED",
        active: false,
        completedAt: now,
        handoffTripId: deliveryTripId,
        handoffCompletedAt: now,
        handoffMissingCount: missing.length,
        updatedAt: now,
        updatedBy: name,
      });

      const sourceTripEventRef = sourceTripRef.collection("trip_events").doc();
      tx.set(sourceTripEventRef, {
        type: "UNLOAD_HANDOFF_COMPLETED",
        deliveryTripId,
        assigned,
        missingCount: missing.length,
        by: uid,
        at: now,
      });

      writeTripActionLog({
        db,
        tx,
        collection: "audit_logs",
        action: "FINALIZE_UNLOAD_HANDOFF",
        tripId: sourceTripId,
        targetId: sourceTripId,
        targetCollection: "truck_trips",
        at: now,
        actorId: uid,
        actorName: name,
        actorRole: role,
        note: `Finalized unload handoff to ${deliveryTripId}.`,
        details: {
          deliveryTripId,
          assigned,
          missingCount: missing.length,
        },
      });

      return {
        success: true,
        assigned,
        missingCount: missing.length,
        deliveryTripId,
      };
    });

    return result;
  },
);

exports.finalizeTripUnloadReadyForDelivery = onCall(
  { region: "asia-southeast1", maxInstances: 10 },
  async (req) => {
    const { uid, role, name } = updatedBy(req);

    const sourceTripId = requireString(req.data?.sourceTripId, "sourceTripId");
    const missingRemarks =
      req.data?.missingRemarks && typeof req.data.missingRemarks === "object"
        ? req.data.missingRemarks
        : {};

    const sourceTripRef = db.collection("truck_trips").doc(sourceTripId);
    const now = FieldValue.serverTimestamp();
    const nowTs = admin.firestore.Timestamp.now();

    const result = await db.runTransaction(async (tx) => {
      const sourceTripSnap = await tx.get(sourceTripRef);

      if (!sourceTripSnap.exists) {
        throw new HttpsError("not-found", "Source trip not found.");
      }

      const sourceTrip = sourceTripSnap.data() || {};
      const manifestId = sourceTrip.manifestId;

      if (!manifestId) {
        throw new HttpsError(
          "failed-precondition",
          "Source trip has no manifest to reconcile.",
        );
      }

      const manifestRef = db.collection("manifests").doc(manifestId);
      const manifestSnap = await tx.get(manifestRef);
      if (!manifestSnap.exists) {
        throw new HttpsError("not-found", "Source manifest not found.");
      }

      const manifest = manifestSnap.data() || {};
      const manifestItems = Array.isArray(manifest.shipments)
        ? manifest.shipments
        : [];

      if (!manifestItems.length) {
        throw new HttpsError(
          "failed-precondition",
          "Source manifest has no shipments to mark ready.",
        );
      }

      const handoffItems = manifestItems
        .map((item) => ({
          ...item,
          trackingShipmentId:
            item.trackingShipmentId || item.shipmentId || item.id || null,
        }))
        .filter((item) => item.trackingShipmentId);

      const manifestShipmentIds = handoffItems.map(
        (item) => item.trackingShipmentId,
      );

      if (!manifestShipmentIds.length) {
        throw new HttpsError(
          "failed-precondition",
          "Source manifest has no valid shipment IDs to mark ready.",
        );
      }

      const sourceTripShipmentRefs = manifestShipmentIds.map((id) =>
        sourceTripRef.collection("trip_shipments").doc(id),
      );
      const shipmentRefs = manifestShipmentIds.map((id) =>
        db.collection("shipments").doc(id),
      );

      const [sourceTripShipmentSnaps, shipmentSnaps] = await Promise.all([
        tx.getAll(...sourceTripShipmentRefs),
        tx.getAll(...shipmentRefs),
      ]);

      const missing = [];
      const blockers = [];
      let markedReady = 0;

      handoffItems.forEach((manifestItem, index) => {
        const shipmentDocId = manifestItem.trackingShipmentId;
        const sourceTripShipmentSnap = sourceTripShipmentSnaps[index];
        const shipmentSnap = shipmentSnaps[index];

        if (!shipmentSnap.exists) {
          blockers.push(`Shipment ${shipmentDocId} was not found.`);
          return;
        }

        const shipment = shipmentSnap.data() || {};
        const sourceTripShipment = sourceTripShipmentSnap.exists
          ? sourceTripShipmentSnap.data() || {}
          : {};
        const remainingLoaded = normalizeQty(sourceTripShipment.loadedCount, 0);
        const remark = String(missingRemarks[shipmentDocId] || "").trim();

        if (remainingLoaded > 0) {
          missing.push({
            shipmentId: shipmentDocId,
            remainingLoaded,
          });

          if (!remark) {
            blockers.push(
              `Remarks are required for missing shipment ${shipmentDocId}.`,
            );
            return;
          }
        }

        if (
          shipment.currentTripId &&
          shipment.currentTripId !== sourceTripId &&
          !sourceTripShipmentSnap.exists
        ) {
          blockers.push(
            `Shipment ${shipmentDocId} belongs to another trip (${shipment.currentTripId}).`,
          );
          return;
        }

        const publicShipmentId =
          shipment.shipmentId || manifestItem.shipmentId || shipmentDocId;
        const packages = stampPackagesReadyForDelivery(
          shipment.packages || [],
        ).map((pkg) => ({
          ...pkg,
          currentTripId: null,
          loadedOnTrip: null,
        }));

        if (sourceTripShipmentSnap.exists) {
          tx.update(sourceTripShipmentRefs[index], {
            missingOnHandoff: remainingLoaded > 0,
            missingRemarks: remainingLoaded > 0 ? remark : null,
            status: "COMPLETED",
            updatedAt: now,
            updatedBy: name,
          });
        }

        const shipmentUpdate = {
          currentTripId: null,
          assignedToTripAt: null,
          status: "READY_FOR_DELIVERY",
          packages,
          updatedAt: now,
          updatedBy: name,
          updatedRole: role,
          handoff: {
            sourceTripId,
            deliveryTripId: null,
            completedAt: now,
            readyForDeliveryOnly: true,
            missingOnSourceTrip: remainingLoaded > 0,
            missingRemarks: remainingLoaded > 0 ? remark : null,
          },
          statusHistory: FieldValue.arrayUnion({
            status: "READY_FOR_DELIVERY",
            at: nowTs,
            by: name,
            note:
              remainingLoaded > 0
                ? `Marked ready for delivery. Missing remark: ${remark}`
                : "Marked ready for delivery",
            location: sourceTrip.destination || null,
          }),
        };

        if (remainingLoaded > 0) {
          shipmentUpdate.remarks = remark;
          shipmentUpdate.handoffRemarks = remark;
        }

        tx.update(shipmentRefs[index], shipmentUpdate);

        writeShipmentActionLog({
          db,
          tx,
          action: "MARK_READY_FOR_DELIVERY",
          shipmentId: publicShipmentId,
          shipmentDocId,
          tripId: sourceTripId,
          actorId: uid,
          actorName: name,
          actorRole: role,
          details: {
            sourceTripId,
            missingOnSourceTrip: remainingLoaded > 0,
            missingRemarks: remainingLoaded > 0 ? remark : null,
          },
          createdAt: now,
        });

        markedReady += 1;
      });

      if (blockers.length) {
        throw new HttpsError("failed-precondition", blockers.join(" "));
      }

      tx.update(sourceTripRef, {
        status: "COMPLETED",
        active: false,
        completedAt: now,
        readyForDeliveryAt: now,
        handoffTripId: null,
        handoffCompletedAt: now,
        handoffMissingCount: missing.length,
        updatedAt: now,
        updatedBy: name,
      });

      const sourceTripEventRef = sourceTripRef.collection("trip_events").doc();
      tx.set(sourceTripEventRef, {
        type: "UNLOAD_READY_FOR_DELIVERY",
        markedReady,
        missingCount: missing.length,
        by: uid,
        at: now,
      });

      writeTripActionLog({
        db,
        tx,
        collection: "audit_logs",
        action: "MARK_READY_FOR_DELIVERY",
        tripId: sourceTripId,
        targetId: sourceTripId,
        targetCollection: "truck_trips",
        at: now,
        actorId: uid,
        actorName: name,
        actorRole: role,
        note: "Finalized unload and marked shipments ready for delivery.",
        details: {
          markedReady,
          missingCount: missing.length,
        },
      });

      return {
        success: true,
        markedReady,
        missingCount: missing.length,
      };
    });

    return result;
  },
);
