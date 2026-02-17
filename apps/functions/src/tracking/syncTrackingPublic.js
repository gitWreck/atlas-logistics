"use strict";

const { onDocumentWritten } = require("firebase-functions/v2/firestore");
const { onRequest } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const { FieldValue } = require("firebase-admin/firestore");
const {
  formatStatus,
  sanitizeDriverName,
  formatTimeline,
} = require("../utilities/helpers");

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

/* ===================================================================
   CORE LOGIC (Shared by Trigger & HTTP)
=================================================================== */

async function syncOneShipmentToPublic(shipmentId, shipmentData) {
  const publicRef = db.collection("tracking_public").doc(shipmentId);

  // 1. CHECK "KILL SWITCH" & DELETION
  // If shipment was deleted OR admin marked it as hidden
  if (!shipmentData || shipmentData.isPubliclyVisible === false) {
    await publicRef.delete();
    return { action: "DELETED", id: shipmentId };
  }

  // 2. FETCH TRIP CONTEXT (If assigned)
  // We need this for Delays and Driver Name
  let tripContext = {
    tripId: null,
    driverName: null,
    plateNumber: null,
    isDelayed: false,
    delayReason: null,
    currentLocation: "Processing",
  };

  if (shipmentData.currentTruckTripId) {
    const tripSnap = await db
      .collection("truck_trips")
      .doc(shipmentData.currentTruckTripId)
      .get();

    if (tripSnap.exists) {
      const t = tripSnap.data();

      tripContext.tripId = t.tripId;
      tripContext.driverName = sanitizeDriverName(t.driverName); // Privacy enforced here
      tripContext.plateNumber = t.plateNumber;

      // Delay Logic
      if (t.hasActiveDelay) {
        tripContext.isDelayed = true;
        tripContext.delayReason = t.lastDelayReason || "Operational Delay";
        tripContext.currentLocation = `Delayed: ${tripContext.delayReason}`;
      } else if (t.status === "IN_TRANSIT") {
        tripContext.currentLocation = "On the Way";
      }
    }
  }

  // 3. CONSTRUCT PUBLIC OBJECT
  // Only copy safe fields. Never copy costs or internal phone numbers.
  const publicDoc = {
    trackingNumber: shipmentId,

    // Core Status
    status: formatStatus(shipmentData.status),
    statusCode: shipmentData.status, // Keep raw code for frontend icons
    origin: shipmentData.originCity || shipmentData.origin || "Origin Hub",
    originCode: shipmentData.originCode,
    destination:
      shipmentData.destinationCity || shipmentData.destination || "Destination",
    destinationCode: shipmentData.destinationCode,

    // Customer Info (Only Name, masked if needed)
    customerName: shipmentData.senderName || "Valued Customer",

    // Progress Data (From Shipment Totals)
    totalPackages: shipmentData.totals?.totalPackages || 0,
    itemsDelivered: shipmentData.totals?.delivered || 0,
    proofOfReceipt: shipmentData.proofOfReceipt,
    proofOfDelivery: shipmentData.proofOfDelivery,

    // Trip Context (Merged from above)
    ...tripContext,

    // Timeline History
    history: formatTimeline(shipmentData.statusHistory),

    updatedAt: FieldValue.serverTimestamp(),
  };

  // 4. WRITE TO PUBLIC COLLECTION
  await publicRef.set(publicDoc);
  return { action: "SYNCED", id: shipmentId };
}

/* ===================================================================
   TRIGGER 1: AUTO-SYNC (Firestore Trigger)
   Runs automatically whenever a Shipment is Created, Updated, or Deleted
=================================================================== */
exports.mirrorShipmentToPublic = onDocumentWritten(
  {
    document: "shipments/{docId}",
    region: "asia-southeast1",
  },
  async (event) => {
    const shipmentId = event.params.docId;

    // Handle Deletion (Data is null)
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

/* ===================================================================
   TRIGGER 2: BULK SYNC (HTTP Endpoint)
   Run this ONCE to migrate existing data or force a refresh
=================================================================== */
exports.syncTrackingPublicHttp = onRequest(
  { region: "asia-southeast1", timeoutSeconds: 540 },
  async (req, res) => {
    // Security: Only allow POST or Admin Check (Optional)

    const snap = await db.collection("shipments").get();
    let stats = { scanned: 0, synced: 0, deleted: 0, errors: 0 };

    const promises = snap.docs.map(async (doc) => {
      stats.scanned++;
      try {
        const result = await syncOneShipmentToPublic(doc.id, doc.data());
        if (result.action === "DELETED") stats.deleted++;
        else stats.synced++;
      } catch (e) {
        console.error(`Error syncing ${doc.id}:`, e);
        stats.errors++;
      }
    });

    await Promise.all(promises);
    res.json({ message: "Bulk Sync Complete", stats });
  },
);

/* ===================================================================
   TRIGGER 3: PROPAGATE TRIP UPDATES (The Missing Link)
   When a Trip changes status (e.g. DELAYED or ARRIVED), 
   update all associated public tracking records.
=================================================================== */
exports.propagateTripUpdates = onDocumentWritten(
  {
    document: "truck_trips/{tripId}",
    region: "asia-southeast1",
  },
  async (event) => {
    // If trip was deleted, we might not need to do anything or just ignore
    if (!event.data.after.exists) return;

    const newData = event.data.after.data();
    const oldData = event.data.before.data();
    const tripId = event.params.tripId;

    // OPTIMIZATION: Only run if status or delay info changed
    const statusChanged = newData.status !== oldData.status;
    const delayChanged = newData.hasActiveDelay !== oldData.hasActiveDelay;

    if (!statusChanged && !delayChanged) return;

    console.log(`Trip ${tripId} updated. Propagating to public shipments...`);

    // 1. Prepare the Context Update
    let tripContext = {
      currentLocation: "On the Way",
      isDelayed: false,
      delayReason: null,
    };

    if (newData.hasActiveDelay) {
      tripContext.isDelayed = true;
      tripContext.delayReason = newData.lastDelayReason || "Operational Delay";
      tripContext.currentLocation = `Delayed: ${tripContext.delayReason}`;
    } else if (newData.status === "COMPLETED") {
      tripContext.currentLocation = "Arrived at Hub";
    }

    // 2. Find all Public Docs assigned to this Trip
    // Note: We query 'tracking_public' directly because it's faster
    const querySnap = await db
      .collection("tracking_public")
      .where("tripId", "==", tripId)
      .get();

    // 3. Batch Update
    const batch = db.batch();

    querySnap.docs.forEach((doc) => {
      batch.update(doc.ref, {
        ...tripContext,
        lastUpdated: FieldValue.serverTimestamp(),
      });
    });

    await batch.commit();
    console.log(`Updated ${querySnap.size} public records for Trip ${tripId}`);
  },
);
