const QUEUE_PENDING_STATUS = "pending";
const QUEUE_FAILED_STATUS = "failed";
const QUEUE_SYNCING_STATUS = "syncing";
const QUEUE_SYNCED_STATUS = "synced";

const COMPACT_SHIPMENT_FIELDS = [
  "id",
  "shipmentId",
  "trackingNumber",
  "status",
  "packages",
  "packageBarcodes",
  "packageBreakdown",
  "totals",
  "assignedCheckerId",
  "assignedCheckerName",
  "activeCheckerIds",
  "availableForDelivery",
  "municipality",
  "recipient",
  "customerName",
  "isCOD",
  "deliveryManifestId",
  "currentTripId",
  "currentTruckTripId",
  "tripId",
];
const COMPACT_SHIPMENT_FIELD_SET = new Set(COMPACT_SHIPMENT_FIELDS);

function getPendingQueueOperations(queue = [], { includeFailed = true } = {}) {
  if (!Array.isArray(queue)) return [];
  return queue.filter((operation) => {
    if (operation?.status === QUEUE_PENDING_STATUS) return true;
    return includeFailed && operation?.status === QUEUE_FAILED_STATUS;
  });
}

function prepareQueueSnapshot(
  queue = [],
  {
    now = Date.now(),
    maxSyncingAgeMs = 90_000,
    pruneSynced = false,
  } = {},
) {
  if (!Array.isArray(queue)) {
    return { queue: [], changed: false };
  }

  let changed = false;
  const next = [];

  queue.forEach((operation) => {
    let nextOperation = operation;
    const snapshot = operation?.shipmentSnapshot;
    if (
      snapshot &&
      typeof snapshot === "object" &&
      Object.keys(snapshot).some(
        (field) => !COMPACT_SHIPMENT_FIELD_SET.has(field),
      )
    ) {
      nextOperation = compactOfflineOperation(operation);
      changed = true;
    }

    if (pruneSynced && nextOperation?.status === QUEUE_SYNCED_STATUS) {
      changed = true;
      return;
    }

    if (nextOperation?.status !== QUEUE_SYNCING_STATUS) {
      next.push(nextOperation);
      return;
    }

    const startedAt =
      nextOperation.syncingStartedAt || nextOperation.createdAt || 0;
    if (now - startedAt <= maxSyncingAgeMs) {
      next.push(nextOperation);
      return;
    }

    changed = true;
    next.push({
      ...nextOperation,
      status: QUEUE_FAILED_STATUS,
      lastError: "Sync interrupted. Tap Sync now to retry.",
    });
  });

  return { queue: changed ? next : queue, changed };
}

function compactShipmentSnapshot(shipment) {
  if (!shipment || typeof shipment !== "object") return null;

  return Object.fromEntries(
    COMPACT_SHIPMENT_FIELDS.flatMap((field) =>
      shipment[field] === undefined ? [] : [[field, shipment[field]]],
    ),
  );
}

function compactOfflineOperation(payload = {}) {
  return {
    ...payload,
    shipmentSnapshot: compactShipmentSnapshot(payload.shipmentSnapshot),
  };
}

module.exports = {
  QUEUE_FAILED_STATUS,
  QUEUE_PENDING_STATUS,
  compactOfflineOperation,
  compactShipmentSnapshot,
  getPendingQueueOperations,
  prepareQueueSnapshot,
};
