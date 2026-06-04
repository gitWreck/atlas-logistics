"use strict";

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const { FieldValue } = require("firebase-admin/firestore");
const { requireRole, updatedBy } = require("../utilities/helpers");
const { writeShipmentEvent } = require("../tracking/writeShipmentEvent");
const { EVENT_TYPES } = require("../tracking/eventTypes");
const {
  assertEligibleForCheckerRelease,
  normalizeStatus,
} = require("./releaseEligibility");
const { buildDerivedShipmentSnapshot } = require("../packages/shipmentStatus");

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

/** @deprecated Prefer releaseForDeliveryOperations (Step 2.7). Legacy single-checker assign. */
exports.releasePackagesToChecker = onCall(
  { region: "asia-southeast1", maxInstances: 10 },
  async (req) => {
    await requireRole(db, req, ["admin", "manager"]);

    const { uid: actorUid, name: actorName, role: actorRole } = updatedBy(req);
    const {
      shipmentIds,
      packageIds,
      checkerId,
      deliveryVehicleId = null,
      deliveryVehicleName = null,
      warehouseCode = "ODIONGAN_WAREHOUSE",
      manifestId = null,
      remarks = null,
    } = req.data || {};

    const normalizedCheckerId = normalizeString(checkerId);
    if (!normalizedCheckerId) {
      throw new HttpsError("invalid-argument", "checkerId is required.");
    }

    const resolvedShipmentIds = await resolveShipmentIds({
      shipmentIds,
      packageIds,
    });
    const now = FieldValue.serverTimestamp();
    const nowIso = new Date().toISOString();

    const checkerRef = db.collection("users").doc(normalizedCheckerId);
    const manifestRef = normalizeString(manifestId)
      ? db.collection("delivery_manifests").doc(normalizeString(manifestId))
      : db.collection("delivery_manifests").doc();

    let checkerName = null;
    let releasedShipmentIds = [];
    let createdManifestId = manifestRef.id;

    await db.runTransaction(async (tx) => {
      const checkerSnap = await tx.get(checkerRef);
      if (!checkerSnap.exists) {
        throw new HttpsError("not-found", "Checker user not found.");
      }
      const checkerData = checkerSnap.data() || {};
      const checkerRole = String(checkerData.role || "").toLowerCase();
      if (checkerRole !== "checker") {
        throw new HttpsError(
          "failed-precondition",
          "Selected checkerId does not belong to a checker account.",
        );
      }
      if (checkerData.active !== true) {
        throw new HttpsError(
          "failed-precondition",
          "Checker account is inactive.",
        );
      }
      checkerName =
        checkerData.fullName ||
        checkerData.name ||
        checkerData.displayName ||
        null;

      const shipmentRefs = resolvedShipmentIds.map((id) =>
        db.collection("shipments").doc(id),
      );
      const shipmentSnaps = await Promise.all(
        shipmentRefs.map((shipmentRef) => tx.get(shipmentRef)),
      );

      const effectiveShipmentIds = [];
      const effectivePackageIds = new Set();

      shipmentSnaps.forEach((shipmentSnap, index) => {
        if (!shipmentSnap.exists) return;
        const shipmentRef = shipmentRefs[index];
        const shipmentData = shipmentSnap.data() || {};

        assertEligibleForCheckerRelease(
          shipmentRef.id,
          shipmentData.status,
        );

        const shipmentPackageIds = Array.isArray(shipmentData.packageBarcodes)
          ? shipmentData.packageBarcodes.filter(
              (value) => typeof value === "string",
            )
          : [];
        shipmentPackageIds.forEach((value) => effectivePackageIds.add(value));

        const releaseNote =
          normalizeString(remarks) ||
          (normalizeStatus(shipmentData.status) === "RETURNED_RECEIVED_AT_HUB"
            ? "Re-released to checker after returned intake."
            : "Released to checker for last-mile handling.");

        const packages = Array.isArray(shipmentData.packages)
          ? shipmentData.packages
          : [];
        const derivedSnapshot = buildDerivedShipmentSnapshot(packages, {
          previousStatus: shipmentData.status,
        });

        tx.update(shipmentRef, {
          assignedCheckerId: normalizedCheckerId,
          assignedCheckerName: checkerName,
          deliveryVehicleId: normalizeString(deliveryVehicleId),
          deliveryVehicleName: normalizeString(deliveryVehicleName),
          deliveryManifestId: manifestRef.id,
          custodyOwnerType: "CHECKER",
          custodyOwnerId: normalizedCheckerId,
          currentLocationState: "CHECKER_ASSIGNED",
          releasedByUid: actorUid || req.auth?.uid || null,
          releasedByName: actorName || null,
          releasedAt: now,
          updatedAt: now,
          updatedBy: actorName || actorUid || null,
          status: derivedSnapshot.status,
          packages: derivedSnapshot.packages,
          packageBreakdown: derivedSnapshot.packageBreakdown,
          availableForDelivery: derivedSnapshot.availableForDelivery,
          previousAssignedCheckerId:
            shipmentData.lastAssignedCheckerId ||
            shipmentData.assignedCheckerId ||
            null,
          previousAssignedCheckerName:
            shipmentData.lastAssignedCheckerName ||
            shipmentData.assignedCheckerName ||
            null,
          statusHistory: FieldValue.arrayUnion({
            status: "ASSIGNED_TO_CHECKER",
            at: admin.firestore.Timestamp.now(),
            by: actorName || actorUid || null,
            note: releaseNote,
            location: warehouseCode || null,
          }),
        });

        effectiveShipmentIds.push(shipmentRef.id);
      });

      if (effectiveShipmentIds.length === 0) {
        throw new HttpsError("not-found", "No valid shipment documents found.");
      }

      tx.set(
        manifestRef,
        {
          manifestId: manifestRef.id,
          checkerId: normalizedCheckerId,
          checkerName: checkerName,
          deliveryVehicleId: normalizeString(deliveryVehicleId),
          deliveryVehicleName: normalizeString(deliveryVehicleName),
          warehouseCode: normalizeString(warehouseCode),
          status: "DRAFT",
          releasedByUid: actorUid || req.auth?.uid || null,
          releasedByName: actorName || null,
          releasedAt: now,
          shipmentIds: FieldValue.arrayUnion(...effectiveShipmentIds),
          updatedAt: now,
          updatedBy: actorName || actorUid || null,
        },
        { merge: true },
      );
      if (effectivePackageIds.size > 0) {
        tx.set(
          manifestRef,
          {
            packageIds: FieldValue.arrayUnion(...effectivePackageIds),
          },
          { merge: true },
        );
      }

      releasedShipmentIds = effectiveShipmentIds;
      createdManifestId = manifestRef.id;
    });

    await Promise.all(
      releasedShipmentIds.map((shipmentId) =>
        writeShipmentEvent({
          db,
          event: {
            shipmentId,
            eventType: EVENT_TYPES.RELEASED_TO_CHECKER,
            checkerId: normalizedCheckerId,
            checkerName,
            warehouseManagerId: actorUid || req.auth?.uid || null,
            warehouseManagerName: actorName || null,
            deliveryVehicleId: normalizeString(deliveryVehicleId),
            deliveryVehicleName: normalizeString(deliveryVehicleName),
            location: normalizeString(warehouseCode),
            createdBy: actorUid || req.auth?.uid || null,
            createdByRole: actorRole || "manager",
            remarks: normalizeString(remarks),
            source: "MANAGER_RELEASE",
          },
        }),
      ),
    );

    return {
      success: true,
      manifestId: createdManifestId,
      checkerId: normalizedCheckerId,
      checkerName,
      shipmentIds: releasedShipmentIds,
      shipmentCount: releasedShipmentIds.length,
    };
  },
);
