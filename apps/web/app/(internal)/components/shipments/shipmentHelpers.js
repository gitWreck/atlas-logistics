const BASIC_PACKAGING_TYPES = [
  "Box",
  "Sack",
  "Crate",
  "Bundle",
  "Roll",
  "Envelope",
];

const PACKAGING_TYPES = [
  ...BASIC_PACKAGING_TYPES,
  "Can",
  "Pail Bucket",
  "Drum",
  "Pail",
  "Bucket",
  "Sheet",
];

const INITIAL_CONTACT = {
  uid: null,
  userId: null,
  name: "",
  phone: "",
  email: "",
  unit: "",
  street: "",
  barangay: "",
  city: "",
  province: "",
};

const INITIAL_PACKAGE_STATE = {
  description: "",
  weight: "",
  declaredValue: "",
  packagingType: "Box",
  isFragile: false,
  isPerishable: false,
  status: "RECEIVED",
};

function isPackageLocked(status) {
  return ["IN_TRANSIT", "DELIVERED"].includes(status);
}

function displayValue(value) {
  if (value === 0) return "0";
  return value || "-";
}

function contactLabel(contact) {
  if (!contact) return "-";
  return [contact.name, contact.phone].filter(Boolean).join(" / ") || "-";
}

function getShipmentRouteLabel(shipment) {
  if (shipment?.route) return shipment.route;

  const origin =
    shipment?.originCode && shipment?.origin
      ? `${shipment.origin}`
      : shipment?.originCode || shipment?.origin;

  const destination =
    shipment?.destinationCode && shipment?.destination
      ? `${shipment.destination}`
      : shipment?.destinationCode || shipment?.destination;

  if (origin && destination) return `${origin} to ${destination}`;
  return origin || destination || "-";
}

function collectShipmentTripIds(shipment = {}) {
  const ids = [];
  const push = (value) => {
    const trip = String(value || "").trim();
    if (trip && !ids.includes(trip)) ids.push(trip);
  };

  push(shipment?.assignedTrip?.tripId);
  push(shipment?.currentTripId);
  push(shipment?.currentTruckTripId);
  push(shipment?.truckTripId);

  if (Array.isArray(shipment?.currentTripIds)) {
    shipment.currentTripIds.forEach(push);
  }

  // Legacy field — only use when it looks like a trip code, not a shipment id.
  const legacyTrip = String(shipment?.tripId || "").trim();
  if (legacyTrip && /^TRIP-/i.test(legacyTrip)) {
    push(legacyTrip);
  }

  return ids;
}

/** Primary trip id for single-value flows (forms, defaults). */
function getShipmentTripId(shipment) {
  const ids = collectShipmentTripIds(shipment);
  return ids[0] || null;
}

/** All active trip ids. */
function getShipmentTripIds(shipment) {
  return collectShipmentTripIds(shipment);
}

/** Comma-separated label for UI display. */
function getShipmentTripIdsLabel(shipment) {
  const ids = collectShipmentTripIds(shipment);
  return ids.length > 0 ? ids.join(", ") : null;
}

function shipmentIsOnTrip(shipment, tripId) {
  const trip = String(tripId || "").trim();
  if (!trip) return false;
  return collectShipmentTripIds(shipment).includes(trip);
}

function getShipmentDisplayId(shipment) {
  return shipment?.shipmentId || shipment?.trackingNumber || shipment?.id;
}

function normalizeImages(source) {
  if (!source) return [];

  const values = Array.isArray(source) ? source : [source];

  return values
    .map((item) => {
      if (!item) return null;
      if (typeof item === "string") return item;

      return item.url || item.src || item.downloadURL || item.imageUrl || null;
    })
    .filter(Boolean);
}

function uniqueImages(...sources) {
  const seen = new Set();

  return sources.flatMap(normalizeImages).filter((url) => {
    if (seen.has(url)) return false;
    seen.add(url);
    return true;
  });
}

function normalizeRemark(value) {
  if (typeof value !== "string") return "";
  return value.trim();
}

function getShipmentRemarks(shipment, formatDate) {
  const remarks = [];
  const seen = new Set();

  const addRemark = (label, value, meta = "") => {
    const text = normalizeRemark(value);
    if (!text || seen.has(text)) return;

    remarks.push({ label, text, meta });
    seen.add(text);
  };

  addRemark("Shipment remarks", shipment?.remarks);
  addRemark("Handoff remarks", shipment?.handoffRemarks);
  addRemark("Missing remarks", shipment?.missingRemarks);

  (shipment?.statusHistory || []).forEach((event) => {
    const metaParts = [
      event.status?.replace(/_/g, " "),
      formatDate?.(event.at),
    ].filter(Boolean);

    addRemark("Status note", event.note, metaParts.join(" / "));
  });

  return remarks;
}

export {
  BASIC_PACKAGING_TYPES,
  PACKAGING_TYPES,
  INITIAL_CONTACT,
  INITIAL_PACKAGE_STATE,
  contactLabel,
  displayValue,
  getShipmentDisplayId,
  getShipmentRemarks,
  getShipmentRouteLabel,
  getShipmentTripId,
  getShipmentTripIds,
  getShipmentTripIdsLabel,
  shipmentIsOnTrip,
  isPackageLocked,
  uniqueImages,
};
