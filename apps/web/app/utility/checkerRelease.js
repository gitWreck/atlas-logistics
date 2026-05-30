const RELEASE_BLOCKED_STATUSES = new Set([
  "DELIVERED",
  "COMPLETED",
  "CANCELLED",
]);

export function normalizeShipmentStatus(status) {
  return String(status || "").trim().toUpperCase();
}

export function isEligibleForCheckerRelease(status) {
  return !RELEASE_BLOCKED_STATUSES.has(normalizeShipmentStatus(status));
}

export function getCheckerReleaseBlockReason(status) {
  const normalized = normalizeShipmentStatus(status);
  if (!RELEASE_BLOCKED_STATUSES.has(normalized)) return null;
  return `Cannot release: shipment is already ${normalized.replace(/_/g, " ").toLowerCase()}.`;
}

export { RELEASE_BLOCKED_STATUSES };
