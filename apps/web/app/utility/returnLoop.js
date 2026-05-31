function coalesceShipment(shipment) {
  return shipment && typeof shipment === "object" ? shipment : {};
}

export function normalizeShipmentStatus(status) {
  return String(status || "").trim().toUpperCase();
}

export function isEligibleForReturnReceive(shipment) {
  const data = coalesceShipment(shipment);
  const status = normalizeShipmentStatus(data.status);
  if (data.returnReceivedAt) return false;
  if (status === "RETURNED_TO_WAREHOUSE") return true;
  if (data.returnedAt && status === "RECEIVED") return true;
  return false;
}

export function getReturnReceiveBlockReason(shipment) {
  const data = coalesceShipment(shipment);
  if (!shipment) return "Select a shipment first.";
  if (data.returnReceivedAt) {
    return `Already received by ${data.returnReceivedBy || "warehouse"}. Re-release to a checker when ready.`;
  }
  if (!isEligibleForReturnReceive(data)) {
    return `Status is ${data.status || "unknown"}. Checker must return the shipment to Odiongan first.`;
  }
  return null;
}

export function formatReturnSummary(shipment) {
  const data = coalesceShipment(shipment);
  if (!shipment) return null;

  const parts = [];
  if (data.failedAt || data.status === "FAILED_DELIVERY") {
    parts.push(
      data.failureReasonCode
        ? `Failed: ${data.failureReasonCode}`
        : "Failed delivery",
    );
  }
  if (data.returnedAt) {
    parts.push(
      `Returned${data.returnedByName ? ` by ${data.returnedByName}` : ""}`,
    );
  }
  if (data.returnReceivedAt) {
    parts.push(
      `Received by Rose${data.returnReceivedBy ? ` (${data.returnReceivedBy})` : ""}`,
    );
  }
  if (data.lastAssignedCheckerName || data.previousAssignedCheckerName) {
    parts.push(
      `Prior checker: ${data.lastAssignedCheckerName || data.previousAssignedCheckerName}`,
    );
  }
  return parts.join(" · ") || null;
}
