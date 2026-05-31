import {
  findPackageInShipment,
  getShipmentTotal,
  isWholeShipmentScanCode,
  normalizeScanCode,
} from "../../utilities/scanner";

export const SCAN_INFO_MILESTONES = [
  {
    key: "RECEIVED_AT_DIVISORIA",
    label: "Received at Divisoria",
    match: ["RECEIVED_AT_DIVISORIA"],
  },
  {
    key: "LOADED_TO_TRIP",
    label: "Loaded to Main Truck",
    match: ["LOADED_TO_TRIP", "LOADED", "PARTIAL_LOAD"],
  },
  { key: "IN_TRANSIT", label: "In Transit", match: ["IN_TRANSIT"] },
  {
    key: "ARRIVED_ODIONGAN",
    label: "Received by Rose",
    match: ["ARRIVED_ODIONGAN"],
  },
  { key: "RECONCILED", label: "Reconciled", match: ["RECONCILED"] },
  {
    key: "RECEIVED_RETURNED",
    label: "Received returned shipment",
    match: ["RECEIVED_RETURNED_SHIPMENT"],
  },
  {
    key: "RELEASED_FOR_DELIVERY_OPERATIONS",
    label: "Released for delivery operations",
    match: ["RELEASED_FOR_DELIVERY_OPERATIONS"],
  },
  {
    key: "RELEASED_TO_CHECKER",
    label: "Released to Checker (legacy)",
    match: ["RELEASED_TO_CHECKER", "ASSIGNED_TO_CHECKER", "ASSIGNED"],
  },
  {
    key: "LOADED_TO_DELIVERY_VEHICLE",
    label: "Loaded to Delivery Vehicle",
    match: ["LOADED_TO_DELIVERY_VEHICLE", "LOAD_TO_VEHICLE"],
  },
  {
    key: "OUT_FOR_DELIVERY",
    label: "Out for Delivery",
    match: ["OUT_FOR_DELIVERY"],
  },
  { key: "DELIVERED", label: "Delivered", match: ["DELIVERED"] },
  {
    key: "FAILED",
    label: "Delivery attempted (failed)",
    match: ["FAILED_DELIVERY", "DELIVERY_ATTEMPTED"],
  },
  {
    key: "RETURNED",
    label: "Returned to warehouse",
    match: ["RETURNED_TO_WAREHOUSE", "RETURNED"],
  },
];

function formatTimestamp(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString([], {
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatGps(location) {
  if (location == null || location === "") return null;
  if (typeof location === "string" || typeof location === "number") {
    return String(location);
  }
  const lat = location.lat ?? location.latitude;
  const lng = location.lng ?? location.longitude;
  if (lat != null && lng != null) {
    return `${lat}, ${lng}`;
  }
  return null;
}

function eventMatchesMilestone(event, milestone) {
  const eventType = String(event?.eventType || "").toUpperCase();
  return milestone.match.some((key) => key === eventType);
}

export function getSortedPackages(shipmentData = {}) {
  const packages = Array.isArray(shipmentData.packages)
    ? [...shipmentData.packages]
    : [];
  return packages.sort((a, b) =>
    String(a.packageId || "").localeCompare(String(b.packageId || "")),
  );
}

export function resolveScannedPieceContext(
  shipmentData = {},
  scannedCode = "",
) {
  const packages = getSortedPackages(shipmentData);
  const total = getShipmentTotal(shipmentData) || packages.length || 0;
  const isMasterScan = isWholeShipmentScanCode(shipmentData, scannedCode);
  const matchedPkg = findPackageInShipment(shipmentData, scannedCode);
  const pieceId = matchedPkg
    ? String(matchedPkg.packageId || "").trim()
    : isMasterScan
      ? null
      : String(scannedCode || "").trim() || null;

  let pieceIndex = 0;
  if (pieceId && packages.length) {
    const idx = packages.findIndex(
      (pkg) =>
        normalizeScanCode(pkg.packageId) === normalizeScanCode(pieceId) ||
        normalizeScanCode(pkg.trackingNumber) === normalizeScanCode(pieceId),
    );
    pieceIndex = idx >= 0 ? idx + 1 : 0;
  }

  const defaultViewScope = isMasterScan || !pieceId ? "shipment" : "piece";

  return {
    packages,
    total,
    pieceId,
    pieceIndex,
    matchedPkg,
    isMasterScan,
    defaultViewScope,
  };
}

export function getMasterTrackingNumber(shipmentData = {}) {
  return (
    shipmentData.trackingNumber ||
    shipmentData.shipmentId ||
    shipmentData.id ||
    "—"
  );
}

export function getPieceStatus(shipmentData, pieceId, matchedPkg) {
  if (matchedPkg?.status) {
    return String(matchedPkg.status).toUpperCase();
  }
  if (!pieceId) {
    return String(shipmentData?.status || "").toUpperCase() || "—";
  }
  const pkg = findPackageInShipment(shipmentData, pieceId);
  return String(pkg?.status || shipmentData?.status || "").toUpperCase() || "—";
}

export function buildMilestoneChecklist(events = []) {
  const completedKeys = new Set();

  events.forEach((event) => {
    SCAN_INFO_MILESTONES.forEach((milestone) => {
      if (eventMatchesMilestone(event, milestone)) {
        completedKeys.add(milestone.key);
      }
    });
  });

  return SCAN_INFO_MILESTONES.map((milestone) => {
    const matchingEvent = [...events]
      .reverse()
      .find((event) => eventMatchesMilestone(event, milestone));

    return {
      ...milestone,
      completed: completedKeys.has(milestone.key),
      timestamp: matchingEvent?.timestamp || null,
      event: matchingEvent || null,
    };
  });
}

export function countDeliveryAttempts(events = []) {
  return events.filter((event) => {
    const type = String(event.eventType || "").toUpperCase();
    return (
      type === "FAILED_DELIVERY" ||
      type === "DELIVERY_ATTEMPTED" ||
      type === "OUT_FOR_DELIVERY"
    );
  }).length;
}

export function findLastScanEvent(events = []) {
  if (!events.length) return null;
  return [...events].reverse().find((event) => event.timestamp) || null;
}

export function findEventByType(events = [], types = []) {
  const normalized = types.map((value) => String(value).toUpperCase());
  return (
    [...events]
      .reverse()
      .find((event) =>
        normalized.includes(String(event.eventType || "").toUpperCase()),
      ) || null
  );
}

function buildReconcileResult(shipmentData = {}) {
  const expected =
    shipmentData.reconcileExpectedQty ?? shipmentData.reconcileExpected ?? null;
  const received =
    shipmentData.reconcileReceivedQty ?? shipmentData.reconcileReceived ?? null;

  if (expected == null && received == null) {
    return shipmentData.reconcileResult || null;
  }

  return `${received ?? "—"} of ${expected ?? "—"} pieces matched`;
}

export function buildScanInfoSections({
  shipmentData = {},
  events = [],
  pieceId = null,
  viewScope = "piece",
}) {
  const isPieceView = viewScope === "piece" && !!pieceId;
  const matchedPkg = pieceId
    ? findPackageInShipment(shipmentData, pieceId)
    : null;
  const packages = getSortedPackages(shipmentData);
  const total = getShipmentTotal(shipmentData) || packages.length || 0;
  const pieceIndex = pieceId
    ? packages.findIndex(
        (pkg) =>
          normalizeScanCode(pkg.packageId) === normalizeScanCode(pieceId),
      ) + 1
    : 0;

  const loadedTripEvent = findEventByType(events, [
    "LOADED_TO_TRIP",
    "LOADED",
    "PARTIAL_LOAD",
  ]);
  const odionganEvent = findEventByType(events, ["ARRIVED_ODIONGAN"]);
  const releaseEvent = findEventByType(events, [
    "RELEASED_FOR_DELIVERY_OPERATIONS",
    "RELEASED_TO_CHECKER",
    "ASSIGNED_TO_CHECKER",
  ]);
  const loadVanEvent = findEventByType(events, [
    "LOADED_TO_DELIVERY_VEHICLE",
    "LOAD_TO_VEHICLE",
  ]);
  const ofdEvent = findEventByType(events, ["OUT_FOR_DELIVERY"]);
  const deliveredEvent = findEventByType(events, ["DELIVERED"]);
  const lastEvent = findLastScanEvent(events);

  const currentStatus = isPieceView
    ? getPieceStatus(shipmentData, pieceId, matchedPkg)
    : String(shipmentData.status || "").toUpperCase() || "—";

  const statusBreakdown = packages.reduce((acc, pkg) => {
    const key = String(pkg.status || "UNKNOWN").toUpperCase();
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  return {
    summary: {
      trackingNumber: isPieceView
        ? pieceId
        : getMasterTrackingNumber(shipmentData),
      masterTracking: getMasterTrackingNumber(shipmentData),
      pieceLabel:
        isPieceView && pieceIndex > 0
          ? `${pieceIndex} of ${total}`
          : total > 1
            ? `All ${total} pieces`
            : null,
      customer:
        shipmentData.recipient?.name ||
        shipmentData.receiverName ||
        shipmentData.sender?.name ||
        "—",
      destination:
        shipmentData.destinationCode ||
        shipmentData.destination?.name ||
        shipmentData.destination ||
        "—",
      currentStatus,
      statusBreakdown: !isPieceView ? statusBreakdown : null,
    },
    mainTransport: {
      tripId:
        loadedTripEvent?.tripId ||
        shipmentData.currentTripId ||
        shipmentData.currentTruckTripId ||
        null,
      truck:
        loadedTripEvent?.truckName ||
        shipmentData.truckName ||
        shipmentData.truckInternalCode ||
        null,
      plate: loadedTripEvent?.truckPlate || shipmentData.truckPlate || null,
      driver: loadedTripEvent?.driverName || shipmentData.driverName || null,
      loadedAt: formatTimestamp(loadedTripEvent?.timestamp),
    },
    odiongan: {
      receivedBy:
        odionganEvent?.warehouseManagerName ||
        odionganEvent?.actorName ||
        shipmentData.receivedByName ||
        shipmentData.hubReceivedByName ||
        null,
      receivedAt: formatTimestamp(
        odionganEvent?.timestamp || shipmentData.hubReceivedAt,
      ),
      reconciledBy: shipmentData.reconciledBy || null,
      reconciledAt: formatTimestamp(shipmentData.reconciledAt),
      reconcileResult: buildReconcileResult(shipmentData),
      hasVariance:
        Number.isFinite(Number(shipmentData.reconcileVariance)) &&
        Number(shipmentData.reconcileVariance) !== 0,
      returnReceivedBy: shipmentData.returnReceivedBy || null,
      returnReceivedAt: formatTimestamp(shipmentData.returnReceivedAt),
      returnedBy: shipmentData.returnedByName || null,
      returnedAt: formatTimestamp(shipmentData.returnedAt),
      failureReason: shipmentData.failureReasonCode || null,
    },
    delivery: {
      releasedTo:
        releaseEvent?.checkerName ||
        (releaseEvent?.eventType === "RELEASED_FOR_DELIVERY_OPERATIONS"
          ? "Delivery operations pool (warehouse custody until load)"
          : null) ||
        shipmentData.assignedCheckerName ||
        shipmentData.checkerName ||
        null,
      deliveryVehicle:
        releaseEvent?.deliveryVehicleName ||
        shipmentData.deliveryVehicleName ||
        shipmentData.deliveryVehicleId ||
        null,
      plate: shipmentData.deliveryVehiclePlate || null,
      driver:
        loadVanEvent?.driverName ||
        ofdEvent?.driverName ||
        shipmentData.deliveryDriverName ||
        null,
      loadedForDelivery: formatTimestamp(loadVanEvent?.timestamp),
      outForDelivery: formatTimestamp(ofdEvent?.timestamp),
    },
    deliveryStatus: {
      currentStatus,
      attempts: countDeliveryAttempts(events),
      lastScan: formatTimestamp(lastEvent?.timestamp),
      gps: formatGps(
        deliveredEvent?.location ||
          ofdEvent?.location ||
          lastEvent?.location ||
          shipmentData.lastKnownLocation,
      ),
    },
    audit: {
      shipmentId: shipmentData.id || shipmentData.shipmentId || null,
      pieceId: isPieceView ? pieceId : null,
      tripId:
        shipmentData.currentTripId ||
        shipmentData.currentTruckTripId ||
        loadedTripEvent?.tripId ||
        null,
      checkerId: shipmentData.assignedCheckerId || null,
      checkerName: shipmentData.assignedCheckerName || null,
      eventCount: events.length,
      hashChainStatus: "Not enabled",
    },
  };
}

export function formatEventDetail(event = {}) {
  return [
    { label: "Date", value: formatTimestamp(event.timestamp) },
    { label: "Scanned By", value: event.actorName },
    { label: "Trip", value: event.tripId },
    {
      label: "Truck",
      value: event.truckName
        ? `${event.truckName}${event.truckPlate ? ` (${event.truckPlate})` : ""}`
        : event.truckPlate,
    },
    { label: "Checker", value: event.checkerName },
    { label: "Driver", value: event.driverName },
    { label: "Vehicle", value: event.deliveryVehicleName },
    { label: "Location", value: formatGps(event.location) },
    { label: "Device", value: event.deviceId },
    {
      label: "Event Hash",
      value: event.eventHash
        ? String(event.eventHash).slice(0, 12) + "…"
        : null,
    },
    { label: "Note", value: event.remarks },
  ].filter((row) => row.value);
}
