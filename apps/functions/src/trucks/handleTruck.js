const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");

/**
 * UPSERT TRUCK with TRANSACTIONAL LOGGING
 * Handles both Register (New) and Update (Existing)
 */
exports.upsertTruck = onCall(
  { region: "asia-southeast1", maxInstances: 10 },
  async (request) => {
    // 1. Auth & Role Check
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "You must be logged in.");
    }

    const { id, ...data } = request.data;
    const db = admin.firestore();
    const plate = data.plateNumber.toUpperCase().trim();

    // References
    const truckRef = id
      ? db.collection("trucks").doc(id)
      : db.collection("trucks").doc();
    const logRef = db.collection("admin_logs").doc();

    try {
      await db.runTransaction(async (transaction) => {
        // 2. Duplicate Plate Check (Only if registering a new truck)
        if (!id) {
          const duplicateCheck = await db
            .collection("trucks")
            .where("plateNumber", "==", plate)
            .limit(1)
            .get();

          if (!duplicateCheck.empty) {
            throw new Error("PLATE_EXISTS");
          }
        }

        const timestamp = admin.firestore.FieldValue.serverTimestamp();

        // 3. Prepare Truck Data
        const truckPayload = {
          plateNumber: plate,
          model: data.model,
          type: data.type,
          payloadCapacity: Number(data.payload),
          registrationExpiry: data.registrationExpiry,
          lastPmsOdometer: Number(data.lastPmsOdometer),
          updatedAt: timestamp,
          updatedBy: request.auth.uid,
        };

        if (!id) {
          truckPayload.createdAt = timestamp;
          truckPayload.status = "IDLE"; // Initial state for new assets
          transaction.set(truckRef, truckPayload);
        } else {
          transaction.update(truckRef, truckPayload);
        }

        // 4. Write to admin_logs (Matching your exact template)
        transaction.set(logRef, {
          action: id ? "UPDATE_TRUCK" : "REGISTER_TRUCK",
          truckDocId: truckRef.id,
          actorUid: request.auth.uid,
          actorRole: request.auth.token.role || "admin",
          createdAt: timestamp,
          meta: {
            plateNumber: plate,
            model: data.model,
            type: data.type,
            payload: Number(data.payload),
            registrationExpiry: data.registrationExpiry,
            odometerAtLog: Number(data.lastPmsOdometer),
          },
        });
      });

      return { success: true, id: truckRef.id };
    } catch (error) {
      console.error("UPSERT_TRUCK_ERROR:", error);
      if (error.message === "PLATE_EXISTS") {
        throw new HttpsError(
          "already-exists",
          "A truck with this plate number is already registered.",
        );
      }
      throw new HttpsError("internal", error.message);
    }
  },
);

/**
 * TOGGLE TRUCK STATUS with LOGGING
 */
exports.updateTruckStatus = onCall(
  { region: "asia-southeast1", maxInstances: 10 },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Unauthorized.");

    const { truckId, status, plateNumber } = request.data;
    const db = admin.firestore();
    const truckRef = db.collection("trucks").doc(truckId);
    const logRef = db.collection("admin_logs").doc();

    try {
      await db.runTransaction(async (transaction) => {
        const truckSnap = await transaction.get(truckRef);
        if (!truckSnap.exists) throw new Error("NOT_FOUND");

        const oldStatus = truckSnap.data().status;

        transaction.update(truckRef, {
          status: status,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        transaction.set(logRef, {
          action: "UPDATE_TRUCK_STATUS",
          truckDocId: truckId,
          actorUid: request.auth.uid,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          meta: {
            plateNumber: plateNumber || truckSnap.data().plateNumber,
            previousStatus: oldStatus,
            newStatus: status,
          },
        });
      });

      return { success: true };
    } catch (error) {
      console.error("STATUS_UPDATE_ERROR:", error);
      throw new HttpsError("internal", error.message);
    }
  },
);
