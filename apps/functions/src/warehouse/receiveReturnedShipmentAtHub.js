"use strict";

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const { FieldValue } = require("firebase-admin/firestore");
const { requireRole, updatedBy } = require("../utilities/helpers");
const { writeShipmentEvent } = require("../tracking/writeShipmentEvent");
const { EVENT_TYPES } = require("../tracking/eventTypes");
const { resolveShipmentIds } = require("../checker/checkerShipmentResolve");
const {
  assertEligibleForReturnReceive,
} = require("./returnLoopEligibility");
const { mapPackagesForDeliveryRelease } = require("./packageDeliveryOperations");

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

function normalizeString(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

exports.receiveReturnedShipmentAtHub = onCall(
  { region: "asia-southeast1", maxInstances: 10 },
  async (req) => {
    await requireRole(db, req, ["admin", "manager"]);

    const { uid: actorUid, name: actorName, role: actorRole } = updatedBy(req);
    const {
      shipmentIds,
      packageIds,
      warehouseCode = "ODIONGAN_WAREHOUSE",
      remarks = null,
      location = null,
    } = req.data || {};

    const resolvedShipmentIds = await resolveShipmentIds(db, {
      shipmentIds,
      packageIds,
    });

    const normalizedWarehouse =
      normalizeString(warehouseCode) || "ODIONGAN_WAREHOUSE";
    const now = FieldValue.serverTimestamp();
    const receivedIds = [];

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
        assertEligibleForReturnReceive(shipmentId, data);

        const intakeNote =
          normalizeString(remarks) ||
          "Returned shipment received by warehouse manager at Odiongan.";

        const resetPackages = mapPackagesForDeliveryRelease(
          Array.isArray(data.packages) ? data.packages : [],
          normalizedWarehouse,
        );

        tx.update(shipmentRefs[index], {
          status: "RETURNED_RECEIVED_AT_HUB",
          packages: resetPackages.length ? resetPackages : data.packages || [],
          availableForDelivery: false,
          custodyOwnerType: "WAREHOUSE",
          custodyOwnerId: normalizedWarehouse,
          currentLocationState: normalizedWarehouse,
          assignedCheckerId: null,
          assignedCheckerName: null,
          activeCheckerIds: [],
          deliveryManifestId: null,
          returnReceivedAt: now,
          returnReceivedBy: actorName || actorUid || null,
          returnReceivedByUid: actorUid || null,
          returnReceiveWarehouseCode: normalizedWarehouse,
          updatedAt: now,
          updatedBy: actorName || actorUid || null,
          statusHistory: FieldValue.arrayUnion({
            status: "RECEIVED_RETURNED_SHIPMENT",
            at: admin.firestore.Timestamp.now(),
            by: actorName || actorUid || null,
            note: intakeNote,
            location: normalizeString(location) || normalizedWarehouse,
          }),
        });

        receivedIds.push(shipmentId);
      });
    });

    await Promise.all(
      receivedIds.map((shipmentId) =>
        writeShipmentEvent({
          db,
          event: {
            shipmentId,
            eventType: EVENT_TYPES.RECEIVED_RETURNED_SHIPMENT,
            warehouseManagerId: actorUid || null,
            warehouseManagerName: actorName || null,
            location: normalizeString(location) || normalizedWarehouse,
            remarks:
              normalizeString(remarks) ||
              "Received returned shipment at Odiongan.",
            createdBy: actorUid || null,
            createdByRole: actorRole || "manager",
            source: "receive_returned_at_hub",
          },
        }),
      ),
    );

    return {
      success: true,
      warehouseCode: normalizedWarehouse,
      shipmentIds: receivedIds,
      shipmentCount: receivedIds.length,
    };
  },
);
