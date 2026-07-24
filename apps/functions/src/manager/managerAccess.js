"use strict";

const { HttpsError } = require("firebase-functions/v2/https");

function clean(value) {
  return String(value || "").trim();
}

function key(value) {
  return clean(value).replace(/[^a-z0-9]/gi, "").toLowerCase();
}

function unique(values = []) {
  return [...new Set(values.map(clean).filter(Boolean))];
}

function list(value) {
  return Array.isArray(value) ? value : value ? [value] : [];
}

function warehouseLabels(value = {}) {
  return unique([
    value.warehouseId,
    value.warehouseCode,
    value.warehouseName,
    value.assignedWarehouseId,
    value.assignedWarehouseCode,
    value.assignedWarehouseName,
    value.currentWarehouseId,
    value.currentWarehouseCode,
    value.currentWarehouseName,
    value.originWarehouseId,
    value.originWarehouseCode,
    value.originWarehouseName,
    value.destinationWarehouseId,
    value.destinationWarehouseCode,
    value.destinationWarehouseName,
    value.originCode,
    value.destinationCode,
    value.origin,
    value.destination,
    value.routeInfo?.origin,
    value.routeInfo?.destination,
  ]);
}

function municipalityLabels(value = {}) {
  return unique([
    ...list(value.assignedMunicipalities),
    ...list(value.municipalityCoverage),
    ...list(value.serviceMunicipalities),
    ...list(value.handledMunicipalities),
    ...list(value.municipalities),
    value.assignedMunicipality,
    value.municipality,
    value.destinationMunicipality,
    value.recipientMunicipality,
    value.recipient?.municipality,
    value.recipient?.city,
    value.recipient?.address?.municipality,
    value.recipient?.address?.city,
    value.destination?.municipality,
    value.destination?.city,
  ]);
}

function overlaps(left = [], right = []) {
  const rightKeys = new Set(right.map(key).filter(Boolean));
  return left.some((value) => rightKeys.has(key(value)));
}

function getManagerScope(profile = {}) {
  return {
    warehouses: warehouseLabels(profile),
    municipalities: municipalityLabels(profile),
  };
}

function isActiveProfile(profile = {}) {
  return (
    profile.active !== false &&
    String(profile.status || "").trim().toLowerCase() !== "inactive" &&
    String(profile.employmentStatus || "").trim().toLowerCase() !== "inactive"
  );
}

function canAccessRecord(profile = {}, record = {}) {
  const role = clean(profile.role).toLowerCase();
  if (role === "admin" || role === "administrator") return isActiveProfile(profile);
  if (role !== "manager" || !isActiveProfile(profile)) return false;

  const scope = getManagerScope(profile);
  if (!scope.warehouses.length) return false;

  const recordWarehouses = warehouseLabels(record);
  if (!recordWarehouses.length || !overlaps(scope.warehouses, recordWarehouses)) {
    return false;
  }

  const recordMunicipalities = municipalityLabels(record);
  if (
    scope.municipalities.length &&
    recordMunicipalities.length &&
    !overlaps(scope.municipalities, recordMunicipalities)
  ) {
    return false;
  }

  return true;
}

function canAccessStaff(profile = {}, staff = {}) {
  if (!canAccessRecord(profile, staff)) return false;
  const managerMunicipalities = municipalityLabels(profile);
  const staffMunicipalities = municipalityLabels(staff);
  return (
    !managerMunicipalities.length ||
    !staffMunicipalities.length ||
    overlaps(managerMunicipalities, staffMunicipalities)
  );
}

async function requireManagerScope(db, request) {
  if (!request.auth?.uid) {
    throw new HttpsError("unauthenticated", "Login required.");
  }

  const snap = await db.collection("users").doc(request.auth.uid).get();
  if (!snap.exists) {
    throw new HttpsError("permission-denied", "Manager profile is missing.");
  }

  const profile = { id: snap.id, ...snap.data() };
  if (clean(profile.role).toLowerCase() !== "manager" || !isActiveProfile(profile)) {
    throw new HttpsError("permission-denied", "An active Manager account is required.");
  }

  const scope = getManagerScope(profile);
  if (!scope.warehouses.length) {
    throw new HttpsError(
      "failed-precondition",
      "This Manager account has no assigned warehouse.",
    );
  }

  return { uid: request.auth.uid, profile, scope };
}

module.exports = {
  canAccessRecord,
  canAccessStaff,
  getManagerScope,
  isActiveProfile,
  key,
  municipalityLabels,
  overlaps,
  requireManagerScope,
  warehouseLabels,
};
