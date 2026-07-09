"use strict";

const { onDocumentWritten } = require("firebase-functions/v2/firestore");
const { onRequest } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const { FieldValue } = require("firebase-admin/firestore");
const {
  formatStatus,
  sanitizeDriverName,
} = require("../utilities/helpers");
const {
  buildPublicTrackingHistory,
  resolvePublicDeliveryContext,
} = require("./publicTrackingFormat");
const { extractTripEventContext } = require("./tripEventContext");
const { computePackageBreakdown } = require("../packages/shipmentStatus");

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

async function loadTripContextForShipment(shipmentData = {}) {
  const tripDocId =
    shipmentData.currentTripId || shipmentData.currentTruckTripId || null;

  const base = {
    tripId: null,
    driverName: null,
    plateNumber: null,
    isDelayed: false,
    delayReason: null,
    currentLocation: "Processing",
  };

  if (!tripDocId) return base;

  const tripSnap = await db.collection("truck_trips").doc(tripDocId).get();
  if (!tripSnap.exists) return base;

  const tripData = tripSnap.data() || {};
  const tripContext = extractTripEventContext(tripData, tripSnap.id);

  base.tripId = tripContext.tripId || tripSnap.id;
  base.driverName = sanitizeDriverName(tripContext.driverName);
  base.plateNumber = tripContext.truckPlate || null;

  if (tripData.hasActiveDelay) {
    base.isDelayed = true;
    base.delayReason = tripData.lastDelayReason || "Operational Delay";
    base.currentLocation = `Delayed: ${base.delayReason}`;
  } else if (tripData.status === "IN_TRANSIT") {
    base.currentLocation = "On the Way";
  } else if (tripData.status === "ARRIVED" || tripData.status === "COMPLETED") {
    base.currentLocation = "Arrived at Hub";
  }

  return base;
}

function buildPublicPackages(packages = []) {
  return packages.map((pkg, index) => {
    const packageId = pkg.packageId || pkg.trackingNumber || "";
    const statusCode = String(pkg.status || "RECEIVED").trim().toUpperCase();

    return {
      packageId,
      trackingNumber: pkg.trackingNumber || packageId,
      description: pkg.description || "Item",
      packagingType: pkg.packagingType || "Package",
      quantity: Number(pkg.quantity) || 1,
      sequence: pkg.sequence || index + 1,
      status: formatStatus(pkg.status),
      statusCode,
      isFragile: Boolean(pkg.isFragile),
      isPerishable: Boolean(pkg.isPerishable),
    };
  });
}

async function syncOneShipmentToPublic(shipmentId, shipmentData) {
  const publicRef = db.collection("tracking_public").doc(shipmentId);

  if (
    !shipmentData ||
    shipmentData.isPubliclyVisible === false ||
    shipmentData.public === false
  ) {
    await publicRef.delete();
    return { action: "DELETED", id: shipmentId };
  }

  const [tripContext, history, deliveryContext] = await Promise.all([
    loadTripContextForShipment(shipmentData),
    buildPublicTrackingHistory(db, shipmentId, shipmentData),
    Promise.resolve(resolvePublicDeliveryContext(shipmentData)),
  ]);

  const totals = shipmentData.totals || {};
  const packageBreakdown =
    shipmentData.packageBreakdown &&
    typeof shipmentData.packageBreakdown === "object"
      ? shipmentData.packageBreakdown
      : computePackageBreakdown(
          Array.isArray(shipmentData.packages) ? shipmentData.packages : [],
        );
  const totalItems =
    totals.totalContentQty ||
    Number(packageBreakdown.total) ||
    totals.totalItems ||
    totals.totalPackages ||
    (Array.isArray(shipmentData.packages) ? shipmentData.packages.length : 0);
  const deliveredCount =
    Number(packageBreakdown.delivered) ||
    Number(totals.delivered) ||
    0;
  const pendingAtDivisoria = Math.max(
    Number(packageBreakdown.atDivisoria) || 0,
    0,
  );

  const statusCode = String(shipmentData.status || "RECEIVED").toUpperCase();
  const showLastMileContext = [
    "OUT_FOR_DELIVERY",
    "PARTIALLY_DELIVERED",
    "READY_FOR_DELIVERY",
    "DELIVERED",
  ].includes(statusCode);

  const publicDoc = {
    trackingNumber: shipmentId,
    status: formatStatus(shipmentData.status),
    statusCode,
    origin: shipmentData.originCity || shipmentData.origin || "Origin Hub",
    originCode: shipmentData.originCode || null,
    destination:
      shipmentData.destinationCity ||
      shipmentData.destination ||
      "Destination",
    destinationCode: shipmentData.destinationCode || null,
    customerName:
      shipmentData.sender?.name ||
      shipmentData.senderName ||
      "Valued Customer",
    totalPackages: totalItems,
    itemsDelivered: deliveredCount,
    totals: {
      totalItems,
      loaded: totals.loaded ?? 0,
      delivered: deliveredCount,
      pending: pendingAtDivisoria,
      inTransit: Number(packageBreakdown.inTransit) || 0,
      atOdiongan: Number(packageBreakdown.atOdiongan) || 0,
      releasedForDelivery: Number(packageBreakdown.releasedForDelivery) || 0,
      routeAssigned: Number(packageBreakdown.routeAssigned) || 0,
      outForDelivery: Number(packageBreakdown.outForDelivery) || 0,
      onCheckerVan: Number(packageBreakdown.onCheckerVan) || 0,
    },
    proofOfReceipt: shipmentData.proofOfReceipt || null,
    proofOfDelivery: shipmentData.proofOfDelivery || null,
    ...tripContext,
    assignedToChecker: showLastMileContext
      ? deliveryContext.assignedToChecker
      : false,
    deliveryVehicleName: showLastMileContext
      ? deliveryContext.deliveryVehicleName
      : null,
    history,
    packages: buildPublicPackages(
      Array.isArray(shipmentData.packages) ? shipmentData.packages : [],
    ),
    updatedAt: FieldValue.serverTimestamp(),
  };

  await publicRef.set(publicDoc);
  return { action: "SYNCED", id: shipmentId };
}

exports.syncOneShipmentToPublic = syncOneShipmentToPublic;

exports.mirrorShipmentToPublic = onDocumentWritten(
  {
    document: "shipments/{docId}",
    region: "asia-southeast1",
  },
  async (event) => {
    const shipmentId = event.params.docId;
    const shipmentData = event.data.after.exists
      ? event.data.after.data()
      : null;

    try {
      await syncOneShipmentToPublic(shipmentId, shipmentData);
      console.log(`Auto-sync success for ${shipmentId}`);
    } catch (error) {
      console.error(`Auto-sync failed for ${shipmentId}`, error);
    }
  },
);

exports.mirrorShipmentEventToPublic = onDocumentWritten(
  {
    document: "shipment_events/{eventId}",
    region: "asia-southeast1",
  },
  async (event) => {
    if (!event.data.after.exists) return;

    const eventData = event.data.after.data() || {};
    const shipmentId = normalizeString(eventData.shipmentId);
    if (!shipmentId) return;

    try {
      const shipmentSnap = await db.collection("shipments").doc(shipmentId).get();
      if (!shipmentSnap.exists) return;

      await syncOneShipmentToPublic(shipmentId, shipmentSnap.data());
      console.log(`Event-triggered public sync for ${shipmentId}`);
    } catch (error) {
      console.error(`Event-triggered public sync failed for ${shipmentId}`, error);
    }
  },
);

function normalizeString(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

exports.syncTrackingPublicHttp = onRequest(
  { region: "asia-southeast1", timeoutSeconds: 540 },
  async (req, res) => {
    const snap = await db.collection("shipments").get();
    const stats = { scanned: 0, synced: 0, deleted: 0, errors: 0 };

    await Promise.all(
      snap.docs.map(async (docSnap) => {
        stats.scanned++;
        try {
          const result = await syncOneShipmentToPublic(docSnap.id, docSnap.data());
          if (result.action === "DELETED") stats.deleted++;
          else stats.synced++;
        } catch (error) {
          console.error(`Error syncing ${docSnap.id}:`, error);
          stats.errors++;
        }
      }),
    );

    res.json({ message: "Bulk Sync Complete", stats });
  },
);

exports.propagateTripUpdates = onDocumentWritten(
  {
    document: "truck_trips/{tripId}",
    region: "asia-southeast1",
  },
  async (event) => {
    if (!event.data.after.exists) return;

    const newData = event.data.after.data();
    const oldData = event.data.before.exists ? event.data.before.data() : {};
    const tripId = event.params.tripId;

    const statusChanged = newData.status !== oldData.status;
    const delayChanged = newData.hasActiveDelay !== oldData.hasActiveDelay;

    if (!statusChanged && !delayChanged) return;

    console.log(`Trip ${tripId} updated. Propagating to public shipments...`);

    let tripContext = {
      currentLocation: "On the Way",
      isDelayed: false,
      delayReason: null,
    };

    if (newData.hasActiveDelay) {
      tripContext.isDelayed = true;
      tripContext.delayReason = newData.lastDelayReason || "Operational Delay";
      tripContext.currentLocation = `Delayed: ${tripContext.delayReason}`;
    } else if (newData.status === "COMPLETED" || newData.status === "ARRIVED") {
      tripContext.currentLocation = "Arrived at Hub";
    }

    const querySnap = await db
      .collection("tracking_public")
      .where("tripId", "==", tripId)
      .get();

    if (querySnap.empty) {
      // Multi-trip shipments have currentTripId=null, so also match the array.
      const [byTripIdSnap, byTripIdsArraySnap] = await Promise.all([
        db
          .collection("shipments")
          .where("currentTripId", "==", tripId)
          .limit(25)
          .get(),
        db
          .collection("shipments")
          .where("currentTripIds", "array-contains", tripId)
          .limit(25)
          .get()
          .catch(() => ({ docs: [] })),
      ]);

      const shipmentDocMap = new Map();
      [...byTripIdSnap.docs, ...byTripIdsArraySnap.docs].forEach((docSnap) => {
        shipmentDocMap.set(docSnap.id, docSnap);
      });

      await Promise.all(
        [...shipmentDocMap.values()].map((docSnap) =>
          syncOneShipmentToPublic(docSnap.id, docSnap.data()).catch((error) => {
            console.error(`Trip propagate sync failed for ${docSnap.id}:`, error);
          }),
        ),
      );
      return;
    }

    const batch = db.batch();
    querySnap.docs.forEach((docSnap) => {
      batch.update(docSnap.ref, {
        ...tripContext,
        updatedAt: FieldValue.serverTimestamp(),
      });
    });

    await batch.commit();
    console.log(`Updated ${querySnap.size} public records for Trip ${tripId}`);
  },
);
