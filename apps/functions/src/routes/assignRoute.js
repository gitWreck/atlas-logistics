"use strict";

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const { FieldValue } = require("firebase-admin/firestore");
const { updatedBy } = require("../utilities/helpers");
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
  DEFAULT_WAREHOUSE_ID,
  findRoutesForMunicipality,
  normalizeMunicipality,
  normalizeString,
  normalizeStringList,
  resolveRecipientMunicipality,
} = require("./routeHelpers");

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

const ROUTE_ASSIGNMENT_ROLES = ["admin", "manager"];

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

async function requireRouteAssignmentRole(dbRef, req) {
  const { uid, role, user } = updatedBy(req);
  if (!req.auth?.uid) {
    throw new HttpsError("unauthenticated", "Login required.");
  }

  const userSnap = await dbRef.collection("users").doc(uid).get();
  if (!userSnap.exists || userSnap.data()?.active !== true) {
    throw new HttpsError("permission-denied", "Inactive or missing user");
  }

  const userData = userSnap.data() || {};
  const normalizedRole = String(userData.role || role || "").toLowerCase();
  if (!ROUTE_ASSIGNMENT_ROLES.includes(normalizedRole)) {
    throw new HttpsError(
      "permission-denied",
      "Only managers and admins can assign delivery routes.",
    );
  }

  return {
    uid,
    role: normalizedRole,
    name:
      userData.fullName ||
      userData.name ||
      userData.displayName ||
      user?.name ||
      null,
    user: userData,
  };
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
      if (!snap.empty) {
        resolvedIds.add(snap.docs[0].id);
      }
    }),
  );

  return [...resolvedIds];
}

async function fetchActiveRoutes(warehouseId = DEFAULT_WAREHOUSE_ID) {
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
  { actorName, actorUid, nowIso, confirmed = true },
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

  return {
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
}

exports.assignRoute = onCall(
  { region: "asia-southeast1", maxInstances: 10 },
  async (req) => {
    const actor = await requireRouteAssignmentRole(db, req);
    const {
      routeId = null,
      shipmentIds = [],
      packageIds = [],
      municipality = null,
      warehouseId = DEFAULT_WAREHOUSE_ID,
      suggestOnly = false,
      confirm = true,
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
          const matches = findRoutesForMunicipality(
            activeRoutes,
            recipientMunicipality,
          );
          if (matches.length === 1) {
            routeForShipment = matches[0];
          } else if (matches.length > 1) {
            suggestions.push({
              shipmentId,
              municipality: recipientMunicipality,
              suggestedRoutes: matches.map((route) => ({
                routeId: route.routeId,
                routeName: route.routeName,
              })),
            });
          }
        }

        if (!routeForShipment) {
          if (suggestOnly) {
            suggestions.push({
              shipmentId,
              municipality: recipientMunicipality,
              suggestedRoutes: findRoutesForMunicipality(
                activeRoutes,
                recipientMunicipality,
              ).map((route) => ({
                routeId: route.routeId,
                routeName: route.routeName,
              })),
            });
          } else {
            errors.push(
              `No route selected for shipment ${shipmentId}. Provide routeId or choose from suggestions.`,
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

        tx.update(snap.ref, {
          packages: derivedSnapshot.packages,
          packageBreakdown: derivedSnapshot.packageBreakdown,
          availableForDelivery: derivedSnapshot.availableForDelivery,
          assignedRouteId: routeForShipment.routeId,
          assignedRouteName: routeForShipment.routeName,
          routeAssignedAt: nowIso,
          routeAssignedBy: actor.name || actor.uid,
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
            packageIds: assignedPackageIds,
            municipality: normalizeString(municipality),
          },
        }),
      ),
    );

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
