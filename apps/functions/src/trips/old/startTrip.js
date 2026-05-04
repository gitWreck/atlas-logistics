const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const { FieldValue } = require("firebase-admin/firestore");

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

exports.startTrip = onCall({ region: "asia-southeast1" }, async (req) => {
  // 1. AUTH CHECK
  if (!req.auth) {
    throw new HttpsError("unauthenticated", "User must be logged in.");
  }
  const uid = req.auth.uid;

  const { tripId, location } = req.data || {};
  if (!tripId) throw new HttpsError("invalid-argument", "Missing tripId");

  // 2. GET TRIP
  const tripRef = db.collection("truck_trips").doc(tripId);
  const tripSnap = await tripRef.get();

  if (!tripSnap.exists) throw new HttpsError("not-found", "Trip not found");
  const trip = tripSnap.data();

  // 3. VALIDATION
  if (trip.status !== "LOADED") {
    throw new HttpsError(
      "failed-precondition",
      "Trip must be LOADED to start.",
    );
  }

  // 4. BATCH UPDATE
  const batch = db.batch();

  // A. Update Trip Status
  batch.update(tripRef, {
    status: "IN_TRANSIT",
    startedAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    startedBy: uid, // Track who started it on the document itself
  });

  // B. Find all Shipments in this trip
  const shipQuery = await tripRef.collection("trip_shipments").get();
  const shipmentCount = shipQuery.size; // Capture count for the log

  shipQuery.docs.forEach((doc) => {
    const realShipmentRef = db.collection("shipments").doc(doc.id);
    // 1. Update the link record (trip_shipments)
    batch.update(doc.ref, {
      // status: "OUT_FOR_DELIVERY",
      status: "IN_TRANSIT", // We keep the trip_ship
      updatedAt: FieldValue.serverTimestamp(),
    });

    // 2. Update the REAL shipment record (shipments)
    // const realShipmentRef = db.collection("shipments").doc(doc.id);

    const historyEntry = {
      // status: "OUT_FOR_DELIVERY",
      status: "IN_TRANSIT",
      at: admin.firestore.Timestamp.now(),
      note: `Trip ${trip.tripId || tripId} Started`,
      by: uid,
      location: location || null, // { lat, lng }
    };

    const shipmentUpdate = {
      // status: "OUT_FOR_DELIVERY",
      status: "IN_TRANSIT",
      updatedAt: FieldValue.serverTimestamp(),
      // 3. Add to History Timeline
      statusHistory: FieldValue.arrayUnion(historyEntry),
    };

    // Persist latest known location for this shipment if provided
    if (location) {
      shipmentUpdate.lastLocation = location;
    }

    batch.update(realShipmentRef, shipmentUpdate);
  });

  // C. AUDIT LOG (The New Part)
  // We add this to the same batch so it's guaranteed to be written if the updates succeed
  const auditRef = db.collection("audit_logs").doc();
  batch.set(auditRef, {
    action: "START_TRIP",
    targetCollection: "truck_trips",
    targetId: tripId,
    actorId: uid,
    details: {
      tripNumber: trip.tripId || tripId,
      plateNumber: trip.plateNumber || "N/A",
      packagesUpdated: shipmentCount, // Very useful to know how many items were affected
      previousStatus: trip.status,
    },
    timestamp: FieldValue.serverTimestamp(),
  });

  await batch.commit();

  return {
    success: true,
    message: `Trip started. ${shipmentCount} packages marked Out for Delivery.`,
  };
});
