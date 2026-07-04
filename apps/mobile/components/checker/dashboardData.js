function normalizeStatus(value) {
  return String(value || "").trim().toUpperCase();
}

export function timestampToDate(value) {
  if (!value) return null;
  if (typeof value?.toDate === "function") return value.toDate();
  if (typeof value?.toMillis === "function") return new Date(value.toMillis());
  if (value?._seconds) return new Date(value._seconds * 1000);
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function timestampMs(value) {
  return timestampToDate(value)?.getTime?.() || 0;
}

export function isSameLocalDay(value, compare = new Date()) {
  const date = timestampToDate(value);
  if (!date) return false;
  return (
    date.getFullYear() === compare.getFullYear() &&
    date.getMonth() === compare.getMonth() &&
    date.getDate() === compare.getDate()
  );
}

function pieceQty(pkg = {}) {
  const qty = Number(pkg.quantity);
  return Number.isFinite(qty) && qty > 0 ? qty : 1;
}

function isCheckerPiece(pkg = {}, checkerUid) {
  if (!checkerUid) return false;
  const uid = String(checkerUid);
  return (
    String(pkg.deliveredByCheckerId || "") === uid ||
    String(pkg.loadedByCheckerId || "") === uid ||
    (normalizeStatus(pkg.custodyOwnerType) === "CHECKER" &&
      String(pkg.custodyOwnerId || "") === uid)
  );
}

export function getShipmentNumber(shipment = {}) {
  return (
    shipment.shipmentNumber ||
    shipment.trackingNumber ||
    shipment.shipmentId ||
    shipment.id ||
    "Shipment"
  );
}

export function getReceiverName(shipment = {}) {
  return (
    shipment.recipient?.name ||
    shipment.receiverName ||
    shipment.customerName ||
    shipment.consigneeName ||
    "Unknown receiver"
  );
}

export function getDeliveryAddress(shipment = {}) {
  const address = shipment.recipient?.address;
  if (typeof address === "string" && address.trim()) return address.trim();
  if (address && typeof address === "object") {
    return [
      address.unit,
      address.street,
      address.barangay,
      address.city,
      address.province,
    ]
      .filter(Boolean)
      .join(", ");
  }
  return (
    shipment.deliveryAddress ||
    shipment.destination ||
    shipment.recipientAddress ||
    "No address provided"
  );
}

export function getDeliveredAt(shipment = {}, checkerUid = null) {
  const packages = Array.isArray(shipment.packages) ? shipment.packages : [];
  const pieceTimes = packages
    .filter((pkg) => normalizeStatus(pkg.status) === "DELIVERED")
    .filter((pkg) => !checkerUid || isCheckerPiece(pkg, checkerUid))
    .map((pkg) => timestampMs(pkg.deliveredAt || pkg.updatedAt))
    .filter(Boolean);

  if (pieceTimes.length > 0) return new Date(Math.max(...pieceTimes));
  return timestampToDate(
    shipment.deliveredAt || shipment.completedAt || shipment.updatedAt,
  );
}

export function countDeliveredPieces(shipment = {}, checkerUid = null) {
  const packages = Array.isArray(shipment.packages) ? shipment.packages : [];
  if (packages.length === 0) {
    return ["DELIVERED", "COMPLETED"].includes(normalizeStatus(shipment.status))
      ? 1
      : 0;
  }

  return packages.reduce((sum, pkg) => {
    if (normalizeStatus(pkg.status) !== "DELIVERED") return sum;
    if (checkerUid && !isCheckerPiece(pkg, checkerUid)) return sum;
    return sum + pieceQty(pkg);
  }, 0);
}

export function countOutForDeliveryPieces(shipment = {}, checkerUid = null) {
  const packages = Array.isArray(shipment.packages) ? shipment.packages : [];
  if (packages.length === 0) {
    return normalizeStatus(shipment.status) === "OUT_FOR_DELIVERY" ? 1 : 0;
  }

  return packages.reduce((sum, pkg) => {
    const status = normalizeStatus(pkg.status);
    const isRelevant =
      status === "OUT_FOR_DELIVERY" || status === "DELIVERED";
    if (!isRelevant) return sum;
    if (checkerUid && !isCheckerPiece(pkg, checkerUid)) return sum;
    return sum + pieceQty(pkg);
  }, 0);
}

export function getDeliveredShipments(shipments = [], checkerUid = null) {
  return shipments
    .filter((shipment) => countDeliveredPieces(shipment, checkerUid) > 0)
    .map((shipment) => ({
      ...shipment,
      deliveredAtDate: getDeliveredAt(shipment, checkerUid),
    }))
    .sort(
      (a, b) =>
        (b.deliveredAtDate?.getTime?.() || 0) -
        (a.deliveredAtDate?.getTime?.() || 0),
    );
}

