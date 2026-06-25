import {
  cacheKey,
  deserializeShipmentsMap,
  readJson,
  serializeShipment,
  writeJson,
} from "./offlineStorage";
import { normalizeScanCode } from "./scanner";

function shipmentsCacheKey(checkerId) {
  return cacheKey("shipments", checkerId);
}

export function mergeShipmentMaps(...maps) {
  const byId = new Map();
  maps.forEach((map) => {
    Object.values(map || {}).forEach((shipment) => {
      if (!shipment?.id) return;
      byId.set(shipment.id, shipment);
    });
  });
  return Object.fromEntries(byId);
}

export async function saveShipmentCache(checkerId, {
  shipmentsById = {},
  manifests = [],
  assignedMunicipalities = [],
} = {}) {
  if (!checkerId) return;
  const serialized = Object.fromEntries(
    Object.entries(shipmentsById).map(([id, shipment]) => [
      id,
      serializeShipment(shipment),
    ]),
  );
  await writeJson(shipmentsCacheKey(checkerId), {
    savedAt: Date.now(),
    shipmentsById: serialized,
    manifests,
    assignedMunicipalities,
  });
}

export async function loadShipmentCache(checkerId) {
  if (!checkerId) {
    return {
      shipmentsById: {},
      manifests: [],
      assignedMunicipalities: [],
      savedAt: null,
    };
  }
  const data = await readJson(shipmentsCacheKey(checkerId), null);
  if (!data) {
    return {
      shipmentsById: {},
      manifests: [],
      assignedMunicipalities: [],
      savedAt: null,
    };
  }
  return {
    shipmentsById: deserializeShipmentsMap(data.shipmentsById || {}),
    manifests: Array.isArray(data.manifests) ? data.manifests : [],
    assignedMunicipalities: Array.isArray(data.assignedMunicipalities)
      ? data.assignedMunicipalities
      : [],
    savedAt: data.savedAt || null,
  };
}

function packageMatchesId(pkg, packageId) {
  const needle = normalizeScanCode(packageId);
  if (!needle) return false;
  return (
    normalizeScanCode(pkg?.packageId) === needle ||
    normalizeScanCode(pkg?.trackingNumber) === needle
  );
}

function patchPackage(shipment, packageId, patch) {
  const packages = Array.isArray(shipment.packages)
    ? shipment.packages.map((pkg) => {
        if (!packageMatchesId(pkg, packageId)) return pkg;
        return { ...pkg, ...patch };
      })
    : [];
  return { ...shipment, packages };
}

function patchShipmentForLoad(shipment, checkerUid) {
  const uid = String(checkerUid || "").trim();
  const activeCheckerIds = [
    ...new Set([...(Array.isArray(shipment.activeCheckerIds) ? shipment.activeCheckerIds : []), uid]),
  ].filter(Boolean);
  return {
    ...shipment,
    activeCheckerIds,
    assignedCheckerId: shipment.assignedCheckerId || uid,
  };
}

/** Apply optimistic piece updates after an offline scan is queued. */
export function applyOptimisticPieceUpdate(
  shipmentsById,
  { shipmentId, packageIds, status, checkerUid, shipmentSnapshot = null },
) {
  let shipment = shipmentsById[shipmentId];
  if (!shipment && shipmentSnapshot) {
    shipment = { ...shipmentSnapshot, id: shipmentId };
  }
  if (!shipment) return shipmentsById;

  let next = { ...shipment };
  const ids = Array.isArray(packageIds) ? packageIds : [packageIds].filter(Boolean);
  const normalizedStatus = String(status || "").trim().toUpperCase();

  ids.forEach((packageId) => {
    if (normalizedStatus === "LOAD_TO_VEHICLE") {
      next = patchPackage(next, packageId, {
        status: "OUT_FOR_DELIVERY",
        loadedByCheckerId: checkerUid,
        custodyOwnerType: "CHECKER",
        custodyOwnerId: checkerUid,
        availableForDelivery: false,
      });
      next = patchShipmentForLoad(next, checkerUid);
      return;
    }
    if (normalizedStatus === "DELIVERED") {
      next = patchPackage(next, packageId, { status: "DELIVERED" });
      return;
    }
    if (normalizedStatus === "FAILED_DELIVERY") {
      next = patchPackage(next, packageId, { status: "FAILED_DELIVERY" });
      return;
    }
    if (normalizedStatus === "RETURNED_TO_WAREHOUSE") {
      next = patchPackage(next, packageId, {
        status: "RETURNED_TO_WAREHOUSE",
        loadedByCheckerId: null,
      });
    }
  });

  return { ...shipmentsById, [shipmentId]: next };
}

/** Re-apply every pending offline op so route tabs match the local queue. */
export function applyPendingOperationsToShipments(
  shipmentsById = {},
  pendingOperations = [],
  checkerUid = null,
) {
  if (!checkerUid || !Array.isArray(pendingOperations)) {
    return shipmentsById;
  }

  return pendingOperations.reduce((map, operation) => {
    if (!operation?.shipmentId || !operation?.type) return map;
    return applyOptimisticPieceUpdate(map, {
      shipmentId: operation.shipmentId,
      packageIds: operation.packageIds,
      status: operation.type,
      checkerUid,
      shipmentSnapshot: operation.shipmentSnapshot || null,
    });
  }, shipmentsById);
}

export async function applyOptimisticUpdateToCache(
  checkerId,
  patch,
) {
  const cached = await loadShipmentCache(checkerId);
  let base = { ...cached.shipmentsById };
  if (!base[patch.shipmentId] && patch.shipmentSnapshot) {
    base = {
      ...base,
      [patch.shipmentId]: { ...patch.shipmentSnapshot, id: patch.shipmentId },
    };
  }
  const shipmentsById = applyOptimisticPieceUpdate(base, patch);
  await saveShipmentCache(checkerId, {
    shipmentsById,
    manifests: cached.manifests,
    assignedMunicipalities: cached.assignedMunicipalities,
  });
  return shipmentsById;
}

export async function upsertShipmentsInCache(
  checkerId,
  shipmentsById = {},
  { manifests, assignedMunicipalities } = {},
) {
  if (!checkerId) return {};
  const cached = await loadShipmentCache(checkerId);
  const merged = mergeShipmentMaps(cached.shipmentsById, shipmentsById);
  await saveShipmentCache(checkerId, {
    shipmentsById: merged,
    manifests: manifests ?? cached.manifests,
    assignedMunicipalities:
      assignedMunicipalities ?? cached.assignedMunicipalities,
  });
  return merged;
}
