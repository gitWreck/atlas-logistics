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
  await writeJson(queueKey(checkerId), items);
}

export function isDuplicatePendingOperation(queue, { shipmentId, packageIds, type }) {
  const normalizedType = String(type || "").trim().toUpperCase();
  const ids = new Set(
    (Array.isArray(packageIds) ? packageIds : []).map(String),
  );
  return queue.some((op) => {
    if (op.status === QUEUE_STATUS.SYNCED) return false;
    if (String(op.type).toUpperCase() !== normalizedType) return false;
    if (String(op.shipmentId) !== String(shipmentId)) return false;
    const opIds = Array.isArray(op.packageIds) ? op.packageIds.map(String) : [];
    return opIds.some((id) => ids.has(id));
  });
}

export async function enqueueOperation(checkerId, payload) {
  const queue = await loadQueue(checkerId);
  if (
    isDuplicatePendingOperation(queue, {
      shipmentId: payload.shipmentId,
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
