import { formatFirestoreDate } from "./utilities";
import {
  calculateShipmentProgress,
  resolveShipmentDeliveryMetrics,
} from "./shipmentProgress";
import { resolveShipmentPackageBreakdown } from "./packageStatus";

export function formatShipmentForBoard(shipment = {}, { id = shipment.id } = {}) {
  const breakdown = resolveShipmentPackageBreakdown(shipment);
  const totalUnits =
    shipment.totals?.totalContentQty || shipment.totals?.totalItems || 1;
  const loadedUnits = shipment.totals?.loaded || 0;
  const checkerLoaded = Math.max(
    Number(breakdown.outForDelivery || 0),
    Number(breakdown.onCheckerVan || 0),
  );
  const { total: deliveryTotal, delivered: deliveredUnits } =
    resolveShipmentDeliveryMetrics(shipment);
  const effectiveTotal = deliveryTotal > 0 ? deliveryTotal : totalUnits;
  const progressPercent = calculateShipmentProgress(shipment);
  const loadPercent = Math.round(
    (loadedUnits / (shipment.totals?.totalItems || 1)) * 100,
  );

  return {
    id,
    ...shipment,
    createdAt: shipment.createdAt
      ? formatFirestoreDate(shipment.createdAt)
      : shipment.createdAt,
    updatedAt: shipment.updatedAt
      ? formatFirestoreDate(shipment.updatedAt)
      : shipment.updatedAt,
    progress: progressPercent,
    metrics: {
      ...(shipment.metrics || {}),
      totalContent: effectiveTotal,
      totalPackages: shipment.totals?.totalItems || 0,
      totalDelivered: deliveredUnits,
      totalLoaded: loadedUnits,
      checkerLoaded,
      progressPercent,
      loadPercent,
    },
  };
}
