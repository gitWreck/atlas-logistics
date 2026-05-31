"use strict";

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const { FieldValue } = require("firebase-admin/firestore");
const { requireRole } = require("../utilities/helpers");
const { writeShipmentEvent } = require("../tracking/writeShipmentEvent");
const { EVENT_TYPES } = require("../tracking/eventTypes");
const { resolveShipmentIds } = require("./checkerShipmentResolve");

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

const RETURN_ALLOWED_STATUSES = new Set([
  "FAILED_DELIVERY",
  "OUT_FOR_DELIVERY",
  "READY_FOR_DELIVERY",
]);

function normalizeString(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function isManagerRole(role) {
  return ["admin", "manager"].includes(String(role || "").toLowerCase());
}

exports.returnPackagesToWarehouse = onCall(
  { region: "asia-southeast1", maxInstances: 10 },
  async (req) => {
    const {
      uid: actorUid,
      role: actorRole,
      user: actorUser,
    } = await requireRole(db, req, ["checker", "manager", "admin"]);
    const actorName =
      actorUser?.fullName ||
      actorUser?.name ||
      actorUser?.displayName ||
      null;

    const {
      shipmentIds,
      packageIds,
      warehouseCode = "ODIONGAN_WAREHOUSE",
      remarks = null,
      location = null,
      gpsCoordinates = null,
    } = req.data || {};

    const resolvedShipmentIds = await resolveShipmentIds(db, {
      shipmentIds,
      packageIds,
    });

    const normalizedWarehouse = normalizeString(warehouseCode) || "ODIONGAN_WAREHOUSE";
    const now = FieldValue.serverTimestamp();
    const returnedShipmentIds = [];
    const returnedByManifest = new Map();

    await db.runTransaction(async (tx) => {
      const shipmentRefs = resolvedShipmentIds.map((id) =>
        db.collection("shipments").doc(id),
      );
      const shipmentSnaps = await Promise.all(
        shipmentRefs.map((ref) => tx.get(ref)),
      );

      shipmentSnaps.forEach((snap, index) => {
        const shipmentId = resolvedShipmentIds[index];
        if (!snap.exists) {
          throw new HttpsError("not-found", `Shipment not found: ${shipmentId}`);
        }

        const data = snap.data() || {};
        const status = String(data.status || "").toUpperCase();

        if (status === "DELIVERED" || status === "COMPLETED") {
          throw new HttpsError(
            "failed-precondition",
            `Shipment ${shipmentId} is already delivered.`,
          );
        }
        if (!RETURN_ALLOWED_STATUSES.has(status)) {
          throw new HttpsError(
            "failed-precondition",
            `Shipment ${shipmentId} cannot be returned from status ${status}. Mark failed delivery first if needed.`,
          );
        }

        if (!isManagerRole(actorRole)) {
          const {
            assertCheckerCanAccessShipment,
          } = require("../warehouse/packageDeliveryOperations");
          assertCheckerCanAccessShipment(shipmentId, data, actorUid);
        }

        const manifestId = normalizeString(data.deliveryManifestId);
        if (manifestId) {
          const existing = returnedByManifest.get(manifestId) || [];
          existing.push(shipmentId);
          returnedByManifest.set(manifestId, existing);
        }

        const returnNote =
          normalizeString(remarks) ||
          "Returned to Odiongan warehouse by checker.";

        tx.update(shipmentRefs[index], {
          status: "RETURNED_TO_WAREHOUSE",
          custodyOwnerType: "WAREHOUSE",
          custodyOwnerId: normalizedWarehouse,
          currentLocationState: "ODIONGAN_WAREHOUSE",
          assignedCheckerId: null,
          assignedCheckerName: null,
          deliveryManifestId: null,
          deliveryVehicleId: null,
          deliveryVehicleName: null,
          lastAssignedCheckerId:
            normalizeString(data.assignedCheckerId) ||
            data.lastAssignedCheckerId ||
            null,
          lastAssignedCheckerName:
            normalizeString(data.assignedCheckerName) ||
            data.lastAssignedCheckerName ||
            null,
          returnedAt: now,
          returnedByUid: actorUid,
          returnedByName: actorName,
          returnWarehouseCode: normalizedWarehouse,
          returnReceivedAt: null,
          returnReceivedBy: null,
          returnReceivedByUid: null,
          updatedAt: now,
          updatedBy: actorName || actorUid || null,
          statusHistory: FieldValue.arrayUnion({
            status: "RETURNED_TO_WAREHOUSE",
            at: admin.firestore.Timestamp.now(),
            by: actorName || actorUid || null,
            note: returnNote,
            location: normalizeString(location) || normalizedWarehouse,
          }),
        });

        returnedShipmentIds.push(shipmentId);
      });

      for (const [manifestId, ids] of returnedByManifest.entries()) {
        const manifestRef = db.collection("delivery_manifests").doc(manifestId);
        tx.set(
          manifestRef,
          {
            returnedShipmentIds: FieldValue.arrayUnion(...ids),
            updatedAt: now,
            updatedBy: actorName || actorUid || null,
          },
          { merge: true },
        );
      }
    });

    await Promise.all(
      returnedShipmentIds.map((shipmentId) =>
        writeShipmentEvent({
          db,
          event: {
            shipmentId,
            eventType: EVENT_TYPES.RETURNED_TO_WAREHOUSE,
            checkerId: isManagerRole(actorRole) ? null : actorUid,
            checkerName: isManagerRole(actorRole) ? null : actorName,
            warehouseManagerId: isManagerRole(actorRole) ? actorUid : null,
            warehouseManagerName: isManagerRole(actorRole) ? actorName : null,
            location: normalizeString(location) || normalizedWarehouse,
            gpsCoordinates: gpsCoordinates || null,
            createdBy: actorUid,
            createdByRole: actorRole,
            remarks: normalizeString(remarks),
            source: isManagerRole(actorRole)
              ? "MANAGER_WAREHOUSE_RETURN"
              : "CHECKER_WAREHOUSE_RETURN",
          },
        }),
      ),
    );

    return {
      success: true,
      warehouseCode: normalizedWarehouse,
      shipmentIds: returnedShipmentIds,
      shipmentCount: returnedShipmentIds.length,
    };
  },
);
