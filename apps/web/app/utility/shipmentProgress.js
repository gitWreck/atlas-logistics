import { calculateProgress, getVisualProgress } from "./utilities";
import { resolveShipmentPackageBreakdown } from "./packageStatus";

function clampCount(value) {
  return Math.max(0, Number(value) || 0);
}

export function resolveShipmentDeliveryMetrics(shipment = {}) {
  const breakdown = resolveShipmentPackageBreakdown(shipment);
  const total = Math.max(
    clampCount(breakdown.total),
    clampCount(shipment.totals?.totalContentQty),
    clampCount(shipment.totals?.totalItems),
    clampCount(shipment.metrics?.totalContent),
  );
  const delivered = Math.max(
    clampCount(breakdown.delivered),
    clampCount(shipment.totals?.delivered),
    clampCount(shipment.metrics?.totalDelivered),
  );

  return { total, delivered };
}

/**
 * Shipment board progress — prefers actual delivered piece counts,
 * then falls back to lifecycle status milestones.
 */
export function calculateShipmentProgress(shipment = {}) {
  const { total, delivered } = resolveShipmentDeliveryMetrics(shipment);
  const status = String(shipment.status || "")
    .trim()
    .toUpperCase();

  if (total > 0) {
    if (delivered > 0) {
      return Math.min(100, Math.round((delivered / total) * 100));
    }
    if (
      [
        "OUT_FOR_DELIVERY",
        "PARTIALLY_OUT_FOR_DELIVERY",
        "READY_FOR_DELIVERY",
        "RELEASED_FOR_DELIVERY",
        "AVAILABLE_FOR_DELIVERY",
        "PARTIALLY_AVAILABLE_FOR_DELIVERY",
      ].includes(status)
    ) {
      return 0;
    }
    if (["DELIVERED", "COMPLETED"].includes(status)) {
      return 100;
    }
  }

  const visual = getVisualProgress(status);
  if (visual > 0) return visual;

  return calculateProgress(status);
}
