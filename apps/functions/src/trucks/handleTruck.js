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
const {
  canAccessRecord,
  getManagerScope,
} = require("../manager/managerAccess");

const REGION = "asia-southeast1";
const ALLOWED_ROLES = new Set(["admin", "manager"]);

function requireAuth(request) {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "You must be logged in.");
  }

  const role = String(request.auth.token.role || "").toLowerCase();
  // if (!ALLOWED_ROLES.has(role)) {
  //   throw new HttpsError(
  //     "permission-denied",
  //     "You are not allowed to do this.",
  //   );
  // }

  return {
    uid: request.auth.uid,
    role,
  };
}

async function loadAuthorizedActor(db, request) {
  const actor = requireAuth(request);
  const snap = await db.collection("users").doc(actor.uid).get();
  const profile = snap.exists ? { id: snap.id, ...snap.data() } : {};
  const role = String(profile.role || actor.role || "").toLowerCase();
  if (!ALLOWED_ROLES.has(role)) {
    throw new HttpsError("permission-denied", "Admin or Manager access required.");
  }
  return { ...actor, role, profile };
}

exports.upsertTruck = onCall(
  { region: REGION, maxInstances: 10 },
  async (request) => {
    const db = admin.firestore();
    const { uid, role, profile } = await loadAuthorizedActor(db, request);

    const { id, ...data } = request.data || {};

    const plateNumber = normalizePlateNumber(data.plateNumber);
    if (!plateNumber) {
      throw new HttpsError("invalid-argument", "Plate number is required.");
    }

    const model = requireNonEmptyString(data.model, "Model");
    const type = requireNonEmptyString(data.type, "Type");
    const payloadCapacity = parseRequiredNumber(
      data.payloadCapacity,
      "Payload",
    );

    const currentOdometer = parseRequiredNumber(
      data.currentOdometer,
      "Current odometer",
    );

    const lastPmsOdometer = parseRequiredNumber(
      data.lastPmsOdometer,
      "Last PMS odometer",
    );

    const registrationExpiry = parseOptionalDateString(
      data.registrationExpiry,
      "Registration expiry",
    );

    const lastOilChange = parseOptionalNumber(data.lastOilChange);
    const lastTireChange = parseOptionalNumber(data.lastTireChange);

    const incomingStatus = String(data.status || "")
      .trim()
      .toUpperCase();

    if (incomingStatus && !ALLOWED_TRUCK_STATUSES.has(incomingStatus)) {
      throw new HttpsError(
        "invalid-argument",
        `Invalid truck status: ${incomingStatus}`,
      );
    }

    if (lastPmsOdometer > currentOdometer) {
      throw new HttpsError(
        "invalid-argument",
        "Last PMS odometer cannot be greater than current odometer.",
      );
    }

    if (lastOilChange !== null && lastOilChange > currentOdometer) {
      throw new HttpsError(
        "invalid-argument",
        "Last oil change odometer cannot be greater than current odometer.",
      );
    }

    if (lastTireChange !== null && lastTireChange > currentOdometer) {
      throw new HttpsError(
        "invalid-argument",
        "Last tire change odometer cannot be greater than current odometer.",
      );
    }

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
          if (role === "manager" && !canAccessRecord(profile, existingTruckSnap.data())) {
            throw new Error("OUTSIDE_SCOPE");
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

        const basePayload = {
          plateNumber,
          model,
          type,
          payloadCapacity,
          registrationExpiry,
          currentOdometer,
          lastPmsOdometer,
          lastOilChange,
          lastTireChange,
          updatedAt: timestamp,
          updatedBy: uid,
        };
        if (role === "manager") {
          const managerScope = getManagerScope(profile);
          basePayload.warehouseCode =
            data.warehouseCode ||
            data.warehouseName ||
            managerScope.warehouses[0];
          basePayload.warehouseName =
            data.warehouseName ||
            profile.warehouseName ||
            profile.warehouseCode ||
            managerScope.warehouses[0];
        } else {
          basePayload.warehouseCode = data.warehouseCode || null;
          basePayload.warehouseName = data.warehouseName || null;
        }

        if (!id) {
          const createPayload = {
            ...basePayload,
            createdAt: timestamp,
            createdBy: uid,
            status: incomingStatus || "IDLE",
          };

          transaction.set(truckRef, createPayload);
        } else {
          const updatePayload = {
            ...basePayload,
          };

          if (incomingStatus) {
            updatePayload.status = incomingStatus;
          }

          transaction.update(truckRef, updatePayload);
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
            status: incomingStatus || (!id ? "IDLE" : null),
            payloadCapacity,
            registrationExpiry,
            currentOdometerAtLog: currentOdometer,
            lastPmsOdometerAtLog: lastPmsOdometer,
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
      if (error.message === "OUTSIDE_SCOPE") {
        throw new HttpsError(
          "permission-denied",
          "This truck is outside your assigned warehouse or municipality.",
        );
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
    const db = admin.firestore();
    const { uid, role, profile } = await loadAuthorizedActor(db, request);

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
        if (role === "manager" && !canAccessRecord(profile, truckData)) {
          throw new Error("OUTSIDE_SCOPE");
        }
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
      if (error.message === "OUTSIDE_SCOPE") {
        throw new HttpsError(
          "permission-denied",
          "This truck is outside your assigned warehouse or municipality.",
        );
      }

      if (error instanceof HttpsError) {
        throw error;
      }

      throw new HttpsError("internal", "Failed to update truck status.");
    }
  },
);
