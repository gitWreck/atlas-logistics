const MISSING_PIECE_STATES = new Set(["on_truck", "missing"]);

/**
 * Parse a piece/package label into shipment parent + suffix.
 * Example: AT-20260612-SHP-677769-09 → shipment AT-20260612-SHP-677769, suffix 09
 */
export function parsePackageIdentity(packageId, fallbackShipmentId = null) {
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

export function extractMissingPackagesFromRow(row = {}) {
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
        recipientName: row.recipientName || null,
        destination: row.destination || null,
      };
    })
    .filter((entry) => entry.packageId);
}

export function flattenMissingPackages(missingShipments = []) {
  const all = [];
  const seen = new Set();

  for (const row of missingShipments) {
    const entries =
      Array.isArray(row.missingPackages) && row.missingPackages.length > 0
        ? row.missingPackages
        : extractMissingPackagesFromRow(row);

    for (const entry of entries) {
      const key = entry.packageId || entry.shipmentId;
      if (!key || seen.has(key)) continue;
      seen.add(key);
      all.push({
        ...entry,
        shipmentDocId: entry.shipmentDocId || row.id || null,
        recipientName: entry.recipientName || row.recipientName || null,
        destination: entry.destination || row.destination || null,
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

export function resolveRemarkForMissingPackage(entry = {}, missingRemarks = {}) {
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

/**
 * Expand remark keys so cloud functions can resolve by packageId, docId, or shipmentId.
 */
export function buildMissingRemarksForRelease(
  missingPackages = [],
  missingRemarks = {},
) {
  const payload = {};

  for (const [key, value] of Object.entries(missingRemarks)) {
    const trimmed = String(value || "").trim();
    if (trimmed) payload[key] = trimmed;
  }

  for (const entry of missingPackages) {
    const remark = resolveRemarkForMissingPackage(entry, missingRemarks);
    if (!remark) continue;

    if (entry.packageId) payload[entry.packageId] = remark;
    if (entry.shipmentDocId) payload[entry.shipmentDocId] = remark;
    if (entry.shipmentId) payload[entry.shipmentId] = remark;
  }

  return payload;
}

export function areMissingPackageRemarksComplete(
  missingPackages = [],
  missingRemarks = {},
) {
  if (!missingPackages.length) return true;
  return missingPackages.every(
    (entry) => resolveRemarkForMissingPackage(entry, missingRemarks).length > 0,
  );
}
