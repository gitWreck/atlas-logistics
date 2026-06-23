"use strict";

const { onCall } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const { requireRole } = require("../utilities/helpers");
const {
  DEFAULT_WAREHOUSE_ID,
  normalizeString,
} = require("./routeHelpers");
const {
  fetchActiveDailyAssignments,
  resolveAssignmentDate,
} = require("./dailyRouteAssignmentHelpers");

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

exports.listDailyRouteAssignments = onCall(
  { region: "asia-southeast1", maxInstances: 10 },
  async (req) => {
    await requireRole(db, req, ["admin", "manager", "checker"]);

    const {
      date = null,
      checkerId = null,
      routeId = null,
      warehouseId = DEFAULT_WAREHOUSE_ID,
    } = req.data || {};

    const assignments = await fetchActiveDailyAssignments(db, {
      date: resolveAssignmentDate(date),
      checkerId: normalizeString(checkerId),
      routeId: normalizeString(routeId),
      warehouseId: normalizeString(warehouseId) || DEFAULT_WAREHOUSE_ID,
    });

    return {
      success: true,
      date: resolveAssignmentDate(date),
      assignments,
    };
  },
);
