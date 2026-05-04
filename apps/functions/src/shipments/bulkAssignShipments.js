const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const { requireRole } = require("../utilities/helpers"); // Assuming this exists as per your code
const { writeShipmentActionLog } = require("../utilities/shipmentLogger");

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

exports.bulkAssignShipments = onCall(
  { region: "asia-southeast1", maxInstances: 10 },
  async (req) => {
    // 1. Auth & Role Guard
    await requireRole(db, req, ["admin", "manager"]);
    const uid = req.auth.uid;

    // Fetch user details for role logging (matching your canonical code)
    const userSnap = await db.collection("users").doc(uid).get();
    const userRole = userSnap.exists ? userSnap.data().role : "unknown";

    const { tripId, shipmentIds } = req.data;

    // 2. Input Validation
    if (!tripId) throw new HttpsError("invalid-argument", "Missing Trip ID");
    if (!Array.isArray(shipmentIds) || shipmentIds.length === 0) {
      throw new HttpsError("invalid-argument", "No shipments selected");
    }

    const tripRef = db.collection("truck_trips").doc(tripId);

    // 3. Fetch Trip Data & Validate Status
    const tripSnap = await tripRef.get();
    if (!tripSnap.exists) throw new HttpsError("not-found", "Trip not found");
    const tripData = tripSnap.data();

    // 🔒 Hard stop checks (Matching canonical)
    if (tripData.active === false || tripData.status === "COMPLETED") {
      throw new HttpsError(
        "failed-precondition",
        "Cannot assign to completed/inactive trip.",
      );
    }
    if (tripData.manifestLocked === true) {
      throw new HttpsError(
        "failed-precondition",
        "Trip Manifest is LOCKED. Unlock it first.",
      );
    }

    // 4. Process in Chunks (Firestore limit is 500 ops per batch)
    const chunkSize = 100; // Conservative limit to allow for multiple writes per shipment
    const errors = [];
    let successCount = 0;

    for (let i = 0; i < shipmentIds.length; i += chunkSize) {
      const chunk = shipmentIds.slice(i, i + chunkSize);
      const batch = db.batch();

      // Track aggregates for this specific batch
      let batchTotalItems = 0;
      let batchHasUpdates = false;

      // Fetch all shipments in this chunk in parallel
      const snapshots = await Promise.all(
        chunk.map((id) => db.collection("shipments").doc(id).get()),
      );

      snapshots.forEach((snap) => {
        if (!snap.exists) {
          errors.push(`Shipment ${snap.id} not found`);
          return;
        }

        const data = snap.data();
        const ref = snap.ref;

        // 🔁 Idempotency: Skip if already on this trip
        if (data.currentTripId === tripId) {
          return;
        }

        // 🛑 Double Assignment Check
        if (data.currentTripId && data.currentTripId !== tripId) {
          errors.push(
            `Shipment ${data.shipmentId} is on another trip (${data.currentTripId})`,
          );
          return;
        }

        const itemsToAdd = Number(
          data.totals?.totalContentQty || data.totals?.totalItems || 0,
        );
        batchTotalItems += itemsToAdd;
        batchHasUpdates = true;
        successCount++;

        const now = admin.firestore.FieldValue.serverTimestamp();
        const timestampNow = admin.firestore.Timestamp.now();

        // --- A. Create Trip Subcollection Doc (trip_shipments) ---
        // Matches structure of 'shipRef' in your code
        const manifestRef = tripRef.collection("trip_shipments").doc(snap.id);

        batch.set(manifestRef, {
          trackingShipmentId: snap.id,
          shipmentId: data.shipmentId || null,

          // Replicate route string logic
          route:
            (data.originCode || "?") + " -> " + (data.destinationCode || "?"),

          totalItems: itemsToAdd,
          pendingCount: itemsToAdd, // Initially all pending
          loadedCount: 0,
          deliveredCount: 0,

          sender: data.sender,
          recipient: data.recipient,

          // Copy barcodes for the Checker API (Important for scanning!)
          packageBarcodes: data.packageBarcodes || [],

          createdAt: now,
          createdBy: uid,

          updatedAt: now,
          updatedBy: uid,
          updatedRole: userRole,

          status: "ASSIGNED",
        });

        // --- B. Update Shipment Root ---
        // Matches 'trackingRef' update
        batch.update(ref, {
          currentTripId: tripId,
          assignedToTripAt: now,
          status: "ASSIGNED",

          updatedAt: now,
          updatedBy: uid,
          updatedRole: userRole,

          // Append to History
          statusHistory: admin.firestore.FieldValue.arrayUnion({
            status: "ASSIGNED",
            at: timestampNow,
            note: `Assigned to trip ${tripId}`,
          }),
        });

        // --- C. Add Status Event (Timeline) ---
        const eventRef = ref.collection("status_events").doc();
        batch.set(eventRef, {
          type: "ASSIGN_TO_TRIP",
          message: "Assigned to trip",
          tripId: tripId,
          createdAt: now,
          createdBy: uid,
        });

        // --- D. Admin Audit Log ---
        writeShipmentActionLog({
          db,
          batch,
          action: "ASSIGN_SHIPMENT_TO_TRIP",
          trackingShipmentId: snap.id,
          tripId: tripId,
          actorId: uid,
          actorRole: userRole,
          createdAt: now,
        });
      });

      // --- E. Update Trip Aggregates (Once per batch) ---
      if (batchHasUpdates) {
        batch.update(tripRef, {
          totalItems: admin.firestore.FieldValue.increment(batchTotalItems),
          itemPending: admin.firestore.FieldValue.increment(batchTotalItems),

          // totalLoaded: 0,
          // totalDelivered: 0,

          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedBy: uid,
        });

        await batch.commit();
      }
    }

    return {
      success: true,
      assigned: successCount,
      errors,
    };
  },
);
