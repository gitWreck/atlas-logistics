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

function routeCoversMunicipality(route = {}, municipality = "") {
  const target = normalizeMunicipality(municipality);
  if (!target) return false;

  const coverage = Array.isArray(route.municipalityCoverage)
    ? route.municipalityCoverage
    : [];

  return coverage.some(
    (entry) => normalizeMunicipality(entry) === target,
  );
}

function findRoutesForMunicipality(routes = [], municipality = "") {
  const target = normalizeMunicipality(municipality);
  if (!target) return [];

  return routes.filter((route) => {
    if (route?.active === false) return false;
    return routeCoversMunicipality(route, municipality);
  });
}

function resolveRecipientMunicipality(shipmentData = {}) {
  const recipient = shipmentData.recipient || {};
  const address = recipient.address || {};
  return (
    normalizeString(address.city) ||
    normalizeString(recipient.city) ||
    normalizeString(shipmentData.destination) ||
    null
  );
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
  resolveRecipientMunicipality,
  buildRouteDoc,
};
