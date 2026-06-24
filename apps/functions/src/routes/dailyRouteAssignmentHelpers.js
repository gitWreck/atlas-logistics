"use strict";

const { Timestamp } = require("firebase-admin/firestore");
const { DEFAULT_WAREHOUSE_ID, normalizeString } = require("./routeHelpers");

const ACTIVE_ASSIGNMENT_STATUS = "ACTIVE";

function resolveAssignmentDate(value = null) {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value.trim())) {
    return value.trim();
  }

  const date = value instanceof Date ? value : new Date();
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  return `${year}-${month}-${day}`;
}

async function fetchActiveDailyAssignments(
  db,
  {
    date = null,
    checkerId = null,
    routeId = null,
    warehouseId = DEFAULT_WAREHOUSE_ID,
  } = {},
) {
  const assignmentDate = resolveAssignmentDate(date);
  const normalizedWarehouse =
    normalizeString(warehouseId) || DEFAULT_WAREHOUSE_ID;
  const normalizedCheckerId = normalizeString(checkerId);
  const normalizedRouteId = normalizeString(routeId);

  let query = db
    .collection("daily_route_assignments")
    .where("date", "==", assignmentDate)
    .where("status", "==", ACTIVE_ASSIGNMENT_STATUS);

  if (normalizedCheckerId) {
    query = query.where("checkerId", "==", normalizedCheckerId);
  } else if (normalizedRouteId) {
    query = query.where("routeId", "==", normalizedRouteId);
  } else {
    query = query.where("warehouseId", "==", normalizedWarehouse);
  }

  const snap = await query.get();
  let rows = snap.docs.map((docSnap) => ({
    id: docSnap.id,
    ...docSnap.data(),
  }));

  if (normalizedCheckerId && normalizedRouteId) {
    rows = rows.filter(
      (row) => normalizeString(row.routeId) === normalizedRouteId,
    );
  }

  if (!normalizedCheckerId && !normalizedRouteId) {
    rows = rows.filter(
      (row) =>
        normalizeString(row.warehouseId) === normalizedWarehouse ||
        !normalizeString(row.warehouseId),
    );
  }

  return rows;
}

function checkerRouteIdsForDate(assignments = [], checkerId = "") {
  const uid = String(checkerId || "").trim();
  if (!uid) return [];

  return [
    ...new Set(
      assignments
        .filter((row) => String(row.checkerId || "") === uid)
        .map((row) => normalizeString(row.routeId))
        .filter(Boolean),
    ),
  ];
}

function buildDailyAssignmentDoc({
  date,
  warehouseId = DEFAULT_WAREHOUSE_ID,
  routeId,
  routeName,
  checkerId,
  checkerName,
  vehicleId = null,
  vehicleName = null,
  actorUid = null,
  actorName = null,
  now = Timestamp.now(),
}) {
  return {
    date: resolveAssignmentDate(date),
    warehouseId: normalizeString(warehouseId) || DEFAULT_WAREHOUSE_ID,
    routeId: normalizeString(routeId),
    routeName: normalizeString(routeName) || normalizeString(routeId),
    checkerId: normalizeString(checkerId),
    checkerName: normalizeString(checkerName) || "Checker",
    vehicleId: normalizeString(vehicleId),
    vehicleName: normalizeString(vehicleName),
    status: ACTIVE_ASSIGNMENT_STATUS,
    createdBy: actorName || actorUid || null,
    createdByUid: actorUid || null,
    createdAt: now,
    updatedAt: now,
  };
}

module.exports = {
  ACTIVE_ASSIGNMENT_STATUS,
  resolveAssignmentDate,
  fetchActiveDailyAssignments,
  checkerRouteIdsForDate,
  buildDailyAssignmentDoc,
};
