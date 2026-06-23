"use strict";

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const { requireRole } = require("../utilities/helpers");
const {
  DEFAULT_WAREHOUSE_ID,
  ensureDefaultOdionganRoutes,
  normalizeString,
} = require("./routeHelpers");

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

exports.listDeliveryRoutes = onCall(
  { region: "asia-southeast1", maxInstances: 10 },
  async (req) => {
    await requireRole(db, req, ["admin", "manager", "checker"]);

    const { warehouseId = DEFAULT_WAREHOUSE_ID, includeInactive = false } =
      req.data || {};

    const normalizedWarehouse =
      normalizeString(warehouseId) || DEFAULT_WAREHOUSE_ID;

    if (!includeInactive) {
      await ensureDefaultOdionganRoutes(db, normalizedWarehouse);
    }

    let query = db
      .collection("routes")
      .where("warehouseId", "==", normalizedWarehouse);

    if (!includeInactive) {
      query = query.where("active", "==", true);
    }

    const snap = await query.get();
    const routes = snap.docs
      .map((docSnap) => {
        const data = docSnap.data() || {};
        return {
          id: docSnap.id,
          routeId: data.routeId || docSnap.id,
          routeName: data.routeName || data.routeId || docSnap.id,
          warehouseId: data.warehouseId || normalizedWarehouse,
          municipalityCoverage: Array.isArray(data.municipalityCoverage)
            ? data.municipalityCoverage
            : [],
          active: data.active !== false,
        };
      })
      .sort((a, b) =>
        String(a.routeName || "").localeCompare(String(b.routeName || "")),
      );

    return { success: true, routes };
  },
);
