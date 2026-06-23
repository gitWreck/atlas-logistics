"use strict";

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const { FieldValue } = require("firebase-admin/firestore");
const { requireDeliveryRouteAssignmentAccess } = require("../utilities/helpers");
const { writeCustodyAuditLog } = require("../utilities/custodyAuditLog");
const { buildDerivedShipmentSnapshot } = require("../packages/shipmentStatus");
const {
  PACKAGE_STATUS,
  isReleasedForDeliveryPool,
  normalizePackageStatus,
} = require("../packages/packageStatus");
const { getPackageIdentity } = require("../warehouse/packageDeliveryOperations");
const {
  DEFAULT_WAREHOUSE_ID,
  normalizeString,
  normalizeStringList,
} = require("./routeHelpers");
const {
  ACTIVE_ASSIGNMENT_STATUS,
  buildDailyAssignmentDoc,
  fetchActiveDailyAssignments,
  resolveAssignmentDate,
} = require("./dailyRouteAssignmentHelpers");

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

async function fetchRouteById(routeId, warehouseId = DEFAULT_WAREHOUSE_ID) {
  const normalizedRouteId = normalizeString(routeId);
  if (!normalizedRouteId) return null;

  const directSnap = await db.collection("routes").doc(normalizedRouteId).get();
  if (directSnap.exists) {
    const data = directSnap.data() || {};
    if (data.active === false) return null;
    return { id: directSnap.id, ...data };
  }

  const querySnap = await db
    .collection("routes")
    .where("routeId", "==", normalizedRouteId)
    .limit(1)
    .get();

  if (querySnap.empty) return null;
  return { id: querySnap.docs[0].id, ...querySnap.docs[0].data() };
}

async function resolveShipmentIds({ shipmentIds, packageIds }) {
  const normalizedShipmentIds = normalizeStringList(shipmentIds);
  if (normalizedShipmentIds.length > 0) return normalizedShipmentIds;

  const normalizedPackageIds = normalizeStringList(packageIds);
  if (normalizedPackageIds.length === 0) return [];

  const resolvedIds = new Set();
  await Promise.all(
    normalizedPackageIds.map(async (packageId) => {
      const snap = await db
        .collection("shipments")
        .where("packageBarcodes", "array-contains", packageId)
        .limit(1)
        .get();
      if (!snap.empty) resolvedIds.add(snap.docs[0].id);
    }),
  );

  return [...resolvedIds];
}

function isPieceEligibleForCheckerAssignment(pkg = {}) {
  const status = normalizePackageStatus(pkg);
  if (["DELIVERED", "COMPLETED", "MISSING", "DAMAGED", "CANCELLED"].includes(status)) {
    return false;
  }
  if (String(pkg.loadedByCheckerId || "").trim()) return false;
  if (!normalizeString(pkg.assignedRouteId)) return false;
  return (
    status === PACKAGE_STATUS.ROUTE_ASSIGNED ||
    isReleasedForDeliveryPool(pkg) ||
    pkg.availableForDelivery === true
  );
}

function applyCheckerToPiece(
  pkg = {},
  {
    checkerId,
    checkerName,
    vehicleId = null,
    vehicleName = null,
    nowIso,
  },
) {
  return {
    ...pkg,
    assignedCheckerId: checkerId,
    assignedCheckerName: checkerName,
    assignedVehicleId: vehicleId || pkg.assignedVehicleId || null,
    assignedVehicleName: vehicleName || pkg.assignedVehicleName || null,
    checkerAssignedAt: nowIso,
    updatedAt: nowIso,
  };
}

exports.assignCheckerToRoute = onCall(
  { region: "asia-southeast1", maxInstances: 10 },
  async (req) => {
    const actor = await requireDeliveryRouteAssignmentAccess(db, req);
    const {
      routeId,
      checkerId,
      vehicleId = null,
      vehicleName = null,
      date = null,
      warehouseId = DEFAULT_WAREHOUSE_ID,
      shipmentIds = [],
      packageIds = [],
      assignPoolPieces = true,
      replaceExisting = true,
    } = req.data || {};

    const normalizedRouteId = normalizeString(routeId);
    const normalizedCheckerId = normalizeString(checkerId);
    if (!normalizedRouteId || !normalizedCheckerId) {
      throw new HttpsError(
        "invalid-argument",
        "routeId and checkerId are required.",
      );
    }

    const normalizedWarehouse = normalizeString(warehouseId) || DEFAULT_WAREHOUSE_ID;
    const assignmentDate = resolveAssignmentDate(date);
    const route = await fetchRouteById(normalizedRouteId, normalizedWarehouse);
    if (!route) {
      throw new HttpsError("not-found", `Route ${normalizedRouteId} not found.`);
    }

    const checkerSnap = await db.collection("users").doc(normalizedCheckerId).get();
    if (!checkerSnap.exists || checkerSnap.data()?.active !== true) {
      throw new HttpsError("not-found", "Checker not found or inactive.");
    }
    const checkerData = checkerSnap.data() || {};
    if (String(checkerData.role || "").toLowerCase() !== "checker") {
      throw new HttpsError("failed-precondition", "Selected user is not a checker.");
    }

    const checkerName =
      checkerData.fullName ||
      checkerData.name ||
      checkerData.displayName ||
      "Checker";

    const resolvedVehicleId =
      normalizeString(vehicleId) ||
      normalizeString(checkerData.deliveryVehicleId) ||
      normalizeString(checkerData.vehicleId) ||
      `CHECKER_${normalizedCheckerId}`;
    const resolvedVehicleName =
      normalizeString(vehicleName) ||
      normalizeString(checkerData.deliveryVehicleName) ||
      normalizeString(checkerData.vehicleName) ||
      `${checkerName}'s van`;

    const nowIso = new Date().toISOString();
    let assignmentRefId = null;
    const updatedShipmentIds = [];
    const updatedPackageIds = [];

    const explicitShipmentIds = await resolveShipmentIds({
      shipmentIds,
      packageIds,
    });
    const packageIdSet = new Set(normalizeStringList(packageIds));

    await db.runTransaction(async (tx) => {
      if (replaceExisting) {
        const existingQuery = db
          .collection("daily_route_assignments")
          .where("date", "==", assignmentDate)
          .where("checkerId", "==", normalizedCheckerId)
          .where("status", "==", ACTIVE_ASSIGNMENT_STATUS);

        const existingSnap = await tx.get(existingQuery);
        existingSnap.docs.forEach((docSnap) => {
          tx.update(docSnap.ref, {
            status: "REPLACED",
            replacedAt: FieldValue.serverTimestamp(),
            replacedBy: actor.name || actor.uid,
          });
        });
      }

      const assignmentRef = db.collection("daily_route_assignments").doc();
      assignmentRefId = assignmentRef.id;
      tx.set(
        assignmentRef,
        buildDailyAssignmentDoc({
          date: assignmentDate,
          warehouseId: normalizedWarehouse,
          routeId: route.routeId,
          routeName: route.routeName,
          checkerId: normalizedCheckerId,
          checkerName,
          vehicleId: resolvedVehicleId,
          vehicleName: resolvedVehicleName,
          actorUid: actor.uid,
          actorName: actor.name,
        }),
      );

      if (!assignPoolPieces) return;

      let shipmentSnaps = [];
      if (explicitShipmentIds.length > 0) {
        shipmentSnaps = await Promise.all(
          explicitShipmentIds.map((id) =>
            tx.get(db.collection("shipments").doc(id)),
          ),
        );
      } else {
        const poolSnap = await tx.get(
          db
            .collection("shipments")
            .where("availableForDelivery", "==", true)
            .limit(500),
        );
        shipmentSnaps = poolSnap.docs;
      }

      shipmentSnaps.forEach((snap) => {
        if (!snap.exists) return;
        const shipmentData = snap.data() || {};
        const packages = Array.isArray(shipmentData.packages)
          ? shipmentData.packages
          : [];

        let changed = false;
        const updatedPackages = packages.map((pkg) => {
          if (
            normalizeString(pkg.assignedRouteId) !== normalizeString(route.routeId)
          ) {
            return pkg;
          }

          if (packageIdSet.size > 0) {
            const identity = getPackageIdentity(pkg);
            if (!identity || !packageIdSet.has(identity)) return pkg;
          }

          if (!isPieceEligibleForCheckerAssignment(pkg)) return pkg;

          const identity = getPackageIdentity(pkg);
          if (identity) updatedPackageIds.push(identity);
          changed = true;

          return applyCheckerToPiece(pkg, {
            checkerId: normalizedCheckerId,
            checkerName,
            vehicleId: resolvedVehicleId,
            vehicleName: resolvedVehicleName,
            nowIso,
          });
        });

        if (!changed) return;

        const derivedSnapshot = buildDerivedShipmentSnapshot(updatedPackages, {
          previousStatus: shipmentData.status,
        });

        tx.update(snap.ref, {
          packages: derivedSnapshot.packages,
          packageBreakdown: derivedSnapshot.packageBreakdown,
          availableForDelivery: derivedSnapshot.availableForDelivery,
          assignedCheckerId: normalizedCheckerId,
          assignedCheckerName: checkerName,
          deliveryVehicleId: resolvedVehicleId,
          deliveryVehicleName: resolvedVehicleName,
          updatedAt: FieldValue.serverTimestamp(),
          updatedBy: actor.name || actor.uid,
          status: derivedSnapshot.status,
        });
        updatedShipmentIds.push(snap.id);
      });
    });

    await writeCustodyAuditLog({
      db,
      action: "ASSIGN_CHECKER_TO_ROUTE",
      targetCollection: "daily_route_assignments",
      targetId: assignmentRefId,
      actorId: actor.uid,
      actorName: actor.name,
      actorRole: actor.role,
      newValue: {
        date: assignmentDate,
        routeId: route.routeId,
        routeName: route.routeName,
        checkerId: normalizedCheckerId,
        checkerName,
        vehicleId: resolvedVehicleId,
        vehicleName: resolvedVehicleName,
        updatedShipmentIds,
        updatedPackageIds,
      },
    });

    return {
      success: true,
      assignmentId: assignmentRefId,
      date: assignmentDate,
      routeId: route.routeId,
      routeName: route.routeName,
      checkerId: normalizedCheckerId,
      checkerName,
      vehicleId: resolvedVehicleId,
      vehicleName: resolvedVehicleName,
      updatedShipmentIds,
      updatedPackageIds,
    };
  },
);
