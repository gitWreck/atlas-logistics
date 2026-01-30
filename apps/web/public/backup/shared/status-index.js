// /shared/status-index.js

import { STATUS_FLOW } from "./status-flow.js";

/**
 * ============================================
 * STATUS INDEX UTILITIES (CANONICAL)
 *
 * - Single source of truth for statusIndex logic
 * - Forward-only transitions enforced
 * - Hardened against corrupted / manual Firestore edits
 *
 * ⚠ statusIndex is AUTHORITATIVE
 * ⚠ status string is DERIVED
 * ============================================
 */

/**
 * Get index of a status safely
 *
 * @returns number | null
 */
export function getStatusIndex(status) {
  if (typeof status !== "string") return null;

  const idx = STATUS_FLOW.indexOf(status);
  return idx >= 0 ? idx : null;
}

/**
 * Get status string by index safely
 *
 * @returns string | null
 */
export function getStatusByIndex(index) {
  if (!Number.isInteger(index)) return null;
  if (index < 0 || index >= STATUS_FLOW.length) return null;

  return STATUS_FLOW[index];
}

/**
 * Validate a forward-only transition
 *
 * Rules:
 * - Both indices must be valid integers
 * - Transition must be exactly +1
 */
export function isValidStatusTransition(fromIndex, toIndex) {
  if (!Number.isInteger(fromIndex)) return false;
  if (!Number.isInteger(toIndex)) return false;

  return toIndex === fromIndex + 1;
}

/**
 * Get next status safely
 *
 * @returns { status: string | null, index: number | null }
 */
export function getNextStatus(currentIndex) {
  if (!Number.isInteger(currentIndex)) {
    return { status: null, index: null };
  }

  const nextIndex = currentIndex + 1;

  if (nextIndex >= STATUS_FLOW.length) {
    return { status: null, index: null };
  }

  return {
    status: STATUS_FLOW[nextIndex],
    index: nextIndex
  };
}

/**
 * Check if status is terminal (Delivered)
 */
export function isTerminalStatus(index) {
  if (!Number.isInteger(index)) return false;
  return index === STATUS_FLOW.length - 1;
}

/**
 * Coerce possibly corrupted record into safe statusIndex
 *
 * Use this when loading Firestore data.
 */
export function normalizeStatusIndex(record) {
  if (!record) return null;

  // Prefer stored index
  if (Number.isInteger(record.statusIndex)) {
    return record.statusIndex;
  }

  // Fallback to status string
  if (typeof record.status === "string") {
    return getStatusIndex(record.status);
  }

  return null;
}
