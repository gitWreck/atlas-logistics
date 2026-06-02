function coalesceShipment(shipment) {
  return shipment && typeof shipment === "object" ? shipment : {};
}

export function normalizeShipmentStatus(status) {
  return String(status || "").trim().toUpperCase();
}

function getPackages(shipment) {
  const data = coalesceShipment(shipment);
  return Array.isArray(data.packages) ? data.packages : [];
}

export function countPiecesAwaitingReturnReceive(shipment) {
  return getPackages(shipment).filter((pkg) => {
    const status = normalizeShipmentStatus(pkg.status);
    return status === "RETURNED_TO_WAREHOUSE" && !pkg.returnReceivedAt;
  }).length;
}

export function isEligibleForReturnReceive(shipment) {
  const data = coalesceShipment(shipment);
  const pendingPieces = countPiecesAwaitingReturnReceive(shipment);

  if (pendingPieces > 0) {
    return true;
  }

  const status = normalizeShipmentStatus(data.status);
  if (data.returnReceivedAt && pendingPieces === 0) {
    return false;
  }
  if (status === "RETURNED_TO_WAREHOUSE") return true;
  if (data.returnedAt && status === "RECEIVED") return true;
  return false;
}

export function getReturnReceiveBlockReason(shipment) {
  const data = coalesceShipment(shipment);
  if (!shipment) return "Select a shipment first.";

  const pendingPieces = countPiecesAwaitingReturnReceive(shipment);
  if (data.returnReceivedAt && pendingPieces === 0) {
    return `Already received by ${data.returnReceivedBy || "warehouse"}. Re-release for delivery when ready.`;
  }
  if (!isEligibleForReturnReceive(shipment)) {
    return `No pieces awaiting returned intake (status: ${data.status || "unknown"}). Checker must return pieces to Odiongan first.`;
  }
  return null;
}

export function formatReturnSummary(shipment) {
  const data = coalesceShipment(shipment);
  if (!shipment) return null;

  const parts = [];
  const pendingPieces = countPiecesAwaitingReturnReceive(shipment);
  if (pendingPieces > 0) {
    parts.push(`${pendingPieces} piece${pendingPieces === 1 ? "" : "s"} awaiting intake`);
  }

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
