// app/(customer)/tracking/components/TrackingConstants.js

export const COLORS = {
  BLUE: "#155DFC",
  GREY: "#94a3b8",
  GREY_LINE: "#e2e8f0",
  ORANGE: "#f97316",
  TEXT_DARK: "#0f172a",
};

export const STATUS_STEPS = [
  {
    code: "RECEIVED",
    label: "RECEIVED",
    iconName: "box-open", // Was picked-requested
  },
  {
    code: "ASSIGNED",
    label: "ASSIGNED TO A TRIP",
    iconName: "clipboard-list", // Was picked-requested
  },
  {
    code: ["LOADED", "IN_TRANSIT"],
    label: "LOADED ON TRUCK",
    iconName: "truck-loading", // Was picked-requested
  },
  {
    code: ["OUT_FOR_DELIVERY"],
    label: "IN TRANSIT",
    iconName: "shipping-fast", // Was in-transit
  },
  {
    code: "COMPLETED",
    label: "FOR DELIVERY TO CUSTOMER",
    iconName: "warehouse", // Was picked-requested
  },
  {
    code: "OUT_FOR_DELIVERY_CUSTOMER",
    label: "OUT FOR DELIVERY",
    iconName: "biking", // or "motorcycle" depending on your fleet
  },
  {
    code: "DELIVERED",
    label: "DELIVERED TO YOUR ADDRESS",
    iconName: "check-circle", // Was delivered
  },
];

export const DRIVER_STEPS = [
  {
    key: "RECEIVED",
    label: "Received",
    icon: "box", // Represents the package entering the system
  },
  {
    key: "LOADED",
    label: "Loaded",
    icon: "truck-loading", // Represents loading onto the vehicle
  },
  {
    key: "IN_TRANSIT",
    label: "In Transit",
    icon: "truck", // Represents the vehicle moving
  },
  {
    key: "ARRIVED",
    label: "Arrived",
    icon: "warehouse", // Represents arrival at the destination hub
  },
  {
    key: "OUT_FOR_DELIVERY",
    label: "Out for Delivery",
    icon: "shipping-fast", // Represents the last-mile delivery run
  },
  {
    key: "DELIVERED",
    label: "Delivered",
    icon: "check-circle", // Represents successful completion
  },
];

// 1. Define the 3 Workflows with their triggering statuses built-in
export const TRACKING_WORKFLOWS = {
  HUB_TRANSFER: [
    {
      key: "assigned",
      label: "Trip Assigned",
      icon: "clipboard-list",
      statuses: ["CREATED"],
    },
    {
      key: "loaded",
      label: "Truck Loaded",
      icon: "dolly",
      statuses: ["LOADING", "LOADED"],
    },
    {
      key: "transit",
      label: "In Transit",
      icon: "truck-moving",
      statuses: ["IN_TRANSIT"],
    },
    {
      key: "arrived",
      label: "Arrived at Hub",
      icon: "building",
      statuses: ["ARRIVED"],
    },
    {
      key: "completed",
      label: "Trip Completed",
      icon: "check-double",
      statuses: ["COMPLETED"],
    },
  ],
  LOCAL_DELIVERY: [
    {
      key: "assigned",
      label: "Route Assigned",
      icon: "route",
      statuses: ["CREATED"],
    },
    {
      key: "loaded",
      label: "Van Loaded",
      icon: "box",
      statuses: ["LOADING", "LOADED"],
    },
    {
      key: "out",
      label: "Out for Delivery",
      icon: "shipping-fast",
      statuses: ["OUT_FOR_DELIVERY"],
    },
    {
      key: "delivered",
      label: "Drop-offs Complete",
      icon: "check-circle",
      statuses: ["DELIVERED"],
    },
    {
      key: "completed",
      label: "Returned to Hub",
      icon: "warehouse",
      statuses: ["COMPLETED"],
    },
  ],
  LOCAL_PICKUP: [
    {
      key: "assigned",
      label: "Pickup Assigned",
      icon: "clipboard",
      statuses: ["CREATED", "PENDING_PICKUP"],
    },
    {
      key: "transit",
      label: "En Route to Sender",
      icon: "truck",
      statuses: ["IN_TRANSIT"],
    },
    {
      key: "arrived",
      label: "Arrived at Location",
      icon: "map-marker-alt",
      statuses: ["ARRIVED"],
    },
    {
      key: "picked",
      label: "Packages Collected",
      icon: "hand-holding-box",
      statuses: ["PICKED_UP"],
    },
    {
      key: "completed",
      label: "Brought to Hub",
      icon: "warehouse",
      statuses: ["COMPLETED", "RECEIVED"],
    },
  ],
};

// ----------------
export const DRIVER_SHIPMENT_FILTER = [
  { label: "Show All", value: "ALL", icon: "list", color: "#64748b" },
  {
    label: "To Pickup",
    value: "PENDING_PICKUP",
    icon: "box-open",
    color: "#f59e0b",
  },
  {
    label: "Assigned",
    value: "ASSIGNED",
    icon: "clipboard-list",
    color: "#8b5cf6",
  },
  {
    label: "In Transit",
    value: "truck",
    icon: "truck-moving",
    color: "#3b82f6",
  },
  {
    label: "Delivering",
    value: "OUT_FOR_DELIVERY",
    icon: "route",
    color: "#0ea5e9",
  },
  {
    label: "Delivered",
    value: "DELIVERED",
    icon: "check-circle",
    color: "#10b981",
  },
];
