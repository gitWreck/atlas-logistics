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

function getShipmentTripId(shipment) {
  return (
    shipment?.assignedTrip?.tripId ||
    shipment?.tripId ||
    shipment?.currentTripId ||
    shipment?.currentTruckTripId ||
    shipment?.truckTripId
  );
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
  isPackageLocked,
  uniqueImages,
};
