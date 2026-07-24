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
  explainCheckerReturnFailure,
  assertRequestedPiecesOwned,
  shouldTargetCheckerPiece,
  applyPieceReturnedToWarehouse,
  collectActiveCheckerIds,
  isCheckerOwnedPiece,
} = require("./checkerPieceOperations");
const {
  assertCheckerCanAccessShipment,
  shipmentHasWarehouseCustodyPieces,
} = require("../warehouse/packageDeliveryOperations");
const {
  enforceMunicipalityDeliveryAccess,
} = require("../routes/municipalityDeliveryAccess");

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

function normalizeString(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function isManagerRole(role) {
  return ["admin", "manager"].includes(String(role || "").toLowerCase());
}

function collectManagerReturnPieceIdentities(packages = [], packageIdSet = null) {
  const identities = [];
  packages.forEach((pkg) => {
    const status = String(pkg.status || "").toUpperCase();
    if (!["FAILED_DELIVERY", "OUT_FOR_DELIVERY"].includes(status)) return;
    if (packageIdSet && packageIdSet.size > 0) {
      let matched = false;
      for (const packageId of packageIdSet) {
        if (
          String(pkg.packageId || "").trim() === packageId ||
          String(pkg.trackingNumber || "").trim() === packageId
        ) {
          matched = true;
          break;
        }
      }
      if (!matched) return;
    }
    const identity = String(pkg.packageId || pkg.trackingNumber || "").trim();
    if (identity) identities.push(identity);
  });
  return identities;
}

function shouldReturnPiece(
  pkg = {},
  {
    isChecker,
    actorUid,
    shipmentData,
    packageIdSet,
    managerTargetSet = null,
  },
) {
  if (isChecker) {
    return shouldTargetCheckerPiece(pkg, {
      checkerUid: actorUid,
      shipmentData,
      packageIdSet,
      mode: "return",
    });
  }

  const identity = String(pkg.packageId || pkg.trackingNumber || "").trim();
  if (managerTargetSet && managerTargetSet.size > 0) {
    return managerTargetSet.has(identity);
  }
  return false;
}

exports.returnPackagesToWarehouse = onCall(
  { region: "asia-southeast1", maxInstances: 10 },
  async (req) => {
    try {
    const {
      uid: actorUid,
      role: actorRole,
      user: actorUser,
    } = await requireRole(db, req, ["checker", "manager", "admin", "administrator"]);
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

    const packageIdSet = normalizePackageIdSet(packageIds);
    const resolvedShipmentIds = await resolveShipmentIds(db, {
      shipmentIds,
      packageIds,
    });

    const normalizedWarehouse =
      normalizeString(warehouseCode) || "ODIONGAN_WAREHOUSE";
    const now = FieldValue.serverTimestamp();
    const returnedShipmentIds = [];
    const returnedEventMeta = [];
    const returnedByManifest = new Map();
    const isChecker = !isManagerRole(actorRole);

    const preReadSnaps = await Promise.all(
      resolvedShipmentIds.map((id) => db.collection("shipments").doc(id).get()),
    );

    if (isChecker) {
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
              mode: "return",
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
            scanType: "RETURN",
            pkg,
            gps: gpsCoordinates,
          });
        }
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

        if (isChecker) {
          assertCheckerCanAccessShipment(shipmentId, data, actorUid);
        }

        const packages = Array.isArray(data.packages) ? data.packages : [];

        if (isChecker) {
          assertRequestedPiecesOwned(
            packages,
            packageIdSet,
            actorUid,
            data,
            "return",
          );
        }

        const targetIdentities = isChecker
          ? collectTargetPieceIdentities(packages, {
              checkerUid: actorUid,
              shipmentData: data,
              packageIdSet,
              mode: "return",
            })
          : collectManagerReturnPieceIdentities(packages, packageIdSet);

        if (isChecker) {
          if (targetIdentities.length === 0) {
            throw new HttpsError(
              "failed-precondition",
              explainCheckerReturnFailure(packages, {
                checkerUid: actorUid,
                shipmentData: data,
                packageIdSet,
              }),
            );
          }
        } else if (targetIdentities.length === 0) {
          throw new HttpsError(
            "failed-precondition",
            "No returnable pieces found on this shipment.",
          );
        }

        const managerTargetSet = new Set(targetIdentities);

        const returnNote =
          normalizeString(remarks) ||
          "Returned to Odiongan warehouse by checker.";

        const updatedPackages = packages.map((pkg) => {
          if (
            !shouldReturnPiece(pkg, {
              isChecker,
              actorUid,
              shipmentData: data,
              packageIdSet,
              managerTargetSet,
            })
          ) {
            return pkg;
          }
          return applyPieceReturnedToWarehouse(pkg, {
            warehouseCode: normalizedWarehouse,
          });
        });

        const derivedStatus = deriveMasterShipmentStatus(updatedPackages, {
          previousStatus: data.status,
        });
        const activeCheckerIds = collectActiveCheckerIds(updatedPackages);
        const checkerStillHasPieces = updatedPackages.some((pkg) =>
          isCheckerOwnedPiece(pkg, actorUid, data),
        );

        const manifestId = normalizeString(data.deliveryManifestId);
        if (manifestId && targetIdentities.length > 0) {
          const existing = returnedByManifest.get(manifestId) || [];
          existing.push(shipmentId);
          returnedByManifest.set(manifestId, existing);
        }

        const shipmentUpdate = {
          packages: updatedPackages,
          status: derivedStatus,
          activeCheckerIds,
          custodyOwnerType: shipmentHasWarehouseCustodyPieces(updatedPackages)
            ? "WAREHOUSE"
            : data.custodyOwnerType || "WAREHOUSE",
          custodyOwnerId: shipmentHasWarehouseCustodyPieces(updatedPackages)
            ? normalizedWarehouse
            : data.custodyOwnerId || normalizedWarehouse,
          currentLocationState: "ODIONGAN_WAREHOUSE",
          returnedAt: now,
          returnedByUid: actorUid,
          returnedByName: actorName,
          returnWarehouseCode: normalizedWarehouse,
          updatedAt: now,
          updatedBy: actorName || actorUid || null,
          statusHistory: FieldValue.arrayUnion({
            status: derivedStatus,
            at: admin.firestore.Timestamp.now(),
            by: actorName || actorUid || null,
            note: `${returnNote} (${targetIdentities.length} piece${
              targetIdentities.length === 1 ? "" : "s"
            })`,
            location: normalizeString(location) || normalizedWarehouse,
          }),
        };

        if (isChecker && !checkerStillHasPieces) {
          shipmentUpdate.assignedCheckerId = null;
          shipmentUpdate.assignedCheckerName = null;
          shipmentUpdate.deliveryManifestId = null;
          shipmentUpdate.deliveryVehicleId = null;
          shipmentUpdate.deliveryVehicleName = null;
        }

        tx.update(shipmentRefs[index], shipmentUpdate);

        if (targetIdentities.length > 0) {
          returnedShipmentIds.push(shipmentId);
          targetIdentities.forEach((pieceId) => {
            returnedEventMeta.push({ shipmentId, pieceId });
          });
        }
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
      returnedEventMeta.map((meta) =>
        writeShipmentEvent({
          db,
          event: {
            shipmentId: meta.shipmentId,
            pieceId: meta.pieceId,
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
      packageIds: returnedEventMeta.map((meta) => meta.pieceId).filter(Boolean),
      packageCount: returnedEventMeta.length,
    };
    } catch (error) {
      if (error instanceof HttpsError) throw error;
      console.error("returnPackagesToWarehouse failed:", error);
      throw new HttpsError(
        "internal",
        error?.message || "Failed to return packages to warehouse.",
      );
    }
  },
);
