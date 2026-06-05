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
} = require("./packageDeliveryOperations");
const { buildDerivedShipmentSnapshot } = require("../packages/shipmentStatus");
const { assertTripReleaseEligible } = require("../trips/tripLifecycle");

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

exports.releaseForDeliveryOperations = onCall(
  { region: "asia-southeast1", maxInstances: 10 },
  async (req) => {
    await requireRole(db, req, ["admin", "manager"]);

    const { uid: actorUid, name: actorName, role: actorRole } = updatedBy(req);
    const {
      shipmentIds,
      packageIds,
      tripId = null,
      warehouseCode = DEFAULT_WAREHOUSE_CODE,
      remarks = null,
    } = req.data || {};

    const resolvedShipmentIds = await resolveShipmentIdsWithTrip(db, {
      shipmentIds,
      packageIds,
      tripId,
    });

    const normalizedTripId = normalizeString(tripId);
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
      assertTripReleaseEligible(tripSnap.data() || {});
    }

    const normalizedWarehouse =
      normalizeString(warehouseCode) || DEFAULT_WAREHOUSE_CODE;
    const now = FieldValue.serverTimestamp();
    const releasedIds = [];
    const releasedPackageIds = [];
    const normalizedPackageIds = normalizeStringList(packageIds);
    const packageIdSet =
      normalizedPackageIds.length > 0 ? new Set(normalizedPackageIds) : null;

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
          throw new HttpsError(
            "not-found",
            `Shipment not found: ${shipmentId}`,
          );
        }

        const data = snap.data() || {};
        assertEligibleForDeliveryOperationsRelease(shipmentId, data.status);

        const releaseNote =
          normalizeString(remarks) ||
          "Released for delivery operations. Custody remains at Odiongan until each label is loaded.";

        const sourcePackages = Array.isArray(data.packages) ? data.packages : [];
        const releaseScope = { packageIdSet };
        const releasableCount = countPiecesEligibleForDeliveryRelease(
          sourcePackages,
          releaseScope,
        );
        if (releasableCount === 0) {
          throw new HttpsError(
            "failed-precondition",
            `Shipment ${shipmentId} has no hub-received packages to release. Unload and reconcile at Odiongan first.`,
          );
        }

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

        tx.update(shipmentRefs[index], {
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
      });
    });

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
    };
  },
);
