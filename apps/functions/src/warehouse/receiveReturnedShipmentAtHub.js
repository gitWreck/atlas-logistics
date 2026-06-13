"use strict";

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const { FieldValue } = require("firebase-admin/firestore");
const { requireRole, updatedBy } = require("../utilities/helpers");
const { writeShipmentEvent } = require("../tracking/writeShipmentEvent");
const { EVENT_TYPES } = require("../tracking/eventTypes");
const { resolveShipmentIds } = require("../checker/checkerShipmentResolve");
const {
  normalizePackageIdSet,
  collectActiveCheckerIds,
} = require("../checker/checkerPieceOperations");
const { deriveMasterShipmentStatus } = require("../packages/shipmentStatus");
const {
  assertEligibleForReturnReceive,
  countPiecesAwaitingReturnReceive,
} = require("./returnLoopEligibility");
const {
  applyReturnedPiecesReceivedAtHub,
  countPiecesAwaitingReturnReceive: countPendingAfter,
  getPackageIdentity,
  pieceReceivedReturnedIntake,
  shipmentHasWarehouseCustodyPieces,
} = require("./packageDeliveryOperations");

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

function normalizeString(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function collectReceivedPieceIdentities(beforePackages = [], afterPackages = []) {
  const beforeById = new Map();
  beforePackages.forEach((pkg) => {
    const identity = getPackageIdentity(pkg);
    if (identity) beforeById.set(identity, pkg);
  });

  const identities = [];
  afterPackages.forEach((pkg) => {
    const identity = getPackageIdentity(pkg);
    if (!identity) return;
    const before = beforeById.get(identity);
    if (pieceReceivedReturnedIntake(before, pkg)) {
      identities.push(identity);
    }
  });
  return identities;
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

    const packageIdSet = normalizePackageIdSet(packageIds);
    const resolvedShipmentIds = await resolveShipmentIds(db, {
      shipmentIds,
      packageIds,
    });

    const normalizedWarehouse =
      normalizeString(warehouseCode) || "ODIONGAN_WAREHOUSE";
    const now = FieldValue.serverTimestamp();
    const receivedIds = [];
    const receivedEventMeta = [];

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

        const beforePackages = Array.isArray(data.packages) ? data.packages : [];
        const pendingBefore = countPiecesAwaitingReturnReceive(beforePackages);

        if (pendingBefore === 0) {
          throw new HttpsError(
            "failed-precondition",
            `Shipment ${shipmentId} has no pieces awaiting returned intake.`,
          );
        }

        const intakeNote =
          normalizeString(remarks) ||
          "Returned shipment received by warehouse manager at Odiongan.";

        const updatedPackages = applyReturnedPiecesReceivedAtHub(
          beforePackages,
          {
            warehouseCode: normalizedWarehouse,
            actorName,
            actorUid,
            packageIdSet,
          },
        );

        const receivedPieceIds = collectReceivedPieceIdentities(
          beforePackages,
          updatedPackages,
        );

        if (receivedPieceIds.length === 0) {
          throw new HttpsError(
            "failed-precondition",
            packageIdSet
              ? "None of the selected pieces are awaiting returned intake."
              : `Shipment ${shipmentId} has no returned pieces ready for intake.`,
          );
        }

        const pendingAfter = countPendingAfter(updatedPackages);
        const derivedStatus = deriveMasterShipmentStatus(updatedPackages, {
          previousStatus: data.status,
        });
        const activeCheckerIds = collectActiveCheckerIds(updatedPackages);
        const allIntakeComplete = pendingAfter === 0;

        const shipmentUpdate = {
          packages: updatedPackages,
          status: derivedStatus,
          activeCheckerIds,
          availableForDelivery: false,
          custodyOwnerType: shipmentHasWarehouseCustodyPieces(updatedPackages)
            ? "WAREHOUSE"
            : data.custodyOwnerType || "WAREHOUSE",
          custodyOwnerId: normalizedWarehouse,
          currentLocationState: normalizedWarehouse,
          updatedAt: now,
          updatedBy: actorName || actorUid || null,
          statusHistory: FieldValue.arrayUnion({
            status: derivedStatus,
            at: admin.firestore.Timestamp.now(),
            by: actorName || actorUid || null,
            note: `${intakeNote} (${receivedPieceIds.length} piece${
              receivedPieceIds.length === 1 ? "" : "s"
            })`,
            location: normalizeString(location) || normalizedWarehouse,
          }),
        };

        if (allIntakeComplete) {
          shipmentUpdate.assignedCheckerId = null;
          shipmentUpdate.assignedCheckerName = null;
          shipmentUpdate.deliveryManifestId = null;
          shipmentUpdate.returnReceivedAt = now;
          shipmentUpdate.returnReceivedBy = actorName || actorUid || null;
          shipmentUpdate.returnReceivedByUid = actorUid || null;
          shipmentUpdate.returnReceiveWarehouseCode = normalizedWarehouse;
        }

        tx.update(shipmentRefs[index], shipmentUpdate);

        receivedIds.push(shipmentId);
        receivedPieceIds.forEach((pieceId) => {
          receivedEventMeta.push({ shipmentId, pieceId });
        });
      });
    });

    await Promise.all(
      receivedEventMeta.map((meta) =>
        writeShipmentEvent({
          db,
          event: {
            shipmentId: meta.shipmentId,
            pieceId: meta.pieceId,
            eventType: EVENT_TYPES.RECEIVED_RETURNED_SHIPMENT,
            warehouseManagerId: actorUid || null,
            warehouseManagerName: actorName || null,
            location: normalizeString(location) || normalizedWarehouse,
            remarks:
              normalizeString(remarks) ||
              "Received returned piece at Odiongan.",
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
      packageIds: receivedEventMeta.map((meta) => meta.pieceId).filter(Boolean),
      packageCount: receivedEventMeta.length,
    };
  },
);
