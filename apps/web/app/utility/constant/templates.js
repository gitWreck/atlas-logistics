// 1. UPDATED TEMPLATES (Added 'requiresDate' flag)
export const TEMPLATES = [
  {
    id: "SCHEDULED",
    label: "Scheduled Loading",
    requiresDate: true, // <--- Triggers Date Picker
    text: "Atlas Logistics: Your cargo is scheduled for loading on [DATE]. We will notify you once the truck departs.",
  },
  {
    id: "TRANSIT",
    label: "In Transit",
    text: "Atlas Logistics: The truck has departed and is currently in transit to the destination. Estimated arrival is shortly.",
  },
  {
    id: "OUT_FOR_DELIVERY",
    label: "Out for Delivery",
    text: "Atlas Logistics: Your package is out for delivery today. Please ensure someone is available to receive it.",
  },
  {
    id: "WEATHER",
    label: "Weather Delay",
    text: "Atlas Logistics: Shipments are slightly delayed due to bad weather conditions. We apologize for the inconvenience.",
  },
  {
    id: "MECHANICAL",
    label: "Mechanical Issue",
    text: "Atlas Logistics: We are experiencing a minor mechanical issue with the transport vehicle. We are working to resolve it quickly.",
  },
  {
    id: "PORT_ARRIVED",
    label: "Arrived at Port",
    text: "Atlas Logistics: Your cargo has arrived at the destination port and is being sorted for final delivery.",
  },
  {
    id: "READY_PICKUP",
    label: "Ready for Pickup",
    text: "Atlas Logistics: Your cargo is ready for pickup at our warehouse. Please bring your ID and tracking number.",
  },
  {
    id: "COMPLETED",
    label: "Trip Completed",
    text: "Atlas Logistics: Our delivery run is complete. If you haven't received your package, please contact support immediately.",
  },
];

export const STEP_LOCAL_PICKUP = [
  "CREATED",
  "DISPATCHED",
  "IN_TRANSIT",
  "ARRIVED",
  "COMPLETED",
];

export const STEP_HUB_TRANSFER = [
  "CREATED",
  "ASSIGNED",
  "LOADING",
  "LOADED",
  "IN_TRANSIT",
  "ARRIVED",
  "COMPLETED",
];

export const SHIPMENT_STATUS = [
  { value: "PENDING_PICKUP", label: "Pending Pickup" },
  { value: "PICKED_UP", label: "Picked Up" },
  { value: "RECEIVED", label: "Received at Hub" },
  { value: "LOADED", label: "Loaded on Truck" },
  { value: "IN_TRANSIT", label: "In Transit" },
  // { value: "ARRIVED", label: "Arrived at Destination" },
  { value: "OUT_FOR_DELIVERY", label: "Out for Delivery" },
  { value: "DELIVERED", label: "Delivered" },
  { value: "COMPLETED", label: "Completed" },
  { value: "CANCELLED", label: "Cancelled" },
];

export const SHIPMENT_STEPS_LOCAL_PICKUP = [
  "PENDING_PICKUP",
  "PICKED_UP",
  "RECEIVED",
  "ASSIGNED",
  "PARTIALLY_LOADED",
  "LOADED",
  "IN_TRANSIT",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
];

export const SHIPMENT_STEPS_HUB_TRANSFER = [
  "CREATED",
  "RECEIVED",
  "ASSIGNED",
  "PARTIALLY_LOADED",
  "LOADED",
  "IN_TRANSIT",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
];

export const TRUCK_STATUSES = [
  "IDLE",
  // "ACTIVE",
  "ASSIGNED",
  "IN_TRANSIT",
  "MAINTENANCE",
  "DISABLED",
  "OUT_OF_SERVICE",
];

export const INVOICE_STATUSES = ["DRAFT", "ISSUED", "PAID", "CANCELLED"];
