function pieceQty(pkg = {}) {
  const qty = Number(pkg.quantity);
  return Number.isFinite(qty) && qty > 0 ? qty : 1;
}

function normalizeStatus(value) {
  return String(value || "").trim().toUpperCase();
}

function classifyPieceStatus(status) {
  if (status === "DELIVERED" || status === "COMPLETED") return "DELIVERED";
  if (status === "FAILED_DELIVERY") return "FAILED_DELIVERY";
  if (
    [
      "RETURNED_TO_WAREHOUSE",
      "RETURNED_RECEIVED_AT_HUB",
      "RETURNED_RECEIVED_AT_ODIONGAN",
    ].includes(status)
  ) {
    return "RETURNED_TO_WAREHOUSE";
  }
  return null;
}

function buildShipmentDeliveryLedger(shipment = {}) {
  const packages = Array.isArray(shipment.packages) ? shipment.packages : [];
  const contents = [];
  let deliveredCount = 0;
  let failedCount = 0;
  let returnedCount = 0;

  packages.forEach((pkg) => {
    const status = classifyPieceStatus(normalizeStatus(pkg.status));
    if (!status) return;

    const qty = pieceQty(pkg);
    if (status === "DELIVERED") deliveredCount += qty;
    if (status === "FAILED_DELIVERY") failedCount += qty;
    if (status === "RETURNED_TO_WAREHOUSE") returnedCount += qty;

    contents.push({
      packageId:
        pkg.packageId || pkg.trackingNumber || pkg.pieceId || pkg.barcode || null,
      description: pkg.description || "Standard Pkg",
      status,
      quantity: qty,
    });
  });

  if (
    !contents.length &&
    ["DELIVERED", "COMPLETED"].includes(normalizeStatus(shipment.status))
  ) {
    packages.forEach((pkg) => {
      const qty = pieceQty(pkg);
      deliveredCount += qty;
      contents.push({
        packageId:
          pkg.packageId || pkg.trackingNumber || pkg.pieceId || pkg.barcode || null,
        description: pkg.description || "Standard Pkg",
        status: "DELIVERED",
        quantity: qty,
      });
    });
  }

  if (!contents.length) return null;

  const originCode = shipment.originCode || "ORG";
  const destCode = shipment.destinationCode || "DEST";
  const destinationLabel =
    shipment.destinationCity ||
    shipment.destination ||
    shipment.recipient?.city ||
    destCode;

  return {
    trackingShipmentId: shipment.id || null,
    shipmentId: shipment.shipmentId || shipment.id,
    route: `${originCode} -> ${destCode}`,
    destinationLabel,
    receiverName:
      shipment.recipient?.name || shipment.receiverName || null,
    deliveredCount,
    failedCount,
    returnedCount,
    totalOutcomeCount: deliveredCount + failedCount + returnedCount,
    contents,
  };
}

export function buildDeliveryManifestShipments(shipments = []) {
  return shipments
    .map((shipment) =>
      buildShipmentDeliveryLedger(
        shipment.id ? shipment : { ...shipment, id: shipment.trackingShipmentId },
      ),
    )
    .filter(Boolean)
    .sort((a, b) => String(a.shipmentId).localeCompare(String(b.shipmentId)));
}

export function buildDeliveryDestinationsFromShipments(shipments = []) {
  const ledger = buildDeliveryManifestShipments(shipments);
  const grouped = {};

  ledger.forEach((entry) => {
    const routeParts = String(entry.route || "").split("->");
    const destCode = routeParts[1]?.trim() || "UNKNOWN";
    const destination = entry.destinationLabel || destCode;

    if (!grouped[destCode]) {
      grouped[destCode] = {
        destination,
        routeCode: entry.route || destCode,
        items: [],
      };
    }

    const descCounts = {};
    entry.contents.forEach((piece) => {
      const key = `${piece.description}::${piece.status}`;
      descCounts[key] = (descCounts[key] || 0) + piece.quantity;
    });

    const descriptionBreakdown = Object.entries(descCounts).map(([key, count]) => {
      const [desc, status] = key.split("::");
      return { desc, count, status };
    });

    grouped[destCode].items.push({
      shipmentId: entry.shipmentId,
      receiverName: entry.receiverName || null,
      deliveredCount: entry.deliveredCount,
      failedCount: entry.failedCount,
      returnedCount: entry.returnedCount,
      packageCount: entry.totalOutcomeCount,
      descriptionBreakdown,
      pieces: entry.contents,
    });
  });

  return Object.values(grouped);
}
