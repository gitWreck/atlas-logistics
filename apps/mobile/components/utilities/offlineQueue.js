import {
  cacheKey,
  generateOperationId,
  readJson,
  writeJson,
} from "./offlineStorage";

const QUEUE_STATUS = {
  PENDING: "pending",
  SYNCING: "syncing",
  FAILED: "failed",
  SYNCED: "synced",
};

function queueKey(checkerId) {
  return cacheKey("queue", checkerId);
}

export async function loadQueue(checkerId) {
  const items = await readJson(queueKey(checkerId), []);
  return Array.isArray(items) ? items : [];
}

async function saveQueue(checkerId, items) {
  try {
    await writeJson(queueKey(checkerId), items);
  } catch (error) {
    console.warn("saveQueue failed, skipping offline queue cache", checkerId, error);
  }
}

export function isDuplicatePendingOperation(queue, { packageIds, type }) {
  const normalizedType = String(type || "").trim().toUpperCase();
  const ids = new Set(
    (Array.isArray(packageIds) ? packageIds : []).map(String),
  );
  if (!ids.size) return false;

  return queue.some((op) => {
    if (op.status === QUEUE_STATUS.SYNCED) return false;
    if (String(op.type).toUpperCase() !== normalizedType) return false;
    const opIds = Array.isArray(op.packageIds) ? op.packageIds.map(String) : [];
    return opIds.some((id) => ids.has(id));
  });
}

export async function enqueueOperation(checkerId, payload) {
  const queue = await loadQueue(checkerId);
  if (
    isDuplicatePendingOperation(queue, {
      packageIds: payload.packageIds,
      type: payload.type,
    })
  ) {
    throw new Error("This scan is already queued and waiting to sync.");
  }

  const operation = {
    id: generateOperationId(),
    checkerId: String(checkerId),
    createdAt: Date.now(),
    status: QUEUE_STATUS.PENDING,
    retryCount: 0,
    lastError: null,
    ...payload,
    type: String(payload.type || "").trim().toUpperCase(),
  };

  queue.push(operation);
  await saveQueue(checkerId, queue);
  return operation;
}

export async function updateOperation(checkerId, operationId, patch) {
  const queue = await loadQueue(checkerId);
  const next = queue.map((op) =>
    op.id === operationId ? { ...op, ...patch } : op,
  );
  await saveQueue(checkerId, next);
  return next;
}

export async function getPendingOperations(checkerId) {
  const queue = await loadQueue(checkerId);
  return queue.filter(
    (op) =>
      op.status === QUEUE_STATUS.PENDING || op.status === QUEUE_STATUS.FAILED,
  );
}

export async function getPendingCount(checkerId) {
  const pending = await getPendingOperations(checkerId);
  return pending.length;
}

export async function pruneSyncedOperations(checkerId) {
  const queue = await loadQueue(checkerId);
  const next = queue.filter((op) => op.status !== QUEUE_STATUS.SYNCED);
  if (next.length !== queue.length) {
    await saveQueue(checkerId, next);
  }
  return next;
}

export { QUEUE_STATUS };

const OPERATION_LABELS = {
  LOAD_TO_VEHICLE: "Load",
  DELIVERED: "Deliver",
  FAILED_DELIVERY: "Failed",
  RETURNED_TO_WAREHOUSE: "Return",
};

export function formatOfflineOperationLabel(operation = {}) {
  const type = String(operation.type || "").trim().toUpperCase();
  const barcode =
    operation.barcode ||
    (Array.isArray(operation.packageIds) ? operation.packageIds[0] : null) ||
    "Unknown label";
  const action = OPERATION_LABELS[type] || type || "Scan";
  return `${action} — ${barcode}`;
}

export function summarizeQueueOperations(operations = []) {
  return operations.map((operation) => ({
    id: operation.id,
    label: formatOfflineOperationLabel(operation),
    status: operation.status,
    lastError: operation.lastError || null,
    createdAt: operation.createdAt,
    type: operation.type,
    barcode: operation.barcode,
  }));
}

/** Reset ops left in syncing after an app crash. */
export async function recoverStuckSyncingOperations(
  checkerId,
  maxAgeMs = 90_000,
) {
  const queue = await loadQueue(checkerId);
  const now = Date.now();
  let changed = false;

  const next = queue.map((operation) => {
    if (operation.status !== QUEUE_STATUS.SYNCING) return operation;
    const startedAt = operation.syncingStartedAt || operation.createdAt || 0;
    if (now - startedAt <= maxAgeMs) return operation;
    changed = true;
    return {
      ...operation,
      status: QUEUE_STATUS.FAILED,
      lastError: "Sync interrupted. Tap Sync now to retry.",
    };
  });

  if (changed) {
    await saveQueue(checkerId, next);
  }
  return next;
}
