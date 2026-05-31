const RECONCILE_BLOCKED_STATUSES = new Set([
  "DELIVERED",
  "COMPLETED",
  "CANCELLED",
]);

export function normalizeShipmentStatus(status) {
  return String(status || "").trim().toUpperCase();
}

export function isEligibleForHubReconcile(status) {
  return !RECONCILE_BLOCKED_STATUSES.has(normalizeShipmentStatus(status));
}

export function getHubReconcileBlockReason(status) {
  const normalized = normalizeShipmentStatus(status);
  if (!RECONCILE_BLOCKED_STATUSES.has(normalized)) return null;
  return `Cannot reconcile: shipment is ${normalized.replace(/_/g, " ").toLowerCase()}.`;
}

export function getExpectedPieceCountFromShipment(shipment = {}) {
  const packages = Array.isArray(shipment.packages) ? shipment.packages : [];

  if (packages.length) {
    return packages.reduce(
      (sum, pkg) => sum + Math.max(Number(pkg.quantity) || 1, 0),
      0,
    );
  }

  const fallback =
    shipment.totalItems ??
    shipment.packageCount ??
    shipment.totals?.totalItems ??
    (Array.isArray(shipment.packageBarcodes)
      ? shipment.packageBarcodes.length
      : 0);

  return Math.max(Number(fallback) || 0, 0);
}

export function formatReconcileResult(shipment = {}) {
  if (shipment.reconcileResult) return shipment.reconcileResult;

  const expected =
    shipment.reconcileExpectedQty ?? shipment.reconcileExpected ?? null;
  const received =
    shipment.reconcileReceivedQty ?? shipment.reconcileReceived ?? null;

  if (expected == null && received == null) return null;
  return `${received ?? "—"} of ${expected ?? "—"} pieces matched`;
}

export function hasReconcileVariance(shipment = {}) {
  const variance = Number(shipment.reconcileVariance);
  if (Number.isFinite(variance)) return variance !== 0;
  const expected = Number(
    shipment.reconcileExpectedQty ?? shipment.reconcileExpected,
  );
  const received = Number(
    shipment.reconcileReceivedQty ?? shipment.reconcileReceived,
  );
  if (!Number.isFinite(expected) || !Number.isFinite(received)) return false;
  return received !== expected;
}
