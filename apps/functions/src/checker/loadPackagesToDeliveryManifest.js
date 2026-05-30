"use strict";

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const { FieldValue } = require("firebase-admin/firestore");
const { requireRole } = require("../utilities/helpers");
const { writeShipmentEvent } = require("../tracking/writeShipmentEvent");
const { EVENT_TYPES } = require("../tracking/eventTypes");

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

exports.loadPackagesToDeliveryManifest = onCall(
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
      manifestId = null,
      deliveryVehicleId = null,
      deliveryVehicleName = null,
      location = null,
      gpsCoordinates = null,
      remarks = null,
    } = req.data || {};

    const resolvedShipmentIds = await resolveShipmentIds({
      shipmentIds,
      packageIds,
    });

    const now = FieldValue.serverTimestamp();
    const normalizedManifestId = normalizeString(manifestId);

    let loadedShipmentIds = [];
    let manifestRefId = null;
    let resolvedVehicleId = null;
    let resolvedVehicleName = null;
    let checkerName = actorName || null;

    await db.runTransaction(async (tx) => {
      const actorRef = db.collection("users").doc(actorUid);
      const actorSnap = await tx.get(actorRef);
      if (actorSnap.exists) {
        const actorData = actorSnap.data() || {};
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

      let sharedManifestId = normalizedManifestId;
      const packageIdsForManifest = new Set();

      shipmentSnaps.forEach((snap, index) => {
        if (!snap.exists) {
          throw new HttpsError(
            "not-found",
            `Shipment not found: ${resolvedShipmentIds[index]}`,
          );
        }
        const data = snap.data() || {};
        const assignedCheckerId = normalizeString(data.assignedCheckerId);
        if (assignedCheckerId !== actorUid) {
          throw new HttpsError(
            "permission-denied",
            `Shipment ${resolvedShipmentIds[index]} is not assigned to you.`,
          );
        }
        const shipmentManifestId = normalizeString(data.deliveryManifestId);
        if (!shipmentManifestId) {
          throw new HttpsError(
            "failed-precondition",
            `Shipment ${resolvedShipmentIds[index]} has no delivery manifest. It must be released by warehouse first.`,
          );
        }
        if (!sharedManifestId) {
          sharedManifestId = shipmentManifestId;
        } else if (sharedManifestId !== shipmentManifestId) {
          throw new HttpsError(
            "failed-precondition",
            "All shipments in one load action must belong to the same delivery manifest.",
          );
        }

        const status = String(data.status || "").toUpperCase();
        if (status === "DELIVERED") {
          throw new HttpsError(
            "failed-precondition",
            `Shipment ${resolvedShipmentIds[index]} is already delivered.`,
          );
        }

        (Array.isArray(data.packageBarcodes) ? data.packageBarcodes : []).forEach(
          (barcode) => {
            if (typeof barcode === "string" && barcode.trim()) {
              packageIdsForManifest.add(barcode.trim());
            }
          },
        );
      });

      if (!sharedManifestId) {
        throw new HttpsError(
          "failed-precondition",
          "Could not resolve delivery manifest for selected shipments.",
        );
      }

      manifestRefId = sharedManifestId;
      const manifestRef = db.collection("delivery_manifests").doc(manifestRefId);
      const manifestSnap = await tx.get(manifestRef);
      if (!manifestSnap.exists) {
        throw new HttpsError("not-found", "Delivery manifest not found.");
      }

      const manifestData = manifestSnap.data() || {};
      if (normalizeString(manifestData.checkerId) !== actorUid) {
        throw new HttpsError(
          "permission-denied",
          "This delivery manifest belongs to another checker.",
        );
      }

      resolvedVehicleId =
        normalizeString(deliveryVehicleId) ||
        normalizeString(manifestData.deliveryVehicleId) ||
        normalizeString(shipmentSnaps[0]?.data()?.deliveryVehicleId);
      resolvedVehicleName =
        normalizeString(deliveryVehicleName) ||
        normalizeString(manifestData.deliveryVehicleName) ||
        normalizeString(shipmentSnaps[0]?.data()?.deliveryVehicleName);

      if (!resolvedVehicleId && !resolvedVehicleName) {
        throw new HttpsError(
          "failed-precondition",
          "Delivery vehicle is required before loading packages.",
        );
      }

      const effectiveShipmentIds = [];

      shipmentSnaps.forEach((snap, index) => {
        const shipmentRef = shipmentRefs[index];
        const shipmentData = snap.data() || {};
        const shipmentId = resolvedShipmentIds[index];

        tx.update(shipmentRef, {
          deliveryManifestId: manifestRefId,
          deliveryVehicleId: resolvedVehicleId,
          deliveryVehicleName: resolvedVehicleName,
          custodyOwnerType: "DELIVERY_VEHICLE",
          custodyOwnerId: resolvedVehicleId || manifestRefId,
          currentLocationState: "DELIVERY_VEHICLE_LOADED",
          status: "READY_FOR_DELIVERY",
          updatedAt: now,
          updatedBy: actorName || actorUid || null,
          statusHistory: FieldValue.arrayUnion({
            status: "LOADED_TO_DELIVERY_VEHICLE",
            at: admin.firestore.Timestamp.now(),
            by: actorName || actorUid || null,
            note: remarks || "Loaded onto delivery vehicle.",
            location: location || null,
          }),
        });

        effectiveShipmentIds.push(shipmentId);
      });

      const manifestUpdate = {
        status: "LOADED",
        loadedAt: now,
        deliveryVehicleId: resolvedVehicleId,
        deliveryVehicleName: resolvedVehicleName,
        loadedShipmentIds: FieldValue.arrayUnion(...effectiveShipmentIds),
        updatedAt: now,
        updatedBy: actorName || actorUid || null,
      };

      if (packageIdsForManifest.size > 0) {
        manifestUpdate.loadedPackageIds = FieldValue.arrayUnion(
          ...packageIdsForManifest,
        );
      }

      tx.set(manifestRef, manifestUpdate, { merge: true });

      loadedShipmentIds = effectiveShipmentIds;
    });

    await Promise.all(
      loadedShipmentIds.map((shipmentId) =>
        writeShipmentEvent({
          db,
          event: {
            shipmentId,
            eventType: EVENT_TYPES.LOADED_TO_DELIVERY_VEHICLE,
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
      shipmentCount: loadedShipmentIds.length,
    };
  },
);
