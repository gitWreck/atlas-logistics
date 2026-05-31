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

const FAIL_ALLOWED_STATUSES = new Set([
  "ASSIGNED",
  "READY_FOR_DELIVERY",
  "OUT_FOR_DELIVERY",
]);

function normalizeString(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

const {
  assertCheckerCanAccessShipment,
} = require("../warehouse/packageDeliveryOperations");

exports.reportFailedDelivery = onCall(
  { region: "asia-southeast1", maxInstances: 10 },
  async (req) => {
    const {
      uid: actorUid,
      role: actorRole,
      user: actorUser,
    } = await requireRole(db, req, ["checker"]);
    const actorName =
      actorUser?.fullName ||
      actorUser?.name ||
      actorUser?.displayName ||
      null;

    const {
      shipmentIds,
      packageIds,
      reasonCode = null,
      remarks = null,
      location = null,
      gpsCoordinates = null,
    } = req.data || {};

    const resolvedShipmentIds = await resolveShipmentIds(db, {
      shipmentIds,
      packageIds,
    });

    const now = FieldValue.serverTimestamp();
    const failedShipmentIds = [];
    const failedEventMeta = [];

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
        if (!FAIL_ALLOWED_STATUSES.has(status)) {
          throw new HttpsError(
            "failed-precondition",
            `Shipment ${shipmentId} cannot be marked failed from status ${status}.`,
          );
        }

        assertCheckerCanAccessShipment(shipmentId, data, actorUid);

        const failureNote =
          normalizeString(remarks) ||
          (reasonCode
            ? `Failed delivery (${reasonCode})`
            : "Failed delivery attempt.");

        tx.update(shipmentRefs[index], {
          status: "FAILED_DELIVERY",
          custodyOwnerType: "CHECKER",
          custodyOwnerId: actorUid,
          currentLocationState: "FAILED_DELIVERY_WITH_CHECKER",
          failedAt: now,
          failedByUid: actorUid,
          failedByName: actorName,
          failureReasonCode: normalizeString(reasonCode),
          failureRemarks: failureNote,
          updatedAt: now,
          updatedBy: actorName || actorUid || null,
          statusHistory: FieldValue.arrayUnion({
            status: "FAILED_DELIVERY",
            at: admin.firestore.Timestamp.now(),
            by: actorName || actorUid || null,
            note: failureNote,
            location: normalizeString(location),
          }),
        });

        failedShipmentIds.push(shipmentId);
        failedEventMeta.push({
          shipmentId,
          manifestId: normalizeString(data.deliveryManifestId),
          deliveryVehicleId: normalizeString(data.deliveryVehicleId),
          deliveryVehicleName: normalizeString(data.deliveryVehicleName),
        });
      });
    });

    await Promise.all(
      failedEventMeta.map((meta) =>
        writeShipmentEvent({
          db,
          event: {
            shipmentId: meta.shipmentId,
            eventType: EVENT_TYPES.FAILED_DELIVERY,
            checkerId: actorUid,
            checkerName: actorName,
            manifestId: meta.manifestId,
            deliveryVehicleId: meta.deliveryVehicleId,
            deliveryVehicleName: meta.deliveryVehicleName,
            location: normalizeString(location),
            gpsCoordinates: gpsCoordinates || null,
            createdBy: actorUid,
            createdByRole: actorRole || "checker",
            remarks: normalizeString(remarks) || normalizeString(reasonCode),
            source: "CHECKER_FAILED_DELIVERY",
          },
        }),
      ),
    );

    return {
      success: true,
      shipmentIds: failedShipmentIds,
      shipmentCount: failedShipmentIds.length,
    };
  },
);
