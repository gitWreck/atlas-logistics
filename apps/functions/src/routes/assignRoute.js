"use strict";

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const { FieldValue } = require("firebase-admin/firestore");
const { requireDeliveryRouteAssignmentAccess } = require("../utilities/helpers");
const { writeCustodyAuditLog } = require("../utilities/custodyAuditLog");
const {
  buildDerivedShipmentSnapshot,
} = require("../packages/shipmentStatus");
const {
  PACKAGE_STATUS,
  isReleasedForDeliveryPool,
  normalizePackageStatus,
} = require("../packages/packageStatus");
const { getPackageIdentity } = require("../warehouse/packageDeliveryOperations");
const {
  fetchActiveDailyAssignments,
  resolveAssignmentDate,
  buildDailyAssignmentDoc,
} = require("./dailyRouteAssignmentHelpers");
const {
  DEFAULT_WAREHOUSE_ID,
  ensureDefaultOdionganRoutes,
  normalizeMunicipality,
  normalizeString,
  normalizeStringList,
  resolveRecipientMunicipality,
  resolveRouteSelectionForMunicipality,
} = require("./routeHelpers");

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

function isTerminalPiece(pkg = {}) {
  const status = normalizePackageStatus(pkg);
  return [
    PACKAGE_STATUS.DELIVERED,
    PACKAGE_STATUS.COMPLETED,
    PACKAGE_STATUS.MISSING,
    PACKAGE_STATUS.DAMAGED,
    PACKAGE_STATUS.CANCELLED,
  ].includes(status);
}

function isPieceEligibleForRouteAssignment(pkg = {}) {
  if (isTerminalPiece(pkg)) return false;

  const loadedBy = String(pkg.loadedByCheckerId || "").trim();
  if (loadedBy) return false;

  const status = normalizePackageStatus(pkg);
  if (status === PACKAGE_STATUS.ROUTE_ASSIGNED) return true;
  if (isReleasedForDeliveryPool(pkg)) return true;

  return (
    pkg.availableForDelivery === true &&
    [
      PACKAGE_STATUS.RELEASED_FOR_DELIVERY,
      PACKAGE_STATUS.AVAILABLE_AT_ODIONGAN_WAREHOUSE,
      PACKAGE_STATUS.AVAILABLE_AT_WAREHOUSE,
    ].includes(status)
  );
}

function pieceMatchesScope(pkg = {}, packageIdSet = null) {
  if (!packageIdSet || packageIdSet.size === 0) return true;
  const identity = getPackageIdentity(pkg);
  return identity ? packageIdSet.has(identity) : false;
}

async function resolveShipmentDocIds(shipmentIds = []) {
  const normalizedIds = normalizeStringList(shipmentIds);
  if (!normalizedIds.length) return [];

  const resolved = new Set();

  await Promise.all(
    normalizedIds.map(async (id) => {
      const directSnap = await db.collection("shipments").doc(id).get();
      if (directSnap.exists) {
        resolved.add(directSnap.id);
        return;
      }

      const byFieldSnap = await db
        .collection("shipments")
        .where("shipmentId", "==", id)
        .limit(1)
        .get();

      if (!byFieldSnap.empty) {
        resolved.add(byFieldSnap.docs[0].id);
      }
    }),
  );

  return [...resolved];
}

async function resolveShipmentIds({ shipmentIds, packageIds }) {
  const normalizedShipmentIds = normalizeStringList(shipmentIds);
  if (normalizedShipmentIds.length > 0) {
    return resolveShipmentDocIds(normalizedShipmentIds);
  }

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
      if (!snap.empty) {
        resolvedIds.add(snap.docs[0].id);
      }
    }),
  );

  return [...resolvedIds];
}

async function fetchActiveRoutes(warehouseId = DEFAULT_WAREHOUSE_ID) {
  await ensureDefaultOdionganRoutes(db, warehouseId);

  const snap = await db
    .collection("routes")
    .where("warehouseId", "==", warehouseId)
    .where("active", "==", true)
    .get();

  return snap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
}

async function fetchRouteById(routeId, warehouseId = DEFAULT_WAREHOUSE_ID) {
  const normalizedRouteId = normalizeString(routeId);
  if (!normalizedRouteId) return null;

  const directSnap = await db.collection("routes").doc(normalizedRouteId).get();
  if (directSnap.exists) {
    const data = directSnap.data() || {};
    if (data.active === false) return null;
    if (
      normalizeString(data.warehouseId) &&
      normalizeString(data.warehouseId) !== warehouseId
    ) {
      return null;
    }
    return { id: directSnap.id, ...data };
  }

  const querySnap = await db
    .collection("routes")
    .where("routeId", "==", normalizedRouteId)
    .limit(1)
    .get();

  if (querySnap.empty) return null;
  const docSnap = querySnap.docs[0];
  const data = docSnap.data() || {};
  if (data.active === false) return null;
  return { id: docSnap.id, ...data };
}

async function resolveTargetShipmentIds({
  shipmentIds,
  packageIds,
  municipality,
  warehouseId,
}) {
  const explicitIds = await resolveShipmentIds({ shipmentIds, packageIds });
  if (explicitIds.length > 0) return explicitIds;

  const normalizedMunicipality = normalizeString(municipality);
  if (!normalizedMunicipality) return [];

  const poolSnap = await db
    .collection("shipments")
    .where("availableForDelivery", "==", true)
    .limit(500)
    .get();

  const target = normalizeMunicipality(normalizedMunicipality);
  const matched = [];

  poolSnap.docs.forEach((docSnap) => {
    const data = docSnap.data() || {};
    const recipientCity = resolveRecipientMunicipality(data);
    if (normalizeMunicipality(recipientCity) !== target) return;

    const warehouse = normalizeString(data.custodyOwnerId) || "";
    if (
      warehouse &&
      warehouse !== warehouseId &&
      !warehouse.includes("ODIONGAN")
    ) {
      return;
    }

    matched.push(docSnap.id);
  });

  return matched;
}

function applyRouteToPiece(
  pkg = {},
  route = {},
  {
    actorName,
    actorUid,
    nowIso,
    confirmed = true,
    checkerId = null,
    checkerName = null,
    vehicleId = null,
    vehicleName = null,
  },
) {
  const routeId = normalizeString(route.routeId) || normalizeString(route.id);
  const routeName =
    normalizeString(route.routeName) || routeId || "Unknown route";

  if (!confirmed) {
    return {
      ...pkg,
      suggestedRouteId: routeId,
      suggestedRouteName: routeName,
    };
  }

  const next = {
    ...pkg,
    assignedRouteId: routeId,
    assignedRouteName: routeName,
    suggestedRouteId: null,
    suggestedRouteName: null,
    routeAssignedAt: nowIso,
    routeAssignedBy: actorName || actorUid || null,
    availableForDelivery: true,
    status: PACKAGE_STATUS.ROUTE_ASSIGNED,
    updatedAt: nowIso,
  };

  if (checkerId) {
    next.assignedCheckerId = checkerId;
    next.assignedCheckerName = checkerName || null;
    next.checkerAssignedAt = nowIso;
  }
  if (vehicleId) {
    next.assignedVehicleId = vehicleId;
    next.assignedVehicleName = vehicleName || null;
  }

  return next;
}

exports.assignRoute = onCall(
  { region: "asia-southeast1", maxInstances: 10 },
  async (req) => {
    const actor = await requireDeliveryRouteAssignmentAccess(db, req);
    const {
      routeId = null,
      shipmentIds = [],
      packageIds = [],
      municipality = null,
      warehouseId = DEFAULT_WAREHOUSE_ID,
      suggestOnly = false,
      confirm = true,
      checkerId = null,
      vehicleId = null,
      vehicleName = null,
      createDailyAssignment = true,
    } = req.data || {};

    const normalizedWarehouse = normalizeString(warehouseId) || DEFAULT_WAREHOUSE_ID;
    const packageIdSet = new Set(normalizeStringList(packageIds));
    const hasPieceScope = packageIdSet.size > 0;
    const isConfirmed = confirm !== false && !suggestOnly;

    const targetShipmentIds = await resolveTargetShipmentIds({
      shipmentIds,
      packageIds,
      municipality,
      warehouseId: normalizedWarehouse,
    });

    if (targetShipmentIds.length === 0) {
      throw new HttpsError(
        "invalid-argument",
        "Provide shipmentIds, packageIds, or municipality with pool packages.",
      );
    }

    const activeRoutes = await fetchActiveRoutes(normalizedWarehouse);

    let selectedRoute = null;
    if (routeId) {
      selectedRoute = await fetchRouteById(routeId, normalizedWarehouse);
      if (!selectedRoute) {
        throw new HttpsError("not-found", `Route ${routeId} not found.`);
      }
    }

    const nowIso = new Date().toISOString();
    const assignedPackageIds = [];
    const skippedPackageIds = [];
    const suggestions = [];
    const updatedShipmentIds = [];
    const errors = [];
    const assignedRouteIds = new Set();

    const normalizedCheckerId = normalizeString(checkerId);
    let resolvedCheckerName = null;
    let resolvedVehicleId = normalizeString(vehicleId);
    let resolvedVehicleName = normalizeString(vehicleName);

    if (normalizedCheckerId) {
      const checkerSnap = await db
        .collection("users")
        .doc(normalizedCheckerId)
        .get();
      if (!checkerSnap.exists || checkerSnap.data()?.active !== true) {
        throw new HttpsError("not-found", "Checker not found or inactive.");
      }
      const checkerData = checkerSnap.data() || {};
      if (String(checkerData.role || "").toLowerCase() !== "checker") {
        throw new HttpsError(
          "failed-precondition",
          "Selected user is not a checker.",
        );
      }
      resolvedCheckerName =
        checkerData.fullName ||
        checkerData.name ||
        checkerData.displayName ||
        "Checker";
      resolvedVehicleId =
        resolvedVehicleId ||
        normalizeString(checkerData.deliveryVehicleId) ||
        normalizeString(checkerData.vehicleId) ||
        `CHECKER_${normalizedCheckerId}`;
      resolvedVehicleName =
        resolvedVehicleName ||
        normalizeString(checkerData.deliveryVehicleName) ||
        normalizeString(checkerData.vehicleName) ||
        `${resolvedCheckerName}'s van`;
    }

    await db.runTransaction(async (tx) => {
      const shipmentSnaps = await Promise.all(
        targetShipmentIds.map((id) =>
          tx.get(db.collection("shipments").doc(id)),
        ),
      );

      shipmentSnaps.forEach((snap, index) => {
        const shipmentId = targetShipmentIds[index];
        if (!snap.exists) {
          errors.push(`Shipment ${shipmentId} not found`);
          return;
        }

        const shipmentData = snap.data() || {};
        const packages = Array.isArray(shipmentData.packages)
          ? shipmentData.packages
          : [];
        const recipientMunicipality = resolveRecipientMunicipality(shipmentData);

        let routeForShipment = selectedRoute;
        if (!routeForShipment && recipientMunicipality) {
          const selection = resolveRouteSelectionForMunicipality(
            activeRoutes,
            recipientMunicipality,
          );
          routeForShipment = selection.route;

          if (!routeForShipment && selection.matches.length > 1) {
            suggestions.push({
              shipmentId,
              municipality: recipientMunicipality,
              suggestedRoutes: selection.matches.map((route) => ({
                routeId: route.routeId,
                routeName: route.routeName,
              })),
              reason: selection.reason,
            });
          }
        }

        if (!routeForShipment) {
          if (suggestOnly) {
            const selection = resolveRouteSelectionForMunicipality(
              activeRoutes,
              recipientMunicipality,
            );
            suggestions.push({
              shipmentId,
              municipality: recipientMunicipality,
              suggestedRouteId: selection.route?.routeId || null,
              suggestedRouteName: selection.route?.routeName || null,
              suggestedRoutes: selection.matches.map((route) => ({
                routeId: route.routeId,
                routeName: route.routeName,
              })),
              reason: selection.reason,
            });
          } else {
            const selection = resolveRouteSelectionForMunicipality(
              activeRoutes,
              recipientMunicipality,
            );
            const routeNames = selection.matches
              .map((route) => route.routeName)
              .filter(Boolean)
              .join(", ");
            errors.push(
              selection.reason ||
                (routeNames
                  ? `No route selected for shipment ${shipmentId}. Matching routes: ${routeNames}. Pick one from the dropdown.`
                  : `No route selected for shipment ${shipmentId}. Pick a route from the dropdown.`),
            );
          }
          return;
        }

        if (suggestOnly) {
          suggestions.push({
            shipmentId,
            municipality: recipientMunicipality,
            suggestedRouteId: routeForShipment.routeId,
            suggestedRouteName: routeForShipment.routeName,
          });
          return;
        }

        let assignedCount = 0;
        const updatedPackages = packages.map((pkg) => {
          if (!pieceMatchesScope(pkg, hasPieceScope ? packageIdSet : null)) {
            return pkg;
          }

          const identity = getPackageIdentity(pkg);
          if (!isPieceEligibleForRouteAssignment(pkg)) {
            if (hasPieceScope && identity && packageIdSet.has(identity)) {
              skippedPackageIds.push(identity);
            }
            return pkg;
          }

          const existingRouteId = normalizeString(pkg.assignedRouteId);
          if (
            existingRouteId === routeForShipment.routeId &&
            normalizePackageStatus(pkg) === PACKAGE_STATUS.ROUTE_ASSIGNED
          ) {
            return pkg;
          }

          assignedCount += 1;
          if (identity) assignedPackageIds.push(identity);

          return applyRouteToPiece(pkg, routeForShipment, {
            actorName: actor.name,
            actorUid: actor.uid,
            nowIso,
            confirmed: isConfirmed,
            checkerId: normalizedCheckerId,
            checkerName: resolvedCheckerName,
            vehicleId: resolvedVehicleId,
            vehicleName: resolvedVehicleName,
          });
        });

        if (assignedCount === 0) {
          errors.push(
            `No eligible pool pieces to assign on shipment ${shipmentId}.`,
          );
          return;
        }

        const derivedSnapshot = buildDerivedShipmentSnapshot(updatedPackages, {
          previousStatus: shipmentData.status,
        });

        assignedRouteIds.add(routeForShipment.routeId);

        tx.update(snap.ref, {
          packages: derivedSnapshot.packages,
          packageBreakdown: derivedSnapshot.packageBreakdown,
          availableForDelivery: derivedSnapshot.availableForDelivery,
          assignedRouteId: routeForShipment.routeId,
          assignedRouteName: routeForShipment.routeName,
          routeAssignedAt: nowIso,
          routeAssignedBy: actor.name || actor.uid,
          assignedCheckerId:
            normalizedCheckerId || shipmentData.assignedCheckerId || null,
          assignedCheckerName:
            resolvedCheckerName || shipmentData.assignedCheckerName || null,
          deliveryVehicleId:
            resolvedVehicleId || shipmentData.deliveryVehicleId || null,
          deliveryVehicleName:
            resolvedVehicleName || shipmentData.deliveryVehicleName || null,
          updatedAt: FieldValue.serverTimestamp(),
          updatedBy: actor.name || actor.uid,
          status: derivedSnapshot.status,
        });

        updatedShipmentIds.push(shipmentId);
      });
    });

    if (suggestOnly) {
      return {
        success: true,
        suggestOnly: true,
        suggestions,
        errors,
      };
    }

    if (updatedShipmentIds.length === 0) {
      throw new HttpsError(
        "failed-precondition",
        errors.join(" ") || "No packages were assigned to a route.",
      );
    }

    await Promise.all(
      updatedShipmentIds.map((shipmentId) =>
        writeCustodyAuditLog({
          db,
          action: "ASSIGN_DELIVERY_ROUTE",
          targetCollection: "shipments",
          targetId: shipmentId,
          actorId: actor.uid,
          actorName: actor.name,
          actorRole: actor.role,
          newValue: {
            routeId: selectedRoute?.routeId || null,
            checkerId: normalizedCheckerId,
            packageIds: assignedPackageIds,
            municipality: normalizeString(municipality),
          },
        }),
      ),
    );

    if (normalizedCheckerId && createDailyAssignment) {
      const routeIdsForAssignment =
        selectedRoute?.routeId
          ? [selectedRoute.routeId]
          : [...assignedRouteIds];

      await Promise.all(
        routeIdsForAssignment.map(async (assignedRouteId) => {
          const routeDoc = await fetchRouteById(
            assignedRouteId,
            normalizedWarehouse,
          );
          if (!routeDoc) return;

          await db.collection("daily_route_assignments").add(
            buildDailyAssignmentDoc({
              warehouseId: normalizedWarehouse,
              routeId: routeDoc.routeId,
              routeName: routeDoc.routeName,
              checkerId: normalizedCheckerId,
              checkerName: resolvedCheckerName,
              vehicleId: resolvedVehicleId,
              vehicleName: resolvedVehicleName,
              actorUid: actor.uid,
              actorName: actor.name,
            }),
          );
        }),
      );
    }

    return {
      success: true,
      assignedShipmentIds: updatedShipmentIds,
      assignedPackageIds,
      skippedPackageIds,
      suggestions,
      errors,
    };
  },
);
