const MISSING_PIECE_STATES = new Set(["on_truck", "missing", "variance"]);

const LOADED_ON_TRUCK_PIECE_STATUSES = new Set([
  "IN_TRANSIT",
  "LOADED",
  "LOADED_TO_TRIP",
  "PARTIALLY_LOADED",
]);

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

function getPackageIdentity(pkg = {}) {
  return String(
    pkg.packageId || pkg.trackingNumber || pkg.pieceId || pkg.barcode || "",
  ).trim();
}

function dedupeMissingEntries(entries = []) {
  const seen = new Set();
  const result = [];

  for (const entry of entries) {
    const key = String(entry.packageId || entry.shipmentId || "").trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(entry);
  }

  return result;
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
        packageStatus: piece.packageStatus || piece.state || null,
        state: piece.state || "missing",
        otherTripId: piece.otherTripId || null,
      };
    })
    .filter((entry) => entry.packageId);
}

/** Pieces still linehaul-loaded on a different trip but tied to this manifest row. */
export function findPackagesOnOtherTrips(
  shipment = {},
  tripId = "",
  tripShipment = {},
) {
  const trip = String(tripId || "").trim();
  if (!trip) return [];

  const tripBarcodes = new Set(
    (tripShipment.packageBarcodes || []).filter(Boolean).map(String),
  );
  const packages = Array.isArray(shipment.packages) ? shipment.packages : [];

  return packages
    .filter((pkg) => {
      const pieceId = getPackageIdentity(pkg);
      if (!pieceId) return false;

      const loadedOn = String(pkg.loadedOnTrip || pkg.currentTripId || "").trim();
      const hubOn = String(pkg.hubReceivedOnTrip || "").trim();
      const status = String(pkg.status || "").toUpperCase();
      const receivedQty = Number(pkg.receivedQty) || 0;

      if (!loadedOn || loadedOn === trip) return false;
      if (receivedQty > 0) return false;

      const onThisTripManifest =
        tripBarcodes.has(pieceId) || hubOn === trip;

      return (
        onThisTripManifest ||
        LOADED_ON_TRUCK_PIECE_STATUSES.has(status)
      );
    })
    .map((pkg) => {
      const parsed = parsePackageIdentity(
        getPackageIdentity(pkg),
        shipment.shipmentId,
      );
      return {
        packageId: parsed.packageId,
        shipmentId: parsed.shipmentId,
        pieceSuffix: parsed.pieceSuffix,
        shipmentDocId: shipment.id || null,
        packageStatus: String(pkg.status || "").toUpperCase() || null,
        recipientName: shipment.recipient?.name || null,
        destination:
          shipment.recipient?.city ||
          shipment.destination ||
          shipment.destinationCode ||
          null,
        otherTripId: String(pkg.loadedOnTrip || pkg.currentTripId || "").trim(),
        state: "on_other_trip",
      };
    });
}

function buildGapPlaceholderEntries(row = {}, existingEntries = []) {
  const gap = Math.max(
    Number(row.expectedCount) - Number(row.unloadedCount),
    Number(row.remainingLoaded),
    Number(row.missingPieces),
    0,
  );
  if (gap <= 0) return [];

  const shortfall = Math.max(gap - existingEntries.length, 0);
  if (shortfall <= 0) return [];

  const shipmentKey = row.shipmentId || row.id || "shipment";

  return Array.from({ length: shortfall }, (_, index) => ({
    packageId: `${shipmentKey}-UNACCOUNTED-${index + 1}`,
    shipmentId: row.shipmentId || null,
    shipmentDocId: row.id || null,
    pieceSuffix: null,
    packageStatus: "UNACCOUNTED",
    recipientName: row.recipientName || null,
    destination: row.destination || null,
    state: "variance",
    isUnresolved: true,
    note:
      "Trip counters show a gap but the label ID could not be resolved. Unload the label, mark it missing, or check if it is on another trip.",
  }));
}

/** Resolve missing label IDs when piece states alone do not surface every gap. */
export function resolveMissingPackagesForRow(row = {}, options = {}) {
  const tripPackages = Array.isArray(options.tripPackages)
    ? options.tripPackages
    : Array.isArray(options)
      ? options
      : Array.isArray(row.tripPackages)
        ? row.tripPackages
        : [];
  const allPackages = Array.isArray(options.allPackages)
    ? options.allPackages
    : tripPackages;
  const tripId = String(options.tripId || row.tripId || "").trim();
  const tripShipment = options.tripShipment || {
    packageBarcodes: row.packageBarcodes || [],
  };

  const fromPieces = extractMissingPackagesFromRow(row);
  const fromOtherTrips = tripId
    ? findPackagesOnOtherTrips(
        {
          id: row.id,
          shipmentId: row.shipmentId,
          packages: allPackages,
          recipient: {
            name: row.recipientName,
            city: row.destination,
          },
          destination: row.destination,
        },
        tripId,
        tripShipment,
      )
    : [];

  const gap = Math.max(
    Number(row.expectedCount) - Number(row.unloadedCount),
    Number(row.remainingLoaded),
    Number(row.missingPieces),
    0,
  );

  const receivedIds = new Set(
    (row.pieces || [])
      .filter((piece) => piece.state === "received")
      .map((piece) => String(piece.pieceId || ""))
      .filter(Boolean),
  );

  const entries = [...fromPieces, ...fromOtherTrips];
  const seen = new Set(entries.map((entry) => entry.packageId).filter(Boolean));

  const pushPackage = (pkg = {}, meta = {}) => {
    const packageId = getPackageIdentity(pkg);
    if (!packageId || seen.has(packageId)) return;
    seen.add(packageId);

    const parsed = parsePackageIdentity(packageId, row.shipmentId);
    entries.push({
      packageId: parsed.packageId,
      shipmentId: parsed.shipmentId,
      pieceSuffix: parsed.pieceSuffix,
      shipmentDocId: row.id || null,
      recipientName: row.recipientName || null,
      destination: row.destination || null,
      packageStatus:
        meta.packageStatus || String(pkg.status || "").toUpperCase() || null,
      state: meta.state || "on_truck",
      otherTripId: meta.otherTripId || null,
    });
  };

  if (gap <= 0 && !row.missing && entries.length === 0) {
    return entries;
  }

  for (const pkg of tripPackages) {
    const packageId = getPackageIdentity(pkg);
    if (!packageId) continue;

    const status = String(pkg.status || "").toUpperCase();
    const loadedQty = Number(pkg.loadedQty) || 0;
    const receivedQty = Number(pkg.receivedQty) || 0;

    if (status === "MISSING" || Number(pkg.missingQty) > 0) {
      pushPackage(pkg, { packageStatus: status, state: "missing" });
      continue;
    }

    if (
      LOADED_ON_TRUCK_PIECE_STATUSES.has(status) &&
      loadedQty > 0 &&
      receivedQty === 0
    ) {
      pushPackage(pkg, { packageStatus: status, state: "on_truck" });
      continue;
    }

    if (receivedIds.has(packageId)) continue;

    if (row.missing || gap > entries.length) {
      pushPackage(pkg, { packageStatus: status, state: "on_truck" });
    }

    if (gap > 0 && entries.length >= gap) break;
  }

  const deduped = dedupeMissingEntries(entries);
  return [...deduped, ...buildGapPlaceholderEntries(row, deduped)];
}

export function flattenMissingPackages(
  missingShipments = [],
  options = {},
) {
  const all = [];
  const seen = new Set();

  for (const row of missingShipments) {
    const resolved = resolveMissingPackagesForRow(row, {
      tripPackages: row.tripPackages || [],
      allPackages: row.allPackages || row.tripPackages || [],
      tripId: options.tripId || row.tripId || "",
      tripShipment: {
        packageBarcodes: row.packageBarcodes || [],
      },
    });
    const entries =
      resolved.length > 0
        ? resolved
        : Array.isArray(row.missingPackages)
          ? row.missingPackages
          : [];

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

/** Full missing list for handoff UI — always re-derives from shipment rows. */
export function resolveAllMissingDisplayEntries(summary = {}) {
  const missingShipments = Array.isArray(summary.missingShipments)
    ? summary.missingShipments
    : [];
  const entries = flattenMissingPackages(missingShipments, {
    tripId: summary.tripId || null,
  });

  const totals = summary.totals || {};
  const missingPieces = Math.max(
    Number.isFinite(Number(totals.missingPieces))
      ? Number(totals.missingPieces)
      : Number(totals.manifestPieces) - Number(totals.unloadedPieces),
    0,
  );
  const shortfall = Math.max(missingPieces - entries.length, 0);
  if (shortfall <= 0) return entries;

  const tripKey = summary.tripId || "TRIP";
  return [
    ...entries,
    ...Array.from({ length: shortfall }, (_, index) => ({
      packageId: `${tripKey}-UNACCOUNTED-${index + 1}`,
      shipmentId: null,
      shipmentDocId: null,
      pieceSuffix: null,
      packageStatus: "UNACCOUNTED",
      state: "variance",
      isUnresolved: true,
      note:
        "Trip counters show a gap but the label ID could not be resolved. Unload the label, mark it missing, or check if it is on another trip.",
    })),
  ];
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
