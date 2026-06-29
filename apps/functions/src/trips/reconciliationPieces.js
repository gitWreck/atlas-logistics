"use strict";

const MISSING_PIECE_STATES = new Set(["on_truck", "missing", "variance"]);

const LOADED_ON_TRUCK_PIECE_STATUSES = new Set([
  "IN_TRANSIT",
  "LOADED",
  "LOADED_TO_TRIP",
  "PARTIALLY_LOADED",
]);

function parsePackageIdentity(packageId, fallbackShipmentId = null) {
  const id = String(packageId || "").trim();
  const shipmentId = String(fallbackShipmentId || "").trim();

  if (!id) {
    return { packageId: null, shipmentId: null, pieceSuffix: null };
  }

  if (shipmentId && id.startsWith(`${shipmentId}-`)) {
    return {
      packageId: id,
      shipmentId,
      pieceSuffix: id.slice(shipmentId.length + 1),
    };
  }

  const match = id.match(/^(AT-\d{8}-SHP-\d+)-(.+)$/);
  if (match) {
    return {
      packageId: id,
      shipmentId: match[1],
      pieceSuffix: match[2],
    };
  }

  return {
    packageId: id,
    shipmentId: shipmentId || id,
    pieceSuffix: null,
  };
}

function extractMissingPackagesFromRow(row = {}) {
  const pieces = Array.isArray(row.pieces) ? row.pieces : [];
  const fallbackShipmentId = row.shipmentId || "";
  const shipmentDocId = row.id || null;

  return pieces
    .filter((piece) => MISSING_PIECE_STATES.has(piece.state))
    .map((piece) => {
      const parsed = parsePackageIdentity(piece.pieceId, fallbackShipmentId);
      return {
        packageId: parsed.packageId,
        shipmentId: parsed.shipmentId,
        pieceSuffix: parsed.pieceSuffix,
        shipmentDocId,
      };
    })
    .filter((entry) => entry.packageId);
}

function resolveMissingPackagesForRow(row = {}, tripPackages = []) {
  const fromPieces = extractMissingPackagesFromRow(row);
  if (fromPieces.length > 0) return fromPieces;

  const gap = Math.max(
    Number(row.expectedCount) - Number(row.unloadedCount),
    Number(row.remainingLoaded),
    Number(row.missingPieces),
    0,
  );
  if (gap <= 0 && !row.missing) return [];

  const receivedIds = new Set(
    (row.pieces || [])
      .filter((piece) => piece.state === "received")
      .map((piece) => String(piece.pieceId || ""))
      .filter(Boolean),
  );

  const entries = [];
  const seen = new Set();

  const pushPackage = (pkg = {}) => {
    const packageId = String(
      pkg.packageId || pkg.trackingNumber || "",
    ).trim();
    if (!packageId || seen.has(packageId)) return;
    seen.add(packageId);

    const parsed = parsePackageIdentity(packageId, row.shipmentId);
    entries.push({
      packageId: parsed.packageId,
      shipmentId: parsed.shipmentId,
      pieceSuffix: parsed.pieceSuffix,
      shipmentDocId: row.id || null,
    });
  };

  for (const pkg of tripPackages) {
    const packageId = String(
      pkg.packageId || pkg.trackingNumber || "",
    ).trim();
    if (!packageId) continue;

    const status = String(pkg.status || "").toUpperCase();
    const loadedQty = Number(pkg.loadedQty) || 0;
    const receivedQty = Number(pkg.receivedQty) || 0;

    if (status === "MISSING" || Number(pkg.missingQty) > 0) {
      pushPackage(pkg);
      continue;
    }

    if (
      LOADED_ON_TRUCK_PIECE_STATUSES.has(status) &&
      loadedQty > 0 &&
      receivedQty === 0
    ) {
      pushPackage(pkg);
      continue;
    }

    if (receivedIds.has(packageId)) continue;

    if (row.missing || gap > entries.length) {
      pushPackage(pkg);
    }

    if (gap > 0 && entries.length >= gap) break;
  }

  return entries;
}

function flattenMissingPackages(missingShipments = []) {
  const all = [];
  const seen = new Set();

  for (const row of missingShipments) {
    const entries =
      Array.isArray(row.missingPackages) && row.missingPackages.length > 0
        ? row.missingPackages
        : resolveMissingPackagesForRow(row, row.tripPackages || []);

    for (const entry of entries) {
      const key = entry.packageId || entry.shipmentId;
      if (!key || seen.has(key)) continue;
      seen.add(key);
      all.push({
        ...entry,
        shipmentDocId: entry.shipmentDocId || row.id || null,
      });
    }
  }

  return all;
}

function findPieceRemarkKeyForShipment(shipmentId, missingRemarks = {}) {
  const normalizedShipmentId = String(shipmentId || "").trim();
  if (!normalizedShipmentId) return null;

  const prefix = `${normalizedShipmentId}-`;
  for (const [key, remark] of Object.entries(missingRemarks)) {
    if (key.startsWith(prefix) && String(remark || "").trim()) {
      return key;
    }
  }

  return null;
}

function resolveRemarkForMissingPackage(entry = {}, missingRemarks = {}) {
  const packageId = entry.packageId || null;
  const docId = entry.shipmentDocId;
  const shipmentId = entry.shipmentId || null;

  const direct = String(
    (packageId && missingRemarks[packageId]) ||
      (docId && missingRemarks[docId]) ||
      (shipmentId && missingRemarks[shipmentId]) ||
      "",
  ).trim();
  if (direct) return direct;

  const pieceKey = findPieceRemarkKeyForShipment(shipmentId, missingRemarks);
  if (pieceKey) {
    return String(missingRemarks[pieceKey] || "").trim();
  }

  return "";
}

module.exports = {
  MISSING_PIECE_STATES,
  parsePackageIdentity,
  extractMissingPackagesFromRow,
  resolveMissingPackagesForRow,
  flattenMissingPackages,
  resolveRemarkForMissingPackage,
};
