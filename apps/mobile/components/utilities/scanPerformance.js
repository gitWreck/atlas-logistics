const DEFAULT_SCAN_COOLDOWN_MS = 400;
const DEFAULT_DUPLICATE_BLOCK_MS = 2500;
const MAX_RECENT_SCAN_CODES = 200;
const CHECKER_LOADED_STATUSES = new Set([
  "LOADED_TO_DELIVERY_VEHICLE",
  "LOADED",
  "READY_FOR_DELIVERY",
  "PARTIALLY_LOADED",
  "OUT_FOR_DELIVERY",
  "FAILED_DELIVERY",
  "DELIVERED",
]);

function normalizeQueuedScanCode(value) {
  return String(value || "").trim().toUpperCase();
}

function createLayeredBarcodeIndex(...indexes) {
  const availableIndexes = indexes.filter(
    (index) => index && typeof index.get === "function",
  );

  return {
    get(code) {
      for (const index of availableIndexes) {
        const match = index.get(code);
        if (match) return match;
      }
      return undefined;
    },
  };
}

function selectCachedShipment(shipmentsById = {}, shipmentId = null) {
  const resolvedId = Array.isArray(shipmentId) ? shipmentId[0] : shipmentId;
  if (!resolvedId) return null;
  return shipmentsById[String(resolvedId)] || null;
}

/**
 * Last-mile loading progress must come from piece custody, not the shipment's
 * line-haul `loadedCount`, which can already equal the full shipment total.
 */
function countCheckerLoadedPieces(shipment = {}, checkerUid = null) {
  const uid = String(checkerUid || "").trim();
  if (!uid) return 0;

  const packages = Array.isArray(shipment?.packages) ? shipment.packages : [];
  return packages.reduce((sum, pkg = {}) => {
    const loadedByChecker =
      String(pkg.loadedByCheckerId || "").trim() === uid;
    const checkerCustody =
      String(pkg.custodyOwnerType || "").trim().toUpperCase() === "CHECKER" &&
      String(pkg.custodyOwnerId || "").trim() === uid;
    const status = String(pkg.status || "").trim().toUpperCase();

    if (
      (!loadedByChecker && !checkerCustody) ||
      !CHECKER_LOADED_STATUSES.has(status)
    ) {
      return sum;
    }

    const quantity = Number(pkg.quantity);
    return sum + (Number.isFinite(quantity) && quantity > 0 ? quantity : 1);
  }, 0);
}

function createScanGate({
  cooldownMs = DEFAULT_SCAN_COOLDOWN_MS,
  duplicateBlockMs = DEFAULT_DUPLICATE_BLOCK_MS,
} = {}) {
  let lastAcceptedAt = null;
  const acceptedAtByCode = new Map();

  const prune = (now) => {
    if (acceptedAtByCode.size <= MAX_RECENT_SCAN_CODES) return;
    for (const [code, acceptedAt] of acceptedAtByCode) {
      if (now - acceptedAt >= duplicateBlockMs) {
        acceptedAtByCode.delete(code);
      }
    }
  };

  return {
    accept(rawCode, now = Date.now()) {
      const code = normalizeQueuedScanCode(rawCode);
      if (!code) return { accepted: false, reason: "empty", code };

      if (
        lastAcceptedAt !== null &&
        now - lastAcceptedAt < cooldownMs
      ) {
        return { accepted: false, reason: "cooldown", code };
      }

      const previousAcceptedAt = acceptedAtByCode.get(code);
      if (
        previousAcceptedAt !== undefined &&
        now - previousAcceptedAt < duplicateBlockMs
      ) {
        return { accepted: false, reason: "duplicate", code };
      }

      lastAcceptedAt = now;
      acceptedAtByCode.set(code, now);
      prune(now);
      return { accepted: true, reason: "accepted", code };
    },
    reset() {
      lastAcceptedAt = null;
      acceptedAtByCode.clear();
    },
  };
}

function createSerialTaskQueue({ onDepthChange = () => {} } = {}) {
  let tail = Promise.resolve();
  let depth = 0;

  return {
    enqueue(task) {
      depth += 1;
      onDepthChange(depth);

      const result = tail.then(task, task);
      tail = result.catch(() => undefined);

      return result.finally(() => {
        depth = Math.max(0, depth - 1);
        onDepthChange(depth);
      });
    },
    getDepth() {
      return depth;
    },
  };
}

module.exports = {
  DEFAULT_DUPLICATE_BLOCK_MS,
  DEFAULT_SCAN_COOLDOWN_MS,
  createLayeredBarcodeIndex,
  createScanGate,
  createSerialTaskQueue,
  countCheckerLoadedPieces,
  normalizeQueuedScanCode,
  selectCachedShipment,
};
