import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  where,
} from "firebase/firestore";
import {
  deriveParentShipmentCode,
  findPackageInShipment,
  normalizeScanCode,
} from "./scanner";

const CACHE_TTL_MS = 5 * 60 * 1000;
const CACHE_MAX_ENTRIES = 120;

/** @returns {Map<string, { result: object, expiresAt: number }>} */
export function createScanLookupCache() {
  return new Map();
}

function pruneCache(cache) {
  if (cache.size <= CACHE_MAX_ENTRIES) return;
  const oldest = [...cache.entries()].sort(
    (a, b) => a[1].expiresAt - b[1].expiresAt,
  );
  const removeCount = cache.size - CACHE_MAX_ENTRIES;
  for (let i = 0; i < removeCount; i += 1) {
    cache.delete(oldest[i][0]);
  }
}

function readCache(cache, key) {
  if (!key || !cache) return null;
  const entry = cache.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    cache.delete(key);
    return null;
  }
  return entry.result;
}

function packageMatchesScanCode(pkg, normalizedBarcode) {
  if (!pkg || !normalizedBarcode) return false;
  const packageId = normalizeScanCode(pkg.packageId);
  const trackingNumber = normalizeScanCode(pkg.trackingNumber);
  return (
    packageId === normalizedBarcode || trackingNumber === normalizedBarcode
  );
}

/** Package-level cache hits must match the scanned label, not a sibling piece. */
function cacheResultMatchesBarcode(result, normalizedBarcode) {
  if (!result) return false;
  if (!result.pkg) return true;
  return packageMatchesScanCode(result.pkg, normalizedBarcode);
}

function cacheKeysForResult(barcodeVariants, parentCode, result) {
  const keys = [...barcodeVariants];
  if (!result?.pkg && parentCode) {
    keys.push(parentCode);
  }
  return [...new Set(keys.map((key) => normalizeScanCode(key)).filter(Boolean))];
}

function writeCache(cache, barcodeVariants, parentCode, result) {
  if (!cache || !result) return;
  const expiresAt = Date.now() + CACHE_TTL_MS;
  cacheKeysForResult(barcodeVariants, parentCode, result).forEach((key) => {
    cache.set(key, { result, expiresAt });
  });
  pruneCache(cache);
}

function asShipmentDoc(shipmentDocOrSnap) {
  if (!shipmentDocOrSnap) return null;
  if (typeof shipmentDocOrSnap.data === "function") {
    return shipmentDocOrSnap;
  }
  const id = shipmentDocOrSnap.id;
  const data = shipmentDocOrSnap;
  return {
    id,
    exists: () => true,
    data: () => data,
  };
}

function buildLookupResult(shipmentDoc, barcode, scanType = null) {
  const docRef = asShipmentDoc(shipmentDoc);
  const shipmentData = docRef.data();
  const normalizedBarcode = normalizeScanCode(barcode);
  const pkg = findPackageInShipment(shipmentData, normalizedBarcode);
  const resolvedScanType =
    scanType || (pkg ? "package" : "shipment");

  return {
    shipmentDoc: docRef,
    shipmentData,
    pkg,
    scanType: resolvedScanType,
  };
}

/**
 * Build O(1) barcode → shipment map for pieces on the active trip.
 * @param {Array<import('firebase/firestore').DocumentSnapshot>} shipmentSnapshots
 */
export function buildTripBarcodeIndex(shipmentSnapshots = []) {
  const index = new Map();

  shipmentSnapshots.forEach((shipmentSnap) => {
    if (!shipmentSnap?.exists?.()) return;

    const shipmentData = shipmentSnap.data();
    const packages = Array.isArray(shipmentData.packages)
      ? shipmentData.packages
      : [];

    packages.forEach((pkg) => {
      [pkg?.packageId, pkg?.trackingNumber]
        .filter(Boolean)
        .forEach((code) => {
          index.set(normalizeScanCode(code), {
            shipmentDoc: shipmentSnap,
            shipmentData,
            pkg,
            scanType: "package",
          });
        });
    });

    [shipmentData.trackingNumber, shipmentData.shipmentId, shipmentSnap.id]
      .filter(Boolean)
      .forEach((code) => {
        const normalized = normalizeScanCode(code);
        if (!index.has(normalized)) {
          index.set(normalized, {
            shipmentDoc: shipmentSnap,
            shipmentData,
            pkg: null,
            scanType: "shipment",
          });
        }
      });
  });

  return index;
}

export async function getShipmentDocByCode(db, code) {
  const normalized = normalizeScanCode(code);
  if (!normalized) return null;

  const directSnap = await getDoc(doc(db, "shipments", normalized));
  if (directSnap.exists()) {
    return directSnap;
  }

  const [trackingSnap, shipmentIdSnap] = await Promise.all([
    getDocs(
      query(
        collection(db, "shipments"),
        where("trackingNumber", "==", normalized),
        limit(1),
      ),
    ),
    getDocs(
      query(
        collection(db, "shipments"),
        where("shipmentId", "==", normalized),
        limit(1),
      ),
    ),
  ]);

  if (!trackingSnap.empty) return trackingSnap.docs[0];
  if (!shipmentIdSnap.empty) return shipmentIdSnap.docs[0];
  return null;
}

async function queryByPackageBarcode(db, codeVariant) {
  const querySnap = await getDocs(
    query(
      collection(db, "shipments"),
      where("packageBarcodes", "array-contains", codeVariant),
      limit(1),
    ),
  );
  return querySnap.empty ? null : querySnap.docs[0];
}

/**
 * Resolve a scanned label to shipment + package with minimal round trips.
 */
export async function lookupScannedShipment(
  db,
  barcode,
  { tripIndex = null, cache = null } = {},
) {
  const normalizedBarcode = normalizeScanCode(barcode);
  const barcodeVariants = [
    ...new Set([normalizedBarcode, String(barcode || "").trim()]),
  ].filter(Boolean);
  const parentCode = deriveParentShipmentCode(normalizedBarcode);
  const cacheKeys = [...barcodeVariants, parentCode].filter(Boolean);

  for (const key of cacheKeys) {
    const cached = readCache(cache, key);
    if (cached && cacheResultMatchesBarcode(cached, normalizedBarcode)) {
      return cached;
    }
  }

  for (const key of cacheKeys) {
    const tripHit = tripIndex?.get?.(normalizeScanCode(key));
    if (tripHit && cacheResultMatchesBarcode(tripHit, normalizedBarcode)) {
      writeCache(cache, barcodeVariants, parentCode, tripHit);
      return tripHit;
    }
  }

  // Piece labels encode their parent shipment. Resolve that parent first;
  // this turns the normal scanner path into one direct shipment read instead
  // of waiting for every fallback query to finish.
  if (parentCode) {
    const parentShipmentDoc = await getShipmentDocByCode(db, parentCode);
    const pkg = parentShipmentDoc
      ? findPackageInShipment(parentShipmentDoc.data(), normalizedBarcode)
      : null;
    if (pkg) {
      const resolved = buildLookupResult(
        parentShipmentDoc,
        normalizedBarcode,
        "package",
      );
      writeCache(cache, barcodeVariants, parentCode, resolved);
      return resolved;
    }
  }

  const results = await Promise.all([
    ...barcodeVariants.map((codeVariant) =>
      queryByPackageBarcode(db, codeVariant).then((shipmentDoc) => ({
        kind: "barcode",
        shipmentDoc,
      })),
    ),
    getShipmentDocByCode(db, normalizedBarcode).then((shipmentDoc) => ({
      kind: "shipment",
      shipmentDoc,
    })),
  ]);

  const barcodeResult = results.find(
    (entry) => entry.kind === "barcode" && entry.shipmentDoc,
  );
  if (barcodeResult?.shipmentDoc) {
    const pkg = findPackageInShipment(
      barcodeResult.shipmentDoc.data(),
      normalizedBarcode,
    );
    if (!pkg) {
      throw new Error("Package not found in shipment.");
    }
    const resolved = buildLookupResult(
      barcodeResult.shipmentDoc,
      normalizedBarcode,
      "package",
    );
    writeCache(cache, barcodeVariants, parentCode, resolved);
    return resolved;
  }

  const directResult = results.find(
    (entry) => entry.kind === "shipment" && entry.shipmentDoc,
  );
  if (directResult?.shipmentDoc) {
    const resolved = buildLookupResult(
      directResult.shipmentDoc,
      normalizedBarcode,
    );
    writeCache(cache, barcodeVariants, parentCode, resolved);
    return resolved;
  }

  throw new Error("Package or shipment not found.");
}
