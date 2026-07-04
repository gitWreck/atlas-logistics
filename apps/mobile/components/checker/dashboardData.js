export function normalizeStatus(value) {
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

function statusMatches(status, targets = []) {
  return targets.includes(normalizeStatus(status));
}

function statusEventOnDate(shipment = {}, statuses = [], date) {
  const history = Array.isArray(shipment.statusHistory)
    ? shipment.statusHistory
    : [];
  return history.some((event) => {
    const status = event?.status || event?.newStatus || event?.type;
    return (
      statusMatches(status, statuses) &&
      isSameLocalDay(event?.at || event?.timestamp || event?.createdAt, date)
    );
  });
}

function pieceEventOnDate(pkg = {}, fields = [], date) {
  return fields.some((field) => isSameLocalDay(pkg?.[field], date));
}

function countPiecesForDate(
  shipment = {},
  checkerUid = null,
  date = new Date(),
  predicate,
) {
  const packages = Array.isArray(shipment.packages) ? shipment.packages : [];
  if (packages.length === 0) return predicate(shipment, null) ? 1 : 0;
  return packages.reduce((sum, pkg) => {
    if (checkerUid && !isCheckerPiece(pkg, checkerUid)) return sum;
    if (!predicate(shipment, pkg)) return sum;
    return sum + pieceQty(pkg);
  }, 0);
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

export function getDeliveredAtForDate(
  shipment = {},
  checkerUid = null,
  date = new Date(),
) {
  const packages = Array.isArray(shipment.packages) ? shipment.packages : [];
  const pieceTimes = packages
    .filter((pkg) => normalizeStatus(pkg.status) === "DELIVERED")
    .filter((pkg) => !checkerUid || isCheckerPiece(pkg, checkerUid))
    .map((pkg) => pkg.deliveredAt || pkg.updatedAt)
    .filter((value) => isSameLocalDay(value, date))
    .map(timestampMs)
    .filter(Boolean);

  if (pieceTimes.length > 0) return new Date(Math.max(...pieceTimes));

  const deliveredAt =
    shipment.deliveredAt || shipment.completedAt || shipment.updatedAt;
  if (
    ["DELIVERED", "COMPLETED"].includes(normalizeStatus(shipment.status)) &&
    isSameLocalDay(deliveredAt, date)
  ) {
    return timestampToDate(deliveredAt);
  }
  return null;
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

export function countDeliveredPiecesForDate(
  shipment = {},
  checkerUid = null,
  date = new Date(),
) {
  return countPiecesForDate(shipment, checkerUid, date, (s, pkg) => {
    if (!pkg) {
      return (
        ["DELIVERED", "COMPLETED"].includes(normalizeStatus(s.status)) &&
        (isSameLocalDay(s.deliveredAt || s.completedAt || s.updatedAt, date) ||
          statusEventOnDate(s, ["DELIVERED", "COMPLETED"], date))
      );
    }
    return (
      normalizeStatus(pkg.status) === "DELIVERED" &&
      pieceEventOnDate(pkg, ["deliveredAt", "updatedAt"], date)
    );
  });
}

export function countAvailablePiecesForDate(
  shipment = {},
  checkerUid = null,
  date = new Date(),
) {
  return countPiecesForDate(shipment, null, date, (s, pkg) => {
    if (!pkg) {
      return (
        s.availableForDelivery === true &&
        (isSameLocalDay(s.availableForDeliveryAt || s.releasedAt || s.updatedAt, date) ||
          statusEventOnDate(
            s,
            [
              "AVAILABLE_FOR_DELIVERY",
              "RELEASED_FOR_DELIVERY",
              "READY_FOR_DELIVERY",
            ],
            date,
          ))
      );
    }
    const status = normalizeStatus(pkg.status);
    return (
      (pkg.availableForDelivery === true ||
        ["RELEASED_FOR_DELIVERY", "ROUTE_ASSIGNED"].includes(status)) &&
      (pieceEventOnDate(
        pkg,
        ["availableForDeliveryAt", "releasedAt", "updatedAt"],
        date,
      ) ||
        isSameLocalDay(s.availableForDeliveryAt || s.releasedAt, date) ||
        statusEventOnDate(
          s,
          [
            "AVAILABLE_FOR_DELIVERY",
            "RELEASED_FOR_DELIVERY",
            "READY_FOR_DELIVERY",
          ],
          date,
        ))
    );
  });
}

export function countOnVanPiecesForDate(
  shipment = {},
  checkerUid = null,
  date = new Date(),
) {
  const onVanStatuses = [
    "LOADED_TO_DELIVERY_VEHICLE",
    "LOADED",
    "READY_FOR_DELIVERY",
    "PARTIALLY_LOADED",
    "OUT_FOR_DELIVERY",
    "DELIVERED",
  ];
  return countPiecesForDate(shipment, checkerUid, date, (s, pkg) => {
    if (!pkg) {
      return (
        statusMatches(s.status, ["OUT_FOR_DELIVERY", "LOADED"]) &&
        (isSameLocalDay(s.outForDeliveryAt || s.loadedAt || s.updatedAt, date) ||
          statusEventOnDate(s, ["OUT_FOR_DELIVERY", "LOADED"], date))
      );
    }
    return (
      statusMatches(pkg.status, onVanStatuses) &&
      (pieceEventOnDate(pkg, ["outForDeliveryAt", "loadedAt", "deliveredAt"], date) ||
        statusEventOnDate(s, ["OUT_FOR_DELIVERY", "LOADED"], date))
    );
  });
}

export function countFailedPiecesForDate(
  shipment = {},
  checkerUid = null,
  date = new Date(),
) {
  return countPiecesForDate(shipment, checkerUid, date, (s, pkg) => {
    if (!pkg) {
      return (
        normalizeStatus(s.status) === "FAILED_DELIVERY" &&
        (isSameLocalDay(s.failedAt || s.updatedAt, date) ||
          statusEventOnDate(s, ["FAILED_DELIVERY"], date))
      );
    }
    return (
      normalizeStatus(pkg.status) === "FAILED_DELIVERY" &&
      pieceEventOnDate(pkg, ["failedAt", "updatedAt"], date)
    );
  });
}

export function countReturnedPiecesForDate(
  shipment = {},
  checkerUid = null,
  date = new Date(),
) {
  const returnStatuses = [
    "RETURNED_TO_WAREHOUSE",
    "RETURNED_RECEIVED_AT_HUB",
    "RETURNED_RECEIVED_AT_ODIONGAN",
  ];
  return countPiecesForDate(shipment, checkerUid, date, (s, pkg) => {
    if (!pkg) {
      return (
        statusMatches(s.status, returnStatuses) &&
        (isSameLocalDay(s.returnedAt || s.updatedAt, date) ||
          statusEventOnDate(s, returnStatuses, date))
      );
    }
    return (
      statusMatches(pkg.status, returnStatuses) &&
      pieceEventOnDate(pkg, ["returnedAt", "updatedAt"], date)
    );
  });
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

export function getDeliveredShipmentsForDate(
  shipments = [],
  checkerUid = null,
  date = new Date(),
) {
  return shipments
    .filter((shipment) => countDeliveredPiecesForDate(shipment, checkerUid, date) > 0)
    .map((shipment) => ({
      ...shipment,
      deliveredAtDate: getDeliveredAtForDate(shipment, checkerUid, date),
    }))
    .sort(
      (a, b) =>
        (b.deliveredAtDate?.getTime?.() || 0) -
        (a.deliveredAtDate?.getTime?.() || 0),
    );
}

export function getShipmentActivityDates(shipments = []) {
  const dates = new Map();
  const add = (value) => {
    const date = timestampToDate(value);
    if (!date) return;
    const key = date.toISOString().slice(0, 10);
    dates.set(key, date);
  };

  shipments.forEach((shipment) => {
    [
      shipment.availableForDeliveryAt,
      shipment.releasedAt,
      shipment.loadedAt,
      shipment.outForDeliveryAt,
      shipment.deliveredAt,
      shipment.completedAt,
      shipment.failedAt,
      shipment.returnedAt,
      shipment.updatedAt,
    ].forEach(add);

    (Array.isArray(shipment.statusHistory) ? shipment.statusHistory : []).forEach(
      (event) => add(event?.at || event?.timestamp || event?.createdAt),
    );

    (Array.isArray(shipment.packages) ? shipment.packages : []).forEach((pkg) => {
      [
        pkg.availableForDeliveryAt,
        pkg.releasedAt,
        pkg.loadedAt,
        pkg.outForDeliveryAt,
        pkg.deliveredAt,
        pkg.failedAt,
        pkg.returnedAt,
        pkg.updatedAt,
      ].forEach(add);
    });
  });

  return [...dates.values()].sort((a, b) => b.getTime() - a.getTime());
}
