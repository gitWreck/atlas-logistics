"use strict";

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const { FieldValue } = require("firebase-admin/firestore");
const { requireRole } = require("../utilities/helpers");
const { ALLOWED_SHIPMENT_STATUSES } = require("../utilities/dataDetails");
const { writeShipmentActionLog } = require("../utilities/shipmentLogger");

if (!admin.apps.length) admin.initializeApp();

const db = admin.firestore();

exports.updateShipmentStatus = onCall(
  { region: "asia-southeast1", maxInstances: 10 },
  async (req) => {
    if (!req.auth) {
      throw new HttpsError("unauthenticated", "Auth required.");
    }

    const uid = req.auth.uid;

    await requireRole(db, req, ["admin", "manager", "checker", "driver"]);

    const {
      shipmentId,
      tripId,
      newStatus,
      remarks,
      location,
      proofOfDelivery,
      proofOfReceipt,
      paymentStatus,
      sourceUI = "SYSTEM",
    } = req.data || {};

    if (!shipmentId || !newStatus) {
      throw new HttpsError("invalid-argument", "Missing shipmentId or status.");
    }

    if (!ALLOWED_SHIPMENT_STATUSES.includes(newStatus)) {
      throw new HttpsError("invalid-argument", `Invalid status: ${newStatus}`);
    }

    const shipmentRef = db.collection("shipments").doc(shipmentId);
    const tripRef = tripId ? db.collection("truck_trips").doc(tripId) : null;
    const tripShipmentRef = tripRef
      ? tripRef.collection("trip_shipments").doc(shipmentId)
      : null;

    await db.runTransaction(async (tx) => {
      const shipmentSnap = await tx.get(shipmentRef);

      if (!shipmentSnap.exists) {
        throw new HttpsError("not-found", "Shipment not found.");
      }

      let tripShipSnap = null;
      if (tripShipmentRef) {
        tripShipSnap = await tx.get(tripShipmentRef);
      }

      const currentData = shipmentSnap.data() || {};
      const oldStatus = currentData.status || null;
      const currentPackages = Array.isArray(currentData.packages)
        ? currentData.packages
        : [];

      if (oldStatus === newStatus) {
        return;
      }

      const normalizeQty = (value, fallback = 0) => {
        const num = Number(value);
        return Number.isFinite(num) && num >= 0 ? num : fallback;
      };

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

      const oldPackages = currentPackages.map(normalizePackage);

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

      const oldTotalQty =
        sumTotalQty(oldPackages) ||
        Number(currentData.totals?.totalContentQty || 0);

      const oldLoadedQty =
        sumLoadedQty(oldPackages) || Number(currentData.totals?.loaded || 0);

      const oldReceivedQty =
        sumReceivedQty(oldPackages) ||
        Number(
          currentData.totals?.received || currentData.totals?.delivered || 0,
        );

      const rowCount = oldPackages.length;

      const updatedPackages = oldPackages.map((pkg) => {
        const quantity = normalizeQty(pkg.quantity, 1);

        const nextPkg = {
          ...pkg,
          status: newStatus,
          updatedAt: new Date().toISOString(),
        };

        if (newStatus === "LOADED") {
          nextPkg.loadedQty = quantity;
        } else if (newStatus === "RECEIVED") {
          nextPkg.loadedQty = 0;
          nextPkg.receivedQty = 0;
        } else if (newStatus === "DELIVERED") {
          nextPkg.loadedQty = quantity;
          nextPkg.receivedQty = quantity;
          nextPkg.deliveredAt = new Date().toISOString();
        } else if (newStatus === "MISSING") {
          nextPkg.loadedQty = 0;
        }

        return nextPkg;
      });

      const newTotalQty = sumTotalQty(updatedPackages) || oldTotalQty;

      let newLoadedQty = oldLoadedQty;
      let newReceivedQty = oldReceivedQty;

      if (newStatus === "LOADED") {
        newLoadedQty = newTotalQty;
        newReceivedQty = 0;
      } else if (newStatus === "RECEIVED") {
        newLoadedQty = 0;
        newReceivedQty = 0;
      } else if (newStatus === "DELIVERED") {
        newLoadedQty = newTotalQty;
        newReceivedQty = newTotalQty;
      } else if (newStatus === "MISSING") {
        newLoadedQty = 0;
      }

      const newPendingQty = Math.max(newTotalQty - newLoadedQty, 0);

      const shipmentUpdate = {
        status: newStatus,
        packages: updatedPackages,
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: uid,
        remarks: remarks || null,

        ...(location && { lastLocation: location }),
        ...(proofOfDelivery && { proofOfDelivery }),
        ...(proofOfReceipt && { proofOfReceipt }),
        ...(paymentStatus && { paymentStatus }),

        "totals.totalItems": rowCount,
        "totals.totalContentQty": newTotalQty,
        "totals.loaded": newLoadedQty,
        "totals.pending": newPendingQty,
        "totals.received": newReceivedQty,
        "totals.delivered": newReceivedQty,

        statusHistory: FieldValue.arrayUnion({
          status: newStatus,
          at: new Date(),
          by: uid,
          note: remarks || `Status updated via ${sourceUI}`,
          location: location || null,
        }),
      };

      tx.update(shipmentRef, shipmentUpdate);

      if (tripRef && tripShipmentRef && tripShipSnap && tripShipSnap.exists) {
        const tripUpdate = {
          updatedAt: FieldValue.serverTimestamp(),
          updatedBy: uid,
        };

        const oldLoadedDelta = oldLoadedQty;
        const newLoadedDelta = newLoadedQty;

        const oldReceivedDelta = oldReceivedQty;
        const newReceivedDelta = newReceivedQty;

        const oldPendingQty = Math.max(oldTotalQty - oldLoadedQty, 0);
        const deltaLoaded = newLoadedDelta - oldLoadedDelta;
        const deltaReceived = newReceivedDelta - oldReceivedDelta;
        const deltaPending = newPendingQty - oldPendingQty;

        if (deltaLoaded !== 0) {
          tripUpdate.totalLoaded = FieldValue.increment(deltaLoaded);
        }

        if (deltaReceived !== 0) {
          tripUpdate.totalArrived = FieldValue.increment(deltaReceived);
          tripUpdate.totalDelivered = FieldValue.increment(deltaReceived);
        }

        if (deltaPending !== 0) {
          tripUpdate.itemPending = FieldValue.increment(deltaPending);
        }

        if (newStatus === "MISSING") {
          tripUpdate.totalExceptions = FieldValue.increment(newTotalQty);
        }

        tx.update(tripRef, tripUpdate);

        tx.update(tripShipmentRef, {
          status: newStatus,
          totalItems: newTotalQty,
          loadedCount: newLoadedQty,
          pendingCount: newPendingQty,
          deliveredCount: newReceivedQty,
          receivedCount: newReceivedQty,
          updatedAt: FieldValue.serverTimestamp(),
          updatedBy: uid,
        });
      }

      writeShipmentActionLog({
        db,
        tx,
        collection: "audit_logs",
        action: `${sourceUI}_UPDATE_${newStatus}`,
        targetId: shipmentId,
        shipmentId,
        actorId: uid,
        details: {
          oldStatus,
          newStatus,
          quantity: newTotalQty,
          rowCount,
          tripId: tripId || "N/A",
        },
        timestamp: FieldValue.serverTimestamp(),
      });
    });

    return { success: true, status: newStatus };
  },
);
