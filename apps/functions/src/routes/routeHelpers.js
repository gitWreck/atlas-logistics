"use strict";

const { Timestamp } = require("firebase-admin/firestore");

const DEFAULT_WAREHOUSE_ID = "ODIONGAN_WAREHOUSE";

const ODIONGAN_SEED_ROUTES = Object.freeze([
  {
    routeId: "ROUTE-ODI-001",
    routeName: "Odiongan Town Proper",
    warehouseId: DEFAULT_WAREHOUSE_ID,
    municipalityCoverage: ["Odiongan Town Proper"],
    active: true,
  },
  {
    routeId: "ROUTE-ODI-002",
    routeName: "Odiongan",
    warehouseId: DEFAULT_WAREHOUSE_ID,
    municipalityCoverage: ["Odiongan"],
    active: true,
  },
  {
    routeId: "ROUTE-ODI-003",
    routeName: "San Andres / Calatrava",
    warehouseId: DEFAULT_WAREHOUSE_ID,
    municipalityCoverage: ["San Andres", "Calatrava"],
    active: true,
  },
  {
    routeId: "ROUTE-ODI-004",
    routeName: "Looc / Alcantara / Ferrol",
    warehouseId: DEFAULT_WAREHOUSE_ID,
    municipalityCoverage: ["Looc", "Alcantara", "Ferrol"],
    active: true,
  },
]);

function normalizeMunicipality(value = "") {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function extractMunicipalityCandidates(value = "") {
  const raw = normalizeString(value);
  if (!raw) return [];

  const candidates = new Set([raw]);
  raw.split(/[,;/|]/).forEach((part) => {
    const trimmed = part.trim();
    if (trimmed) candidates.add(trimmed);
  });

  return [...candidates];
}

function routeCoversMunicipality(route = {}, municipality = "") {
  const candidates = extractMunicipalityCandidates(municipality);
  if (!candidates.length) return false;

  const coverage = Array.isArray(route.municipalityCoverage)
    ? route.municipalityCoverage
    : [];

  return candidates.some((candidate) =>
    coverage.some(
      (entry) => normalizeMunicipality(entry) === normalizeMunicipality(candidate),
    ),
  );
}

function findRoutesForMunicipality(routes = [], municipality = "") {
  if (!normalizeString(municipality)) return [];

  const seen = new Set();
  const matches = [];

  routes.forEach((route) => {
    if (route?.active === false) return;
    if (!routeCoversMunicipality(route, municipality)) return;

    const key = normalizeString(route.routeId) || normalizeString(route.id);
    if (!key || seen.has(key)) return;
    seen.add(key);
    matches.push(route);
  });

  return matches;
}

function resolveRouteSelectionForMunicipality(routes = [], municipality = "") {
  const matches = findRoutesForMunicipality(routes, municipality);

  if (matches.length === 1) {
    return { route: matches[0], matches, reason: null };
  }

  if (matches.length > 1) {
    return {
      route: null,
      matches,
      reason: `Municipality "${municipality}" matches multiple routes. Select one manually.`,
    };
  }

  if (!normalizeString(municipality)) {
    return {
      route: null,
      matches: [],
      reason: "Shipment has no recipient municipality on file.",
    };
  }

  if (!routes.length) {
    return {
      route: null,
      matches: [],
      reason:
        "No delivery routes are configured yet. Run seedOdionganRoutes or add routes in Firestore.",
    };
  }

  return {
    route: null,
    matches: [],
    reason: `No route covers municipality "${municipality}". Select a route manually or update route coverage.`,
  };
}

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

function resolveRecipientMunicipality(shipmentData = {}) {
  const recipient = shipmentData.recipient || {};
  const address = recipient.address || {};

  const candidates = [
    normalizeString(address.city),
    normalizeString(recipient.city),
    normalizeString(shipmentData.destination),
    normalizeString(shipmentData.destinationCode),
  ].filter(Boolean);

  for (const candidate of candidates) {
    const parts = extractMunicipalityCandidates(candidate);
    if (parts.length > 0) return parts[0];
  }

  return null;
}

async function ensureDefaultOdionganRoutes(db, warehouseId = DEFAULT_WAREHOUSE_ID) {
  const snap = await db
    .collection("routes")
    .where("warehouseId", "==", warehouseId)
    .limit(1)
    .get();

  if (!snap.empty) return false;

  const batch = db.batch();
  const now = Timestamp.now();

  ODIONGAN_SEED_ROUTES.forEach((route) => {
    const ref = db.collection("routes").doc(route.routeId);
    batch.set(ref, buildRouteDoc(route, { now }), { merge: true });
  });

  await batch.commit();
  return true;
}

function buildRouteDoc(route = {}, options = {}) {
  const now = options.now || Timestamp.now();
  const routeId = normalizeString(route.routeId);
  if (!routeId) {
    throw new Error("routeId is required");
  }

  const municipalityCoverage = normalizeStringList(route.municipalityCoverage);

  return {
    routeId,
    routeName: normalizeString(route.routeName) || routeId,
    warehouseId: normalizeString(route.warehouseId) || DEFAULT_WAREHOUSE_ID,
    municipalityCoverage,
    active: route.active !== false,
    createdAt: route.createdAt || now,
    updatedAt: now,
  };
}

module.exports = {
  DEFAULT_WAREHOUSE_ID,
  ODIONGAN_SEED_ROUTES,
  normalizeMunicipality,
  normalizeString,
  normalizeStringList,
  routeCoversMunicipality,
  findRoutesForMunicipality,
  resolveRouteSelectionForMunicipality,
  resolveRecipientMunicipality,
  ensureDefaultOdionganRoutes,
  buildRouteDoc,
};
