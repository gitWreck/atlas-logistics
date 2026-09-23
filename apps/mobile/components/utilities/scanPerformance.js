const DEFAULT_SCAN_COOLDOWN_MS = 400;
const DEFAULT_DUPLICATE_BLOCK_MS = 2500;
const MAX_RECENT_SCAN_CODES = 200;

function normalizeQueuedScanCode(value) {
  return String(value || "").trim().toUpperCase();
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
  createScanGate,
  createSerialTaskQueue,
  normalizeQueuedScanCode,
};
