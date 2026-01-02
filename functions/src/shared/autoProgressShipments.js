"use strict";

const admin = require("firebase-admin");
const { assertStatusTransition } = require("./assertStatusTransition");
const { STATUS_FLOW } = require("./statusFlow");

const db = admin.firestore();

/**
 * Auto-progress shipments linked to a trip
 */
exports.autoProgressShipmentsForTrip = async ({
  tx,
  tripDocId,
  newTripStatus,
  actorRole,
  actorUid
}) => {
  const STATUS_MAP = {
    IN_TRANSIT: "In Transit",
    ARRIVED_AT_PORT: "Arrived at Port",
    OUT_FOR_DELIVERY: "Out for Delivery"
  };

  const nextShipmentStatus = STATUS_MAP[newTripStatus];
  if (!nextShipmentStatus) return; // no-op

  const nextIndex = STATUS_FLOW.indexOf(nextShipmentStatus);
  if (nextIndex === -1) return;

  const pkgsSnap = await tx.get(
    db.collection("truck_trips")
      .doc(tripDocId)
      .collection("trip_packages")
  );

  for (const pkg of pkgsSnap.docs) {
    const pkgData = pkg.data();
    const trackingDocId = pkgData.trackingDocId || pkg.id;

    const shipmentRef = db.collection("tracking_records").doc(trackingDocId);
    const shipmentSnap = await tx.get(shipmentRef);

    if (!shipmentSnap.exists) continue;

    const shipment = shipmentSnap.data();

    // Skip terminal or already ahead
    if (shipment.status === "Delivered") continue;
    if ((shipment.statusIndex ?? -1) >= nextIndex) continue;

    // Guard transition
    assertStatusTransition({
      currentStatus: shipment.status,
      currentIndex: shipment.statusIndex,
      nextStatus: nextShipmentStatus,
      nextIndex,
      actorRole
    });

    // Update shipment
    tx.update(shipmentRef, {
      status: nextShipmentStatus,
      statusIndex: nextIndex,
      lastUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
      lastUpdatedBy: actorUid,
      lastUpdatedRole: actorRole
    });

    // Append status event
    tx.set(shipmentRef.collection("status_events").doc(), {
      type: "AUTO_PROGRESS",
      message: `Auto-updated due to Trip ${newTripStatus}`,
      tripDocId,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      createdBy: actorUid,
      createdRole: actorRole
    });
  }
};
