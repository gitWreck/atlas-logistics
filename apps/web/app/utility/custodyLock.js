import { isManifestLocked } from "@/app/utility/manifestStatus";

const TERMINAL_SHIPMENT_STATUSES = new Set([
  "DELIVERED",
  "COMPLETED",
  "CANCELLED",
]);

function normalizeStatus(value) {
  return String(value || "").trim().toUpperCase();
}

export function isTerminalShipment(shipment = {}) {
  return TERMINAL_SHIPMENT_STATUSES.has(normalizeStatus(shipment.status));
}

export function resolveShipmentTripLockContext(shipment = {}) {
  const trip = shipment.truckDetails || shipment.trip || null;

  const manifestLocked = isManifestLocked({
    manifestLocked: trip?.manifestLocked,
    manifestStatus: trip?.manifestStatus,
    reconciledAt: trip?.reconciledAt,
    receivingStartedAt: trip?.receivingStartedAt,
  });

  return { manifestLocked, trip };
}

export function isShipmentCustodyLocked(shipment = {}) {
  if (!shipment || isTerminalShipment(shipment)) return false;

  const onTrip = Boolean(
    shipment.currentTripId || shipment.truckDetails?.tripId,
  );
  if (!onTrip) return false;

  const { manifestLocked } = resolveShipmentTripLockContext(shipment);
  return manifestLocked;
}

export function getCustodyLockMessage() {
  return (
    "Manifest is locked. Shipment is read-only until delivered. " +
    "Use scans (receive, load, deliver) or ask Admin to unlock for corrections."
  );
}
