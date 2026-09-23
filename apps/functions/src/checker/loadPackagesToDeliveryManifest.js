"use strict";

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const { FieldValue } = require("firebase-admin/firestore");
const { requireRole } = require("../utilities/helpers");
const { writeShipmentEvent } = require("../tracking/writeShipmentEvent");
const { EVENT_TYPES } = require("../tracking/eventTypes");
const { deriveMasterShipmentStatus, computePackageBreakdown } = require("../packages/shipmentStatus");
const {
  isReleasedForDeliveryPool,
  PACKAGE_STATUS,
} = require("../packages/packageStatus");
const {
  DEFAULT_WAREHOUSE_CODE,
  applyPieceLoadCustody,
  assertCheckerCanAccessShipment,
  getPackageIdentity,
  shipmentHasPiecesAvailableForCheckerLoad,
  shipmentHasWarehouseCustodyPieces,
} = require("../warehouse/packageDeliveryOperations");
const {
  enforceMunicipalityDeliveryAccess,
} = require("../routes/municipalityDeliveryAccess");

function wasShipmentOutForDelivery(status = "") {
  const normalized = String(status || "").toUpperCase();
  return (
    normalized === "OUT_FOR_DELIVERY" ||
    normalized === "PARTIALLY_OUT_FOR_DELIVERY"
  );
}

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

function normalizeString(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function normalizeStringList(values = []) {
  if (!Array.isArray(values)) return [];
  const unique = new Set();
  for (const value of values) {
    if (typeof value !== "string") continue;
    const trimmed = value.trim();
    if (!trimmed) continue;
    unique.add(trimmed);
  }
  return [...unique];
}

async function resolveShipmentIds({ shipmentIds, packageIds }) {
  const normalizedShipmentIds = normalizeStringList(shipmentIds);
  if (normalizedShipmentIds.length > 0) return normalizedShipmentIds;

  const normalizedPackageIds = normalizeStringList(packageIds);
  if (normalizedPackageIds.length === 0) {
    throw new HttpsError(
      "invalid-argument",
      "Provide shipmentIds or packageIds.",
    );
  }

  const resolvedIds = new Set();
  await Promise.all(
    normalizedPackageIds.map(async (packageId) => {
      const snap = await db
        .collection("shipments")
        .where("packageBarcodes", "array-contains", packageId)
        .limit(1)
        .get();
      if (!snap.empty) {
        resolvedIds.add(snap.docs[0].id);
      }
    }),
  );

  if (resolvedIds.size === 0) {
    throw new HttpsError(
      "not-found",
      "No shipments found for the provided packageIds.",
    );
  }

  return [...resolvedIds];
}

function assertPieceEligibleForCheckerLoad(pkg = {}, actorUid, packageId = null) {
  const identity = packageId || getPackageIdentity(pkg) || "piece";
  const loadedBy = String(pkg.loadedByCheckerId || "").trim();
  if (loadedBy && loadedBy !== String(actorUid)) {
    throw new HttpsError(
      "failed-precondition",
      `Package ${identity} is already loaded by another checker.`,
    );
  }

  const custody = String(pkg.custodyOwnerType || "").toUpperCase();
  const custodyId = String(pkg.custodyOwnerId || "").trim();
  if (
    custody === "CHECKER" &&
    custodyId &&
    custodyId !== String(actorUid) &&
    loadedBy
  ) {
    throw new HttpsError(
      "failed-precondition",
      `Package ${identity} is in another checker's custody.`,
    );
  }
}

function getTimestampMs(value) {
  if (!value) return 0;
  if (typeof value?.toMillis === "function") return value.toMillis();
  if (value?._seconds) return value._seconds * 1000;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

async function resolveActiveCheckerManifestId(db, checkerId) {
  const snap = await db
    .collection("delivery_manifests")
    .where("checkerId", "==", checkerId)
    .limit(20)
    .get();

  if (snap.empty) return null;

  const activeStatuses = new Set(["DRAFT", "LOADED"]);
  const sorted = snap.docs
    .filter((docSnap) =>
      activeStatuses.has(String(docSnap.data()?.status || "").toUpperCase()),
    )
    .sort(
      (a, b) =>
        getTimestampMs(b.data()?.updatedAt || b.data()?.createdAt) -
        getTimestampMs(a.data()?.updatedAt || a.data()?.createdAt),
    );

  return sorted[0]?.id || null;
}

function resolveDeliveryVehicle({
  requestVehicleId = null,
  requestVehicleName = null,
  manifestData = {},
  shipmentSnaps = [],
  actorData = {},
  checkerId,
  checkerName = null,
}) {
  let vehicleId =
    normalizeString(requestVehicleId) ||
    normalizeString(manifestData.deliveryVehicleId) ||
    normalizeString(actorData.deliveryVehicleId) ||
    normalizeString(actorData.vehicleId) ||
    normalizeString(actorData.assignedVehicleId);

  let vehicleName =
    normalizeString(requestVehicleName) ||
    normalizeString(manifestData.deliveryVehicleName) ||
    normalizeString(actorData.deliveryVehicleName) ||
    normalizeString(actorData.vehicleName) ||
    normalizeString(actorData.assignedVehicleName);

  for (const snap of shipmentSnaps) {
    const shipmentData = snap.exists ? snap.data() || {} : {};
    vehicleId =
      vehicleId || normalizeString(shipmentData.deliveryVehicleId);
    vehicleName =
      vehicleName || normalizeString(shipmentData.deliveryVehicleName);
    if (vehicleId && vehicleName) break;
  }

  if (!vehicleId && !vehicleName) {
    const label = normalizeString(checkerName);
    vehicleId = checkerId ? `CHECKER_${checkerId}` : null;
    vehicleName = label ? `${label}'s van` : "Checker van";
  }

  return { vehicleId, vehicleName };
}

function packageIsEligibleForLoad(
  pkg = {},
  targetedPackageIds = null,
  actorUid = null,
) {
  if (targetedPackageIds && !targetedPackageIds.has(getPackageIdentity(pkg))) {
    return false;
  }

  const loadedBy = String(pkg.loadedByCheckerId || "").trim();
  if (actorUid && loadedBy && loadedBy !== String(actorUid)) {
    return false;
  }

  const status = String(pkg.status || "").toUpperCase();
  if (["DELIVERED", "MISSING", "DAMAGED", "CANCELLED"].includes(status)) {
    return false;
  }

  if (pkg.availableForDelivery === true) return true;
  if (isReleasedForDeliveryPool(pkg)) return true;
  if (
    [
      PACKAGE_STATUS.AVAILABLE_AT_WAREHOUSE,
      PACKAGE_STATUS.AVAILABLE_AT_ODIONGAN_WAREHOUSE,
      PACKAGE_STATUS.RELEASED_FOR_DELIVERY,
      PACKAGE_STATUS.ROUTE_ASSIGNED,
    ].includes(status)
  ) {
    return true;
  }

  const custody = String(pkg.custodyOwnerType || "").toUpperCase();
  if (
    custody === "WAREHOUSE" &&
    (status === "RECEIVED" || status === PACKAGE_STATUS.RECEIVED_AT_DIVISORIA)
  ) {
    return true;
  }

  return false;
}

exports.loadPackagesToDeliveryManifest = onCall(
  {
    region: "asia-southeast1",
    maxInstances: 10,
  },
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
      manifestId = null,
      deliveryVehicleId = null,
      deliveryVehicleName = null,
      location = null,
      gpsCoordinates = null,
      remarks = null,
      notificationChannels = null,
    } = req.data || {};

    const lifecycleChannels = {
      sms: notificationChannels?.sms === true,
      email: notificationChannels?.email === true,
      push: notificationChannels?.push === true,
    };
    const shouldSendLifecycleNotification = Object.values(
      lifecycleChannels,
    ).some(Boolean);

    const normalizedPackageIds = new Set(normalizeStringList(packageIds));
    const hasPieceScope = normalizedPackageIds.size > 0;

    const resolvedShipmentIds = await resolveShipmentIds({
      shipmentIds,
      packageIds,
    });

    const now = FieldValue.serverTimestamp();
    const nowIso = new Date().toISOString();
    const normalizedManifestId =
      normalizeString(manifestId) ||
      (await resolveActiveCheckerManifestId(db, actorUid));

    let loadedShipmentIds = [];
    let loadedPackageIds = [];
    const loadedEvents = [];
    let manifestRefId = null;
    let resolvedVehicleId = null;
    let resolvedVehicleName = null;
    let checkerName = actorName || null;

    const shipmentRefs = resolvedShipmentIds.map((id) =>
      db.collection("shipments").doc(id),
    );
    const preReadSnaps = await Promise.all(
      shipmentRefs.map((ref) => ref.get()),
    );

    for (let index = 0; index < preReadSnaps.length; index += 1) {
      const snap = preReadSnaps[index];
      const shipmentId = resolvedShipmentIds[index];
      if (!snap.exists) {
        throw new HttpsError("not-found", `Shipment not found: ${shipmentId}`);
      }

      const shipmentData = snap.data() || {};
      const packages = Array.isArray(shipmentData.packages)
        ? shipmentData.packages
        : [];

      let shouldValidateMunicipality = false;

      for (const pkg of packages) {
        const identity = getPackageIdentity(pkg);
        const inScope =
          !hasPieceScope ||
          (identity && normalizedPackageIds.has(identity));
        if (!inScope) continue;

        if (
          !packageIsEligibleForLoad(
            pkg,
            hasPieceScope ? normalizedPackageIds : null,
            actorUid,
          )
        ) {
          if (hasPieceScope && identity && normalizedPackageIds.has(identity)) {
            assertPieceEligibleForCheckerLoad(pkg, actorUid, identity);
            throw new HttpsError(
              "failed-precondition",
              `Package ${identity} is not available to load.`,
            );
          }
          continue;
        }

        shouldValidateMunicipality = true;
      }

      if (shouldValidateMunicipality) {
        await enforceMunicipalityDeliveryAccess({
          db,
          shipment: shipmentData,
          shipmentId,
          checkerUser: actorUser,
          scannerUid: actorUid,
          scannerName: actorName,
          scannerRole: actorRole,
          scanType: "LOAD",
          gps: gpsCoordinates,
        });
      }
    }

    await db.runTransaction(async (tx) => {
      const actorRef = db.collection("users").doc(actorUid);
      const actorSnap = await tx.get(actorRef);
      const actorData = actorSnap.exists ? actorSnap.data() || {} : {};
      if (actorSnap.exists) {
        checkerName =
          actorData.fullName ||
          actorData.name ||
          actorData.displayName ||
          checkerName;
      }

      const shipmentRefs = resolvedShipmentIds.map((id) =>
        db.collection("shipments").doc(id),
      );
      const shipmentSnaps = await Promise.all(
        shipmentRefs.map((ref) => tx.get(ref)),
      );

      const isNewManifest = !normalizedManifestId;
      const manifestRef = normalizedManifestId
        ? db.collection("delivery_manifests").doc(normalizedManifestId)
        : db.collection("delivery_manifests").doc();

      let manifestData = {};
      if (!isNewManifest) {
        const existingManifestSnap = await tx.get(manifestRef);
        if (!existingManifestSnap.exists) {
          throw new HttpsError("not-found", "Delivery manifest not found.");
        }
        manifestData = existingManifestSnap.data() || {};
        const manifestCheckerId = normalizeString(manifestData.checkerId);
        if (manifestCheckerId && manifestCheckerId !== actorUid) {
          throw new HttpsError(
            "permission-denied",
            "This delivery manifest belongs to another checker.",
          );
        }
      }

      manifestRefId = manifestRef.id;

      const resolvedVehicle = resolveDeliveryVehicle({
        requestVehicleId: deliveryVehicleId,
        requestVehicleName: deliveryVehicleName,
        manifestData,
        shipmentSnaps,
        actorData,
        checkerId: actorUid,
        checkerName,
      });
      resolvedVehicleId = resolvedVehicle.vehicleId;
      resolvedVehicleName = resolvedVehicle.vehicleName;

      const effectiveShipmentIds = [];
      const effectivePackageIds = new Set();
      const shipmentUpdates = [];

      shipmentSnaps.forEach((snap, index) => {
        const shipmentRef = shipmentRefs[index];
        const shipmentId = resolvedShipmentIds[index];

        if (!snap.exists) {
          throw new HttpsError("not-found", `Shipment not found: ${shipmentId}`);
        }

        const shipmentData = snap.data() || {};
        assertCheckerCanAccessShipment(shipmentId, shipmentData, actorUid);

        const status = String(shipmentData.status || "").toUpperCase();
        if (status === "DELIVERED" || status === "COMPLETED") {
          throw new HttpsError(
            "failed-precondition",
            `Shipment ${shipmentId} is already delivered.`,
          );
        }

        const packages = Array.isArray(shipmentData.packages)
          ? shipmentData.packages
          : [];

        const legacyAssigned = normalizeString(shipmentData.assignedCheckerId);
        const poolRelease =
          shipmentData.availableForDelivery === true ||
          status === "AVAILABLE_FOR_DELIVERY" ||
          status === "OUT_FOR_DELIVERY" ||
          status === "PARTIALLY_OUT_FOR_DELIVERY" ||
          shipmentHasPiecesAvailableForCheckerLoad(packages, actorUid);

        if (!poolRelease && legacyAssigned && legacyAssigned !== actorUid) {
          throw new HttpsError(
            "permission-denied",
            `Shipment ${shipmentId} is assigned to another checker.`,
          );
        }
        let loadedCount = 0;

        const updatedPackages = packages.map((pkg) => {
          const identity = getPackageIdentity(pkg);
          const inScope =
            !hasPieceScope ||
            (identity && normalizedPackageIds.has(identity));

          if (!inScope) {
            return pkg;
          }

          if (
            !packageIsEligibleForLoad(
              pkg,
              hasPieceScope ? normalizedPackageIds : null,
              actorUid,
            )
          ) {
            if (hasPieceScope && identity && normalizedPackageIds.has(identity)) {
              assertPieceEligibleForCheckerLoad(pkg, actorUid, identity);
              throw new HttpsError(
                "failed-precondition",
                `Package ${identity} is not available to load.`,
              );
            }
            return pkg;
          }

          loadedCount += 1;
          effectivePackageIds.add(identity);
          loadedEvents.push({ shipmentId, packageId: identity });

          return applyPieceLoadCustody(pkg, {
            checkerId: actorUid,
            checkerName,
            manifestId: manifestRefId,
            vehicleId: resolvedVehicleId,
            vehicleName: resolvedVehicleName,
            nowIso,
          });
        });

        if (loadedCount === 0) {
          throw new HttpsError(
            "failed-precondition",
            hasPieceScope
              ? `No eligible pieces to load on shipment ${shipmentId}. They may already be loaded or not released for delivery.`
              : `No available pieces to load on shipment ${shipmentId}.`,
          );
        }

        const shipmentStatus = deriveMasterShipmentStatus(updatedPackages, {
          previousStatus: shipmentData.status,
        });
        const packageBreakdown = computePackageBreakdown(updatedPackages);

        const warehouseCode =
          normalizeString(shipmentData.custodyOwnerId) ||
          DEFAULT_WAREHOUSE_CODE;

        shipmentUpdates.push({
          ref: shipmentRef,
          data: {
            packages: updatedPackages,
            packageBreakdown,
            deliveryManifestId: manifestRefId,
            deliveryVehicleId: resolvedVehicleId,
            deliveryVehicleName: resolvedVehicleName,
            custodyOwnerType: shipmentHasWarehouseCustodyPieces(updatedPackages)
              ? "WAREHOUSE"
              : "CHECKER",
            custodyOwnerId: shipmentHasWarehouseCustodyPieces(updatedPackages)
              ? warehouseCode
              : actorUid,
            currentLocationState: shipmentHasWarehouseCustodyPieces(updatedPackages)
              ? loadedCount > 0
                ? "DELIVERY_VEHICLE_LOADED"
                : warehouseCode
              : "DELIVERY_VEHICLE_LOADED",
            status: shipmentStatus,
            availableForDelivery: shipmentHasPiecesAvailableForCheckerLoad(
              updatedPackages,
              actorUid,
            ),
            activeCheckerIds: FieldValue.arrayUnion(actorUid),
            updatedAt: now,
            updatedBy: actorName || actorUid || null,
            statusHistory: FieldValue.arrayUnion({
              status: shipmentStatus,
              at: admin.firestore.Timestamp.now(),
              by: actorName || actorUid || null,
              note:
                normalizeString(remarks) ||
                `Loaded ${loadedCount} piece(s) out for delivery via checker scan.`,
              location: location || null,
            }),
          },
        });

        if (
          !wasShipmentOutForDelivery(status) &&
          shouldSendLifecycleNotification
        ) {
          const notificationJobRef = db
            .collection("customer_notification_jobs")
            .doc();
          tx.set(notificationJobRef, {
            status: "PENDING",
            shipmentId,
            notificationType: "OUT_FOR_DELIVERY",
            tripId:
              shipmentData.currentTripId ||
              shipmentData.currentTruckTripId ||
              null,
            source: "CHECKER_LOAD_MANIFEST",
            channels: lifecycleChannels,
            actor: {
              uid: actorUid,
              name: checkerName,
              role: actorRole || "checker",
            },
            attempts: 0,
            createdAt: now,
            updatedAt: now,
          });
        }

        effectiveShipmentIds.push(shipmentId);
      });

      const manifestUpdate = {
        status: "LOADED",
        checkerId: actorUid,
        checkerName,
        loadedAt: now,
        deliveryVehicleId: resolvedVehicleId,
        deliveryVehicleName: resolvedVehicleName,
        loadedShipmentIds: FieldValue.arrayUnion(...effectiveShipmentIds),
        shipmentIds: FieldValue.arrayUnion(...effectiveShipmentIds),
        updatedAt: now,
        updatedBy: actorName || actorUid || null,
      };

      if (effectivePackageIds.size > 0) {
        manifestUpdate.loadedPackageIds = FieldValue.arrayUnion(
          ...effectivePackageIds,
        );
        manifestUpdate.packageIds = FieldValue.arrayUnion(
          ...effectivePackageIds,
        );
      }

      if (isNewManifest) {
        tx.set(
          manifestRef,
          {
            manifestId: manifestRef.id,
            checkerId: actorUid,
            checkerName,
            status: "DRAFT",
            createdAt: now,
            createdBy: actorName || actorUid || null,
            shipmentIds: [],
            packageIds: [],
            loadedPackageIds: [],
            deliveryVehicleId: resolvedVehicleId,
            deliveryVehicleName: resolvedVehicleName,
            updatedAt: now,
            updatedBy: actorName || actorUid || null,
            ...manifestUpdate,
          },
          { merge: true },
        );
      } else {
        tx.set(manifestRef, manifestUpdate, { merge: true });
      }

      shipmentUpdates.forEach(({ ref, data }) => {
        tx.update(ref, data);
      });

      loadedShipmentIds = effectiveShipmentIds;
      loadedPackageIds = [...effectivePackageIds];
    });

    await Promise.all(
      loadedEvents.map(({ shipmentId, packageId }) =>
        writeShipmentEvent({
          db,
          event: {
            shipmentId,
            pieceId: packageId,
            eventType: EVENT_TYPES.OUT_FOR_DELIVERY,
            manifestId: manifestRefId,
            checkerId: actorUid,
            checkerName,
            deliveryVehicleId: resolvedVehicleId,
            deliveryVehicleName: resolvedVehicleName,
            location: normalizeString(location),
            gpsCoordinates: gpsCoordinates || null,
            createdBy: actorUid,
            createdByRole: actorRole || "checker",
            remarks: normalizeString(remarks),
            source: "CHECKER_LOAD_MANIFEST",
          },
        }),
      ),
    );

    return {
      success: true,
      manifestId: manifestRefId,
      deliveryVehicleId: resolvedVehicleId,
      deliveryVehicleName: resolvedVehicleName,
      shipmentIds: loadedShipmentIds,
      packageIds: loadedPackageIds,
      shipmentCount: loadedShipmentIds.length,
      packageCount: loadedPackageIds.length,
    };
  },
);
