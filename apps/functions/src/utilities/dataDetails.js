// connected to
//
const STATUS_MESSAGES = {
  LOADING:
    "Atlas Logistics: Your package is currently being loaded onto the delivery truck.",
  LOADED:
    "Atlas Logistics: Your package has been loaded and is ready for departure.",
  IN_TRANSIT:
    "Atlas Logistics: The truck has departed the warehouse and is on its way to your area.",
  ARRIVED:
    "Atlas Logistics: The truck has arrived at the local distribution center/hub.",
  COMPLETED:
    "Atlas Logistics: Delivery successful! Thank you for choosing Atlas.",
  CANCELLED:
    "Atlas Logistics: This trip has been cancelled. Please contact support for details.",

  // delay
  WEATHER:
    "Atlas Logistics: Shipments are slightly delayed due to bad weather conditions. We apologize for the inconvenience.",
  MECHANICAL:
    "Atlas Logistics: We are experiencing a minor mechanical issue with the transport vehicle. We are working to resolve it quickly.",
  PORT_CONGESTION:
    "Atlas Logistics: Your shipment is currently delayed due to high congestion at the port. We are working to clear it.",
  TRAFFIC:
    "Atlas Logistics: Delivery is delayed due to heavy traffic conditions on the route. Thank you for your patience.",

  DELAY_CLEARED:
    "Atlas Logistics: The delay has been resolved and your shipment is back on the move. Thank you for your patience.",
};

// connected to
// updateTripStatus
const VALID_TRIP_STATUSES = [
  "CREATED",
  "ASSIGNED",
  "LOADING",
  "LOADED",
  "IN_TRANSIT",
  "ARRIVED",
  "OUT_FOR_DELIVERY",
  "COMPLETED",
  "CANCELLED",
];

// connected to
// updateShipmentStatus
const ALLOWED_SHIPMENT_STATUSES = [
  "CREATED",
  "IN_TRANSIT",
  "PENDING_PICKUP",
  "PICKED_UP",
  "ASSIGNED",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
  "FAILED_DELIVERY",
  "FAILED_PICKUP",
  "CANCELLED",
  "MISSING",
  "UNLOAD",
  "COMPLETED",
  "LOADED",
  "RECEIVED",
  "PARTIALLY_LOADED",
  "PARTIALLY_RECEIVED",
];

const ALLOWED_TRUCK_STATUSES = new Set([
  "IDLE",
  "ACTIVE",
  "ASSIGNED",
  "IN_TRANSIT",
  "MAINTENANCE",
  "DISABLED",
  "OUT_OF_SERVICE",
]);

const INVOICES_ALLOWED_STATUSES = ["DRAFT", "ISSUED", "PAID", "CANCELLED"];

const INVOICES_VALID_TRANSITIONS = {
  DRAFT: ["ISSUED", "CANCELLED"],
  ISSUED: ["PAID", "CANCELLED"],
  PAID: [],
  CANCELLED: [],
};

module.exports = {
  STATUS_MESSAGES,
  VALID_TRIP_STATUSES,
  ALLOWED_SHIPMENT_STATUSES,
  ALLOWED_TRUCK_STATUSES,
  INVOICES_ALLOWED_STATUSES,
  INVOICES_VALID_TRANSITIONS,
};
