/**
 * =====================================================
 * CANONICAL STATUS FLOW
 * -----------------------------------------------------
 * - statusIndex is derived from this array ONLY
 * - Order MUST NEVER CHANGE once in production
 * - Delays are NOT statuses (handled separately)
 * =====================================================
 */

export const STATUS_FLOW = Object.freeze([
  "Received",
  "Loaded",
  "In Transit",
  "Arrived at Port",
  "Boarded RORO Vessel",
  "Out for Delivery",
  "Delivered"
]);

/**
 * Fast lookup map: status → index
 */
export const STATUS_INDEX = Object.freeze(
  Object.fromEntries(
    STATUS_FLOW.map((s, i) => [s, i])
  )
);

/**
 * Validate a status string
 */
export function isValidStatus(status) {
  return STATUS_INDEX[status] !== undefined;
}

/**
 * Get index safely
 */
export function getStatusIndex(status) {
  return STATUS_INDEX[status] ?? null;
}

/**
 * Get next status (or null if terminal)
 */
export function getNextStatus(status) {
  const idx = getStatusIndex(status);
  if (idx === null) return null;
  return STATUS_FLOW[idx + 1] ?? null;
}

/**
 * Is this a terminal status?
 */
export function isTerminalStatus(status) {
  return status === "Delivered";
}
