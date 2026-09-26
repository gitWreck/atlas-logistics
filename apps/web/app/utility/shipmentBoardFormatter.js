import { formatFirestoreDate } from "./utilities";
import {
  calculateShipmentProgress,
  resolveShipmentDeliveryMetrics,
} from "./shipmentProgress";
import { resolveShipmentPackageBreakdown } from "./packageStatus";

export function toShipmentIsoDate(value) {
  if (!value) return null;
  let date;
  if (typeof value.toDate === "function") date = value.toDate();
  else if (typeof value.seconds === "number") date = new Date(value.seconds * 1000);
  else if (typeof value._seconds === "number") date = new Date(value._seconds * 1000);
  else if (value instanceof Date) date = value;
  else if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value))
    date = new Date(value);
  else return null;
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function formatShipmentBoardTimestamp(value) {
  const iso = toShipmentIsoDate(value);
  if (!iso) return "—";

  return new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Manila",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(iso));
}

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
    createdAtIso: shipment.createdAtIso || toShipmentIsoDate(shipment.createdAt),
    updatedAt: shipment.updatedAt
      ? formatFirestoreDate(shipment.updatedAt)
      : shipment.updatedAt,
    updatedAtIso: shipment.updatedAtIso || toShipmentIsoDate(shipment.updatedAt),
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
