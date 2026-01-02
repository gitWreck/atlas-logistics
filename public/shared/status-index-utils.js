import {
  STATUS_FLOW,
  getStatusIndex,
  getNextStatus as getNextStatusByStatus
} from "./status-flow.js";

/**
 * Get next status by index
 */
export function getNextStatusByIndex(index) {
  if (!Number.isInteger(index)) return null;
  return STATUS_FLOW[index + 1] ?? null;
}

/**
 * Validate forward-only progression
 */
export function isValidForwardTransition(fromIndex, toIndex) {
  if (!Number.isInteger(fromIndex)) return false;
  if (!Number.isInteger(toIndex)) return false;
  return toIndex === fromIndex + 1;
}

/**
 * Validate forward-only progression by STATUS STRING
 */
export function isValidForwardTransitionByStatus(fromStatus, toStatus) {
  const fromIndex = getStatusIndex(fromStatus);
  const toIndex = getStatusIndex(toStatus);
  if (fromIndex === null || toIndex === null) return false;
  return isValidForwardTransition(fromIndex, toIndex);
}
