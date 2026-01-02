/* ======================================================
   CSV UTILITIES — CANONICAL
   Used by: Bulk Upload, Admin Tools, Imports
====================================================== */

/**
 * Parse a simple CSV string into objects
 * - First row = headers
 * - Trims whitespace
 * - Ignores empty lines
 * - Safe defaults for missing cells
 */
export function parseCSV(text) {
  if (!text || typeof text !== "string") return [];

  const lines = text
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(Boolean);

  if (lines.length < 2) return [];

  const headers = lines[0]
    .split(",")
    .map(h => h.trim());

  return lines.slice(1).map(line => {
    const cols = line.split(",").map(c => c.trim());
    const row = {};

    headers.forEach((h, i) => {
      row[h] = cols[i] ?? "";
    });

    return row;
  });
}

/**
 * Sleep helper (throttle / rate-limit friendly)
 */
export const sleep = ms =>
  new Promise(resolve => setTimeout(resolve, ms));

/* ======================================================
   LOCATION NORMALIZATION
====================================================== */

const LOCATION_MAP = {
  DIVISORIA: "DIVI",
  CALATRAVA: "CAL",
  ODIONGAN: "ODI",
  TABLAS: "TAB",
  BATANGAS: "BTG",
  LUCENA: "LUC",

  SAN_AUGUSTIN: "SAUG",
  "SAN AUGUSTIN": "SAUG",

  SAN_ANDRES: "SAND",
  "SAN ANDRES": "SAND",

  SANTA_MARIA: "SMAR",
  "SANTA MARIA": "SMAR",

  SANTA_FE: "SFE",
  "SANTA FE": "SFE",

  ALCANTARA: "ALC",
  SIMARA: "SIM",
  BANTON: "BAN",
  LOOC: "LOC",
};

/**
 * Normalize a location label → location code
 * Accepts:
 * - "Divisoria"
 * - "SAN ANDRES"
 * - "San_Andres"
 * - " san fe "
 */
export function normalizeLocation(label) {
  if (!label || typeof label !== "string") return null;

  const key = label
    .trim()
    .toUpperCase()
    .replace(/\s+/g, " ");

  return LOCATION_MAP[key] || null;
}
