const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const { ALLOWED_TRUCK_STATUSES } = require("../utilities/dataDetails");
const {
  normalizePlateNumber,
  requireNonEmptyString,
  parseRequiredNumber,
  parseOptionalNumber,
  parseOptionalDateString,
} = require("../utilities/helpers");

const REGION = "asia-southeast1";
const ALLOWED_ROLES = new Set(["admin", "manager"]);

function requireAuth(request) {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "You must be logged in.");
  }

  const role = String(request.auth.token.role || "").toLowerCase();
  if (!ALLOWED_ROLES.has(role)) {
    throw new HttpsError(
      "permission-denied",
      "You are not allowed to do this.",
    );
  }

  return {
    uid: request.auth.uid,
    role,
  };
}

exports.upsertTruck = onCall(
  { region: REGION, maxInstances: 10 },
  async (request) => {
    const { uid, role } = requireAuth(request);
    const db = admin.firestore();

    const { id, ...data } = request.data || {};

    const plateNumber = normalizePlateNumber(data.plateNumber);
    if (!plateNumber) {
      throw new HttpsError("invalid-argument", "Plate number is required.");
    }

    const model = requireNonEmptyString(data.model, "Model");
    const type = requireNonEmptyString(data.type, "Type");
    const payloadCapacity = parseRequiredNumber(data.payload, "Payload");
    const lastPmsOdometer = parseRequiredNumber(
      data.lastPmsOdometer,
      "Current odometer",
    );

    const registrationExpiry = parseOptionalDateString(
      data.registrationExpiry,
      "Registration expiry",
    );

    const lastOilChange = parseOptionalNumber(data.lastOilChange);
    const lastTireChange = parseOptionalNumber(data.lastTireChange);

    const truckRef = id
      ? db.collection("trucks").doc(String(id))
      : db.collection("trucks").doc();

    const logRef = db.collection("admin_logs").doc();

    try {
      await db.runTransaction(async (transaction) => {
        let existingTruckSnap = null;

        if (id) {
          existingTruckSnap = await transaction.get(truckRef);
          if (!existingTruckSnap.exists) {
            throw new Error("NOT_FOUND");
          }
        }

        const duplicateQuery = db
          .collection("trucks")
          .where("plateNumber", "==", plateNumber)
          .limit(5);

        const duplicateSnap = await transaction.get(duplicateQuery);

        const duplicateExists = duplicateSnap.docs.some(
          (doc) => doc.id !== truckRef.id,
        );
        if (duplicateExists) {
          throw new Error("PLATE_EXISTS");
        }

        const timestamp = admin.firestore.FieldValue.serverTimestamp();

        const truckPayload = {
          plateNumber,
          model,
          type,
          payloadCapacity,
          registrationExpiry,
          lastPmsOdometer,
          lastOilChange,
          lastTireChange,
          updatedAt: timestamp,
          updatedBy: uid,
        };

        if (!id) {
          truckPayload.createdAt = timestamp;
          truckPayload.createdBy = uid;
          truckPayload.status = "IDLE";
          transaction.set(truckRef, truckPayload);
        } else {
          transaction.update(truckRef, truckPayload);
        }

        transaction.set(logRef, {
          action: id ? "UPDATE_TRUCK" : "REGISTER_TRUCK",
          truckDocId: truckRef.id,
          actorUid: uid,
          actorRole: role,
          createdAt: timestamp,
          meta: {
            plateNumber,
            model,
            type,
            payloadCapacity,
            registrationExpiry,
            odometerAtLog: lastPmsOdometer,
            lastOilChangeAtLog: lastOilChange,
            lastTireChangeAtLog: lastTireChange,
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

      if (error.message === "NOT_FOUND") {
        throw new HttpsError("not-found", "Truck not found.");
      }

      if (error instanceof HttpsError) {
        throw error;
      }

      throw new HttpsError("internal", "Failed to save truck.");
    }
  },
);

exports.updateTruckStatus = onCall(
  { region: REGION, maxInstances: 10 },
  async (request) => {
    const { uid, role } = requireAuth(request);
    const db = admin.firestore();

    const { truckId, status, plateNumber } = request.data || {};

    if (!truckId || typeof truckId !== "string") {
      throw new HttpsError("invalid-argument", "truckId is required.");
    }

    if (!status || typeof status !== "string") {
      throw new HttpsError("invalid-argument", "status is required.");
    }

    const normalizedStatus = status.trim().toUpperCase();
    if (!ALLOWED_TRUCK_STATUSES.has(normalizedStatus)) {
      throw new HttpsError("invalid-argument", "Invalid truck status.");
    }

    const truckRef = db.collection("trucks").doc(truckId);
    const logRef = db.collection("admin_logs").doc();

    try {
      await db.runTransaction(async (transaction) => {
        const truckSnap = await transaction.get(truckRef);
        if (!truckSnap.exists) {
          throw new Error("NOT_FOUND");
        }

        const truckData = truckSnap.data() || {};
        const oldStatus = String(truckData.status || "").toUpperCase();

        if (oldStatus === normalizedStatus) {
          throw new Error("NO_CHANGE");
        }

        const timestamp = admin.firestore.FieldValue.serverTimestamp();

        transaction.update(truckRef, {
          status: normalizedStatus,
          updatedAt: timestamp,
          updatedBy: uid,
        });

        transaction.set(logRef, {
          action: "UPDATE_TRUCK_STATUS",
          truckDocId: truckId,
          actorUid: uid,
          actorRole: role,
          createdAt: timestamp,
          meta: {
            plateNumber:
              normalizePlateNumber(plateNumber) ||
              truckData.plateNumber ||
              null,
            previousStatus: oldStatus || null,
            newStatus: normalizedStatus,
          },
        });
      });

      return { success: true };
    } catch (error) {
      console.error("STATUS_UPDATE_ERROR:", error);

      if (error.message === "NOT_FOUND") {
        throw new HttpsError("not-found", "Truck not found.");
      }

      if (error.message === "NO_CHANGE") {
        throw new HttpsError(
          "failed-precondition",
          "Truck already has that status.",
        );
      }

      if (error instanceof HttpsError) {
        throw error;
      }

      throw new HttpsError("internal", "Failed to update truck status.");
    }
  },
);
