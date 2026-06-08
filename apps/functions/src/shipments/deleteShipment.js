"use strict";

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const { FieldValue } = admin.firestore;
const { requireShipmentTripDeleteAccess, updatedBy } = require("../utilities/helpers");
const { normalizeQty } = require("../utilities/packageHelpers");
const { writeShipmentActionLog } = require("../utilities/shipmentLogger");
const { deleteSubcollection } = require("../utilities/firestoreCleanup");

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

function snapshotShipment(shipment = {}, shipmentDocId) {
  return {
    shipmentId: shipment.shipmentId || shipment.trackingNumber || shipmentDocId,
    status: shipment.status || null,
    origin: shipment.origin || null,
    destination: shipment.destination || null,
    originCode: shipment.originCode || null,
    destinationCode: shipment.destinationCode || null,
    currentTripId: shipment.currentTripId || shipment.currentTruckTripId || null,
    packageCount: Array.isArray(shipment.packages)
      ? shipment.packages.length
      : shipment.totals?.totalItems ?? null,
    senderName: shipment.sender?.name || shipment.senderName || null,
    recipientName: shipment.recipient?.name || shipment.recipientName || null,
  };
}

exports.deleteShipment = onCall(
  { region: "asia-southeast1", maxInstances: 10 },
  async (req) => {
    const { user } = await requireShipmentTripDeleteAccess(db, req);

    const shipmentId = req.data?.shipmentId || req.data?.shipmentDocId;
    const reason =
      String(req.data?.reason || "").trim() || "Deleted from admin UI";

    if (!shipmentId || typeof shipmentId !== "string") {
      throw new HttpsError("invalid-argument", "shipmentId is required");
    }

    const { uid, role, name } = updatedBy(req);
    const actorName = name || user.name || null;

    const shipmentRef = db.collection("shipments").doc(shipmentId);
    const shipmentSnap = await shipmentRef.get();

    if (!shipmentSnap.exists) {
      throw new HttpsError("not-found", "Shipment not found");
    }

    const shipment = shipmentSnap.data() || {};
    const before = snapshotShipment(shipment, shipmentId);
    const tripId = shipment.currentTripId || shipment.currentTruckTripId || null;

    let tripManifestRemoved = false;

    if (tripId) {
      const tripRef = db.collection("truck_trips").doc(tripId);
      const tripShipRef = tripRef.collection("trip_shipments").doc(shipmentId);

      await db.runTransaction(async (tx) => {
        const [tripSnap, tripShipSnap] = await Promise.all([
          tx.get(tripRef),
          tx.get(tripShipRef),
        ]);

        if (tripSnap.exists && tripShipSnap.exists) {
          const tripShipment = tripShipSnap.data() || {};
          const removeTotal = normalizeQty(tripShipment.totalItems, 0);
          const removePending = normalizeQty(tripShipment.pendingCount, 0);
          const removeLoaded = normalizeQty(tripShipment.loadedCount, 0);
          const removeDelivered = normalizeQty(
            tripShipment.deliveredCount || tripShipment.receivedCount,
            0,
          );
          const removeMissing = normalizeQty(tripShipment.missingCount, 0);
          const removeDamaged = normalizeQty(tripShipment.damagedCount, 0);

          tx.update(tripRef, {
            totalItems: FieldValue.increment(-removeTotal),
            itemPending: FieldValue.increment(-removePending),
            totalLoaded: FieldValue.increment(-removeLoaded),
            totalDelivered: FieldValue.increment(-removeDelivered),
            totalArrived: FieldValue.increment(-removeDelivered),
            totalMissing: FieldValue.increment(-removeMissing),
            totalDamaged: FieldValue.increment(-removeDamaged),
            updatedAt: FieldValue.serverTimestamp(),
            updatedBy: actorName || "SYSTEM",
          });

          tx.delete(tripShipRef);
          tripManifestRemoved = true;
        } else if (tripShipSnap.exists) {
          tx.delete(tripShipRef);
          tripManifestRemoved = true;
        }
      });
    }

    const invoiceSnap = await db
      .collection("invoices")
      .where("shipmentId", "==", shipmentId)
      .limit(5)
      .get();

    await deleteSubcollection(shipmentRef, "status_events");
    await db.collection("tracking_public").doc(shipmentId).delete().catch(() => {});

    await db.runTransaction(async (tx) => {
      writeShipmentActionLog({
        db,
        tx,
        action: "DELETE_SHIPMENT",
        shipmentDocId: shipmentId,
        shipmentId: before.shipmentId,
        tripId,
        actorId: uid,
        actorName,
        actorRole: role,
        details: {
          reason,
          before,
          tripManifestRemoved,
          linkedInvoiceCount: invoiceSnap.size,
          hardDelete: true,
        },
      });

      tx.delete(shipmentRef);
    });

    return {
      success: true,
      shipmentId,
      tripManifestRemoved,
      linkedInvoiceCount: invoiceSnap.size,
    };
  },
);
