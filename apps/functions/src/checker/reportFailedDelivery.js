"use strict";

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const { FieldValue } = require("firebase-admin/firestore");
const { requireRole } = require("../utilities/helpers");
const { writeShipmentEvent } = require("../tracking/writeShipmentEvent");
const { EVENT_TYPES } = require("../tracking/eventTypes");
const { resolveShipmentIds } = require("./checkerShipmentResolve");
const { deriveMasterShipmentStatus } = require("../packages/shipmentStatus");
const {
  normalizePackageIdSet,
  collectTargetPieceIdentities,
  assertHasTargetPieces,
  assertRequestedPiecesOwned,
  shouldTargetCheckerPiece,
  applyPieceFailed,
  collectActiveCheckerIds,
} = require("./checkerPieceOperations");
const {
  assertCheckerCanAccessShipment,
} = require("../warehouse/packageDeliveryOperations");
const {
  enforceMunicipalityDeliveryAccess,
} = require("../routes/municipalityDeliveryAccess");

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

function normalizeString(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function normalizeQty(value, fallback = 1) {
  const num = Number(value);
  return Number.isFinite(num) && num >= 0 ? num : fallback;
}

function sumDeliveredQty(packages = []) {
  return packages.reduce((sum, pkg) => {
    const quantity = normalizeQty(pkg.quantity, 1);
    const status = String(pkg.status || "").toUpperCase();
    if (status === "DELIVERED" || status === "COMPLETED") {
      return sum + quantity;
    }
    return sum;
  }, 0);
}

exports.reportFailedDelivery = onCall(
  { region: "asia-southeast1", maxInstances: 10 },
  async (req) => {
    const {
      uid: actorUid,
      role: actorRole,
      user: actorUser,
    } = await requireRole(db, req, [
      "checker",
      "admin",
      "manager",
      "administrator",
    ]);
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
      failurePhotoUrls = null,
    } = req.data || {};

    const normalizedFailurePhotos = Array.isArray(failurePhotoUrls)
      ? failurePhotoUrls.map((url) => normalizeString(url)).filter(Boolean)
      : [];

    const packageIdSet = normalizePackageIdSet(packageIds);
    const resolvedShipmentIds = await resolveShipmentIds(db, {
      shipmentIds,
      packageIds,
    });

    const now = FieldValue.serverTimestamp();
    const failedShipmentIds = [];
    const failedEventMeta = [];

    const preReadSnaps = await Promise.all(
      resolvedShipmentIds.map((id) => db.collection("shipments").doc(id).get()),
    );

    for (let index = 0; index < preReadSnaps.length; index += 1) {
      const snap = preReadSnaps[index];
      const shipmentId = resolvedShipmentIds[index];
      if (!snap.exists) continue;

      const data = snap.data() || {};
      const packages = Array.isArray(data.packages) ? data.packages : [];

      for (const pkg of packages) {
        if (
          !shouldTargetCheckerPiece(pkg, {
            checkerUid: actorUid,
            shipmentData: data,
            packageIdSet,
            mode: "fail",
          })
        ) {
          continue;
        }

        await enforceMunicipalityDeliveryAccess({
          db,
          shipment: data,
          shipmentId,
          checkerUser: actorUser,
          scannerUid: actorUid,
          scannerName: actorName,
          scannerRole: actorRole,
          scanType: "FAIL",
          pkg,
          gps: gpsCoordinates,
        });
      }
    }

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
        assertCheckerCanAccessShipment(shipmentId, data, actorUid);

        const packages = Array.isArray(data.packages) ? data.packages : [];
        assertRequestedPiecesOwned(
          packages,
          packageIdSet,
          actorUid,
          data,
          "mark as failed",
        );

        const targetIdentities = collectTargetPieceIdentities(packages, {
          checkerUid: actorUid,
          shipmentData: data,
          packageIdSet,
          mode: "fail",
        });
        assertHasTargetPieces(
          targetIdentities,
          "mark as failed. Scan the piece label or mark out for delivery first.",
        );

        const failureNote =
          normalizeString(remarks) ||
          (reasonCode
            ? `Failed delivery (${reasonCode})`
            : "Failed delivery attempt.");

        const updatedPackages = packages.map((pkg) => {
          if (
            !shouldTargetCheckerPiece(pkg, {
              checkerUid: actorUid,
              shipmentData: data,
              packageIdSet,
              mode: "fail",
            })
          ) {
            return pkg;
          }

          return applyPieceFailed(pkg, {
            actorUid,
            actorName,
            reasonCode: normalizeString(reasonCode),
            remarks: failureNote,
          });
        });

        const derivedStatus = deriveMasterShipmentStatus(updatedPackages, {
          previousStatus: data.status,
        });
        const activeCheckerIds = collectActiveCheckerIds(updatedPackages);

        const shipmentUpdate = {
          packages: updatedPackages,
          status: derivedStatus,
          activeCheckerIds,
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
          "totals.delivered": sumDeliveredQty(updatedPackages),
          statusHistory: FieldValue.arrayUnion({
            status: derivedStatus,
            at: admin.firestore.Timestamp.now(),
            by: actorName || actorUid || null,
            note: `${failureNote} (${targetIdentities.length} piece${
              targetIdentities.length === 1 ? "" : "s"
            })`,
            location: normalizeString(location),
          }),
        };

        if (normalizedFailurePhotos.length > 0) {
          shipmentUpdate.failureProofUrls = normalizedFailurePhotos;
        }

        tx.update(shipmentRefs[index], shipmentUpdate);

        failedShipmentIds.push(shipmentId);
        targetIdentities.forEach((pieceId) => {
          failedEventMeta.push({
            shipmentId,
            pieceId,
            manifestId: normalizeString(data.deliveryManifestId),
            deliveryVehicleId: normalizeString(data.deliveryVehicleId),
            deliveryVehicleName: normalizeString(data.deliveryVehicleName),
          });
        });
      });
    });

    await Promise.all(
      failedEventMeta.map((meta) =>
        writeShipmentEvent({
          db,
          event: {
            shipmentId: meta.shipmentId,
            pieceId: meta.pieceId,
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
      packageIds: failedEventMeta.map((meta) => meta.pieceId).filter(Boolean),
      packageCount: failedEventMeta.length,
    };
  },
);
