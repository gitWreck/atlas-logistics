"use strict";

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const { FieldValue } = require("firebase-admin/firestore");
const { requireRole, updatedBy } = require("../utilities/helpers");
const { writeShipmentEvent } = require("../tracking/writeShipmentEvent");
const { EVENT_TYPES } = require("../tracking/eventTypes");
const { resolveShipmentIds } = require("../checker/checkerShipmentResolve");
const {
  assertEligibleForDeliveryOperationsRelease,
} = require("./deliveryOperationsEligibility");
const {
  DEFAULT_WAREHOUSE_CODE,
  mapPackagesForDeliveryRelease,
  countPiecesEligibleForDeliveryRelease,
  listPiecesEligibleForDeliveryRelease,
  countPiecesAwaitingReturnReceive,
} = require("./packageDeliveryOperations");
const { buildDerivedShipmentSnapshot } = require("../packages/shipmentStatus");
const {
  assertTripReleaseEligible,
  validateAdminOverrideRelease,
  TRIP_STATUSES,
} = require("../trips/tripLifecycle");
const { MANIFEST_STATUS } = require("../trips/manifestStatus");
const { writeCustodyAuditLog } = require("../utilities/custodyAuditLog");
const { writeTripActionLog } = require("../utilities/tripLogger");
const {
  parsePackageIdentity,
  resolveRemarkForMissingPackage,
} = require("../trips/reconciliationPieces");
const { sealManifestAmendment } = require("../trips/manifestAmendment");
const { canAccessRecord } = require("../manager/managerAccess");

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

function normalizeString(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function normalizeMissingPackages(values = []) {
  if (!Array.isArray(values)) return [];
  const normalized = [];
  const seen = new Set();

  for (const entry of values) {
    if (!entry || typeof entry !== "object") continue;

    const packageId = normalizeString(entry.packageId);
    const shipmentDocId =
      normalizeString(entry.shipmentDocId) ||
      normalizeString(entry.id) ||
      null;
    const shipmentId =
      normalizeString(entry.shipmentId) || shipmentDocId || null;
    const pieceIds = Array.isArray(entry.missingPieceIds)
      ? entry.missingPieceIds.map((value) => normalizeString(value)).filter(Boolean)
      : [];

    const pushEntry = (resolvedPackageId, resolvedShipmentId, resolvedDocId) => {
      if (!resolvedPackageId || seen.has(resolvedPackageId)) return;
      seen.add(resolvedPackageId);
      const parsed = parsePackageIdentity(
        resolvedPackageId,
        resolvedShipmentId || null,
      );
      normalized.push({
        packageId: parsed.packageId,
        shipmentDocId: resolvedDocId || parsed.shipmentId,
        shipmentId: parsed.shipmentId || resolvedShipmentId || resolvedDocId,
        pieceSuffix:
          normalizeString(entry.pieceSuffix) || parsed.pieceSuffix || null,
      });
    };

    if (packageId) {
      pushEntry(packageId, shipmentId, shipmentDocId);
      continue;
    }

    if (pieceIds.length > 0) {
      for (const pieceId of pieceIds) {
        pushEntry(pieceId, shipmentId, shipmentDocId);
      }
      continue;
    }

    if (!shipmentDocId && !shipmentId) continue;

    const legacyKey = shipmentDocId || shipmentId;
    if (seen.has(legacyKey)) continue;
    seen.add(legacyKey);
    normalized.push({
      packageId: shipmentId,
      shipmentDocId: shipmentDocId || shipmentId,
      shipmentId: shipmentId || shipmentDocId,
      pieceSuffix: null,
      missingLabels:
        Number(entry.missingLabels ?? entry.remainingLoaded) || 0,
    });
  }

  return normalized;
}

function normalizeMissingRemarks(value = {}) {
  if (!value || typeof value !== "object") return {};
  const normalized = {};
  for (const [key, remark] of Object.entries(value)) {
    const trimmed = normalizeString(remark);
    if (trimmed) normalized[key] = trimmed;
  }
  return normalized;
}

function buildAdminOverrideAuditNote({
  tripId,
  missingPackageId,
  shipmentId,
  pieceSuffix,
  reason,
  actorName,
  timestamp,
}) {
  const lines = [
    "ADMIN OVERRIDE RELEASE",
    `Trip: ${tripId}`,
    `Missing Package: ${missingPackageId}`,
    `Shipment: ${shipmentId}`,
  ];

  if (pieceSuffix) {
    lines.push(`Missing Piece: ${pieceSuffix}`);
  }

  lines.push(
    `Reason: ${reason}`,
    `Released By: ${actorName}`,
    `Timestamp: ${timestamp}`,
  );

  return lines.join("\n");
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

async function resolveShipmentIdsWithTrip(
  db,
  { shipmentIds, packageIds, tripId },
) {
  const fromIds = await resolveShipmentIds(db, { shipmentIds, packageIds });
  const normalizedTripId = normalizeString(tripId);

  if (!normalizedTripId) {
    return fromIds;
  }

  const tripSnap = await db
    .collection("truck_trips")
    .doc(normalizedTripId)
    .get();

  if (!tripSnap.exists) {
    throw new HttpsError("not-found", `Trip not found: ${normalizedTripId}`);
  }

  const tripShipmentSnap = await db
    .collection("truck_trips")
    .doc(normalizedTripId)
    .collection("trip_shipments")
    .get();

  // Explicit shipmentIds/packageIds win — do not expand to every shipment on the trip.
  if (fromIds.length > 0) {
    return fromIds;
  }

  const tripShipmentIds = tripShipmentSnap.docs
    .map((docSnap) => docSnap.data()?.trackingShipmentId || docSnap.id)
    .filter(Boolean);

  if (tripShipmentIds.length === 0) {
    throw new HttpsError(
      "not-found",
      "No shipments found for this trip or selection.",
    );
  }

  return tripShipmentIds;
}

async function loadReleaseCandidates(db, resolvedShipmentIds, packageIdSet) {
  const shipmentRefs = resolvedShipmentIds.map((id) =>
    db.collection("shipments").doc(id),
  );
  const shipmentSnaps = await Promise.all(shipmentRefs.map((ref) => ref.get()));
  const releaseScope = { packageIdSet };
  const releaseCandidates = [];
  let awaitingReturn = 0;

  shipmentSnaps.forEach((snap, index) => {
    const shipmentId = resolvedShipmentIds[index];
    if (!snap.exists) {
      throw new HttpsError("not-found", `Shipment not found: ${shipmentId}`);
    }

    const data = snap.data() || {};
    assertEligibleForDeliveryOperationsRelease(shipmentId, data.status);

    const sourcePackages = Array.isArray(data.packages) ? data.packages : [];
    const releasableCount = countPiecesEligibleForDeliveryRelease(
      sourcePackages,
      releaseScope,
    );
    awaitingReturn += countPiecesAwaitingReturnReceive(sourcePackages);

    if (releasableCount === 0) return;

    releaseCandidates.push({
      index,
      shipmentId,
      data,
      sourcePackages,
      releaseScope,
      shipmentRef: shipmentRefs[index],
    });
  });

  if (releaseCandidates.length === 0) {
    throw new HttpsError(
      "failed-precondition",
      awaitingReturn > 0
        ? "Returned pieces must be received at Odiongan first (Shipment drawer → Return loop → Receive returned), then release for delivery."
        : "No shipments have hub-received packages to release. Unload and reconcile at Odiongan first, or receive returned pieces before releasing.",
    );
  }

  return releaseCandidates;
}

exports.releaseForDeliveryOperations = onCall(
  { region: "asia-southeast1", maxInstances: 10 },
  async (req) => {
    try {
    const actor = await requireRole(db, req, ["admin", "manager"]);
    const actorUid = actor.uid;
    const actorRole = actor.role;
    const actorName =
      actor.user?.name || updatedBy(req).name || actorUid || null;
    const {
      shipmentIds,
      packageIds,
      tripId = null,
      warehouseCode = DEFAULT_WAREHOUSE_CODE,
      remarks = null,
      adminOverride = false,
      missingRemarks = {},
      missingPackages = [],
    } = req.data || {};

    const isAdmin = String(actorRole || "").toLowerCase() === "admin";
    const useAdminOverride = adminOverride === true;

    if (useAdminOverride && !isAdmin) {
      throw new HttpsError(
        "permission-denied",
        "Only admins can release with reconciliation override.",
      );
    }

    const normalizedMissingRemarks = normalizeMissingRemarks(missingRemarks);
    const normalizedMissingPackages = normalizeMissingPackages(missingPackages);

    const resolvedShipmentIds = await resolveShipmentIdsWithTrip(db, {
      shipmentIds,
      packageIds,
      tripId,
    });

    const normalizedTripId = normalizeString(tripId);
    let tripReleaseDecision = null;

    if (normalizedTripId) {
      const tripSnap = await db
        .collection("truck_trips")
        .doc(normalizedTripId)
        .get();
      if (!tripSnap.exists) {
        throw new HttpsError(
          "not-found",
          `Trip not found: ${normalizedTripId}`,
        );
      }

      const tripData = tripSnap.data() || {};

      if (useAdminOverride) {
        const validation = validateAdminOverrideRelease({
          trip: tripData,
          missingPackages: normalizedMissingPackages,
          missingRemarks: normalizedMissingRemarks,
        });
        if (!validation.valid) {
          throw new HttpsError(
            "failed-precondition",
            validation.message || "Admin override release is not valid.",
          );
        }
      }

      tripReleaseDecision = assertTripReleaseEligible(tripData, {
        adminOverride: useAdminOverride,
        isAdmin,
      });
    }

    const normalizedWarehouse =
      normalizeString(warehouseCode) || DEFAULT_WAREHOUSE_CODE;
    const now = FieldValue.serverTimestamp();
    const normalizedPackageIds = normalizeStringList(packageIds);
    const packageIdSet =
      normalizedPackageIds.length > 0 ? new Set(normalizedPackageIds) : null;

    const releaseCandidates = await loadReleaseCandidates(
      db,
      resolvedShipmentIds,
      packageIdSet,
    );
    if (
      actorRole === "manager" &&
      releaseCandidates.some(
        (candidate) => !canAccessRecord(actor.user, candidate.data),
      )
    ) {
      throw new HttpsError(
        "permission-denied",
        "One or more shipments are outside your assigned warehouse or municipality.",
      );
    }

    const txResult = await db.runTransaction(async (tx) => {
      const releasedIds = [];
      const releasedPackageIds = [];
      const adminOverrideAuditEntries = [];
      let tripPublicId = normalizedTripId || null;

      if (normalizedTripId && useAdminOverride) {
        const tripRef = db.collection("truck_trips").doc(normalizedTripId);
        const tripSnap = await tx.get(tripRef);
        if (!tripSnap.exists) {
          throw new HttpsError(
            "not-found",
            `Trip not found: ${normalizedTripId}`,
          );
        }

        const tripData = tripSnap.data() || {};
        tripPublicId = tripData.tripId || normalizedTripId;
        const nowTs = admin.firestore.Timestamp.now();
        const tripUpdate = {
          updatedAt: now,
          updatedBy: actorName || actorUid || null,
        };

        if (tripReleaseDecision?.requiresArrivedPromotion) {
          tripUpdate.status = TRIP_STATUSES.ARRIVED;
          tripUpdate.arrivedAt = now;
        }

        tripUpdate.manifestStatus = MANIFEST_STATUS.RECONCILED;
        tripUpdate.reconciledAt = now;
        tripUpdate.reconciledBy = actorUid || null;
        tripUpdate.reconciledByName = actorName || null;
        tripUpdate.adminOverrideReleaseAt = now;
        tripUpdate.adminOverrideReleaseBy = actorUid || null;
        tripUpdate.adminOverrideReleaseByName = actorName || null;
        tripUpdate.reconciliationVariance = {
          missingPackages: normalizedMissingPackages.map((entry) => ({
            packageId: entry.packageId,
            shipmentDocId: entry.shipmentDocId,
            shipmentId: entry.shipmentId,
            pieceSuffix: entry.pieceSuffix,
            remark: resolveRemarkForMissingPackage(
              entry,
              normalizedMissingRemarks,
            ),
          })),
          releasedBy: actorName || actorUid || null,
          releasedAt: nowTs,
        };

        tx.update(tripRef, tripUpdate);

        const missingByShipment = new Map();
        for (const entry of normalizedMissingPackages) {
          const docId = entry.shipmentDocId;
          if (!missingByShipment.has(docId)) {
            missingByShipment.set(docId, []);
          }
          missingByShipment.get(docId).push(entry);
        }

        for (const [shipmentDocId, entries] of missingByShipment.entries()) {
          const packageEntries = entries.map((entry) => ({
            packageId: entry.packageId,
            shipmentId: entry.shipmentId,
            pieceSuffix: entry.pieceSuffix,
            remark: resolveRemarkForMissingPackage(
              entry,
              normalizedMissingRemarks,
            ),
          }));
          const combinedRemarks = packageEntries
            .map((entry) =>
              entry.remark ? `${entry.packageId}: ${entry.remark}` : null,
            )
            .filter(Boolean)
            .join(" | ");
          const tripShipmentRef = tripRef
            .collection("trip_shipments")
            .doc(shipmentDocId);

          tx.set(
            tripShipmentRef,
            {
              missingPackages: packageEntries,
              missingRemarks: combinedRemarks || null,
              missingOnReconciliation: true,
              adminOverrideResolved: true,
              updatedAt: now,
              updatedBy: actorName || actorUid || null,
            },
            { merge: true },
          );
        }

        for (const entry of normalizedMissingPackages) {
          adminOverrideAuditEntries.push({
            tripId: tripPublicId,
            missingPackageId: entry.packageId,
            shipmentId: entry.shipmentId,
            pieceSuffix: entry.pieceSuffix,
            reason: resolveRemarkForMissingPackage(
              entry,
              normalizedMissingRemarks,
            ),
          });
        }

        const overrideAmendmentEntries = normalizedMissingPackages.map(
          (entry) => ({
            changeType: "LATE_FOUND",
            shipmentId: entry.shipmentId,
            shipmentDocId: entry.shipmentDocId,
            packageId: entry.packageId,
            reason: resolveRemarkForMissingPackage(
              entry,
              normalizedMissingRemarks,
            ),
            recordedBy: actorUid || null,
            recordedByName: actorName || null,
          }),
        );

        sealManifestAmendment({
          tx,
          db,
          tripRef,
          trip: tripData,
          tripDocId: normalizedTripId,
          actorId: actorUid || null,
          actorName: actorName || actorUid || "Admin",
          actorRole: actorRole || "admin",
          reason:
            normalizeString(remarks) ||
            "Admin override release — missing packages documented in manifest addendum.",
          entries: overrideAmendmentEntries,
        });
      }

      for (const candidate of releaseCandidates) {
        const {
          shipmentId,
          data,
          sourcePackages,
          releaseScope,
          shipmentRef,
        } = candidate;

        const releaseNote = useAdminOverride
          ? normalizeString(remarks) ||
            "Admin override release with reconciliation variance."
          : normalizeString(remarks) ||
            "Released for delivery operations. Custody remains at Odiongan until each label is loaded.";

        const packageIdsForShipment = listPiecesEligibleForDeliveryRelease(
          sourcePackages,
          releaseScope,
        );

        const updatedPackages = mapPackagesForDeliveryRelease(
          sourcePackages,
          normalizedWarehouse,
          releaseScope,
        );

        const derivedSnapshot = buildDerivedShipmentSnapshot(updatedPackages, {
          previousStatus: data.status,
        });

        const effectiveStatus =
          derivedSnapshot.status === "RECEIVED"
            ? "AVAILABLE_FOR_DELIVERY"
            : derivedSnapshot.status;

        tx.update(shipmentRef, {
          packages: derivedSnapshot.packages,
          packageBreakdown: derivedSnapshot.packageBreakdown,
          availableForDelivery: derivedSnapshot.availableForDelivery,
          availableForDeliveryAt: now,
          availableForDeliveryBy: actorName || actorUid || null,
          releasedForDeliveryAt: now,
          releasedForDeliveryBy: actorName || actorUid || null,
          custodyOwnerType: "WAREHOUSE",
          custodyOwnerId: normalizedWarehouse,
          currentLocationState: normalizedWarehouse,
          assignedCheckerId: null,
          assignedCheckerName: null,
          activeCheckerIds: [],
          deliveryManifestId: null,
          status: effectiveStatus,
          updatedAt: now,
          updatedBy: actorName || actorUid || null,
          statusHistory: FieldValue.arrayUnion({
            status: "RELEASED_FOR_DELIVERY_OPERATIONS",
            at: admin.firestore.Timestamp.now(),
            by: actorName || actorUid || null,
            note: releaseNote,
            location: normalizedWarehouse,
          }),
        });

        releasedIds.push(shipmentId);
        releasedPackageIds.push(...packageIdsForShipment);
      }

      return {
        releasedIds,
        releasedPackageIds,
        adminOverrideAuditEntries,
        tripPublicId,
      };
    });

    const {
      releasedIds,
      releasedPackageIds,
      adminOverrideAuditEntries,
      tripPublicId,
    } = txResult;

    if (useAdminOverride && normalizedTripId && tripPublicId) {
      const auditTimestamp = new Date().toLocaleString("en-PH", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        second: "2-digit",
      });

      for (const entry of adminOverrideAuditEntries) {
        const auditNote = buildAdminOverrideAuditNote({
          tripId: entry.tripId,
          missingPackageId: entry.missingPackageId,
          shipmentId: entry.shipmentId,
          pieceSuffix: entry.pieceSuffix,
          reason: entry.reason,
          actorName: actorName || actorUid || "Admin",
          timestamp: auditTimestamp,
        });

        await writeCustodyAuditLog({
          db,
          action: "ADMIN_OVERRIDE_RELEASE",
          tripId: entry.tripId,
          tripDocId: normalizedTripId,
          targetId: normalizedTripId,
          targetCollection: "truck_trips",
          actorId: actorUid || null,
          actorName: actorName || null,
          actorRole: actorRole || "admin",
          reason: entry.reason,
          note: auditNote,
          meta: {
            missingPackageId: entry.missingPackageId,
            shipmentId: entry.shipmentId,
            pieceSuffix: entry.pieceSuffix || null,
            adminOverride: true,
          },
        });
      }

      await writeTripActionLog({
        db,
        action: "ADMIN_OVERRIDE_RELEASE",
        tripId: tripPublicId,
        tripDocId: normalizedTripId,
        actorId: actorUid || null,
        actorName: actorName || null,
        actorRole: actorRole || "admin",
        details: {
          missingPackages: adminOverrideAuditEntries,
          releasedShipmentCount: releasedIds.length,
          releasedPackageCount: releasedPackageIds.length,
        },
        meta: {
          adminOverride: true,
        },
      });
    }

    await Promise.all(
      releasedIds.map((shipmentId) =>
        writeShipmentEvent({
          db,
          event: {
            shipmentId,
            eventType: EVENT_TYPES.RELEASED_FOR_DELIVERY_OPERATIONS,
            warehouseManagerId: actorUid || null,
            warehouseManagerName: actorName || null,
            location: normalizedWarehouse,
            remarks:
              normalizeString(remarks) ||
              "Inventory visible to checkers; warehouse custody until load scan.",
            createdBy: actorUid || null,
            createdByRole: actorRole || "manager",
            source: "release_for_delivery_operations",
          },
        }),
      ),
    );

    return {
      success: true,
      warehouseCode: normalizedWarehouse,
      shipmentIds: releasedIds,
      shipmentCount: releasedIds.length,
      packageIds: releasedPackageIds,
      packageCount: releasedPackageIds.length,
      adminOverride: useAdminOverride,
    };
    } catch (error) {
      if (error instanceof HttpsError) throw error;
      console.error("releaseForDeliveryOperations failed:", error);
      throw new HttpsError(
        "internal",
        error?.message || "Release for delivery operations failed.",
      );
    }
  },
);
