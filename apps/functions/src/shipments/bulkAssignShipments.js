const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const { requireRole, updatedBy } = require("../utilities/helpers"); // Assuming this exists as per your code
const { writeShipmentActionLog } = require("../utilities/shipmentLogger");
const { buildDerivedShipmentSnapshot } = require("../packages/shipmentStatus");

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

exports.bulkAssignShipments = onCall(
  { region: "asia-southeast1", maxInstances: 10 },
  async (req) => {
    // 1. Auth & Role Guard
    await requireRole(db, req, ["admin", "manager"]);
    // const uid = req.auth.uid;

    // Fetch user details for role logging (matching your canonical code)
    const userSnap = await db.collection("users").doc(req.auth.uid).get();
    const userRole = userSnap.exists ? userSnap.data().role : "unknown";

    const { tripId, shipmentIds } = req.data;

    const { uid, role, name } = updatedBy(req);

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

          totalItems: 0,
          pendingCount: 0,
          loadedCount: 0,
          deliveredCount: 0,

          sender: data.sender,
          recipient: data.recipient,

          packageBarcodes: [],

          createdAt: now,
          createdBy: name,

          updatedAt: now,
          updatedBy: name,
          updatedRole: role,

          status: "ASSIGNED",
        });

        const packages = Array.isArray(data.packages) ? data.packages : [];
        const derivedSnapshot = buildDerivedShipmentSnapshot(packages, {
          previousStatus: data.status,
        });

        // --- B. Update Shipment Root (master status derived from packages) ---
        batch.update(ref, {
          currentTripId: tripId,
          assignedToTripAt: now,
          status: derivedSnapshot.status,
          packages: derivedSnapshot.packages,
          packageBreakdown: derivedSnapshot.packageBreakdown,
          availableForDelivery: derivedSnapshot.availableForDelivery,

          updatedAt: now,
          updatedBy: name,
          updatedRole: role,

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
          createdBy: name,
        });

        // --- D. Admin Audit Log ---
        writeShipmentActionLog({
          db,
          batch,
          action: "ASSIGN_SHIPMENT_TO_TRIP",
          trackingShipmentId: snap.id,
          tripId: tripId,
          actorId: uid,
          actorName: name,
          actorRole: role,
          createdAt: now,
        });
      });

      if (batchHasUpdates) {
        batch.update(tripRef, {
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedBy: name,
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
