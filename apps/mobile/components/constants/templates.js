// app/(customer)/tracking/components/TrackingConstants.js

export const COLORS = {
  BLUE: "#155DFC",
  GREY: "#94a3b8",
  GREY_LINE: "#e2e8f0",
  ORANGE: "#f97316",
  TEXT_DARK: "#0f172a",
};

export const BADGE_COLORS = {
  // --- TRIP & HUB STATUSES ---
  CREATED: {
    bg: "rgba(148, 163, 184, 0.2)", // Slate
    text: "#363636ff",
    border: "#94a3b8",
  },
  ASSIGNED: {
    bg: "#EFF6FF",
    text: "#1D4ED8",
    border: "#BFDBFE",
  },
  LOADING: {
    bg: "#FFFBEB",
    text: "#B45309",
    border: "#FDE68A",
  },
  LOADED: {
    bg: "#FFFBEB",
    text: "#B45309",
    border: "#FDE68A",
  },
  IN_TRANSIT: {
    bg: "#EFF6FF",
    text: "#1447E6",
    border: "#BEDBFF",
  },
  ARRIVED: {
    bg: "#F0F9FF",
    text: "#0369A1",
    border: "#BAE6FD",
  },
  COMPLETED: {
    bg: "#F0FDF4",
    text: "#15803D",
    border: "#BBF7D0",
  },

  // --- LOCAL PICKUP WORKFLOW ---
  PENDING_PICKUP: {
    bg: "rgba(249, 115, 22, 0.15)", // Orange (Needs Attention)
    text: "#f97316",
    border: "rgba(249, 115, 22, 0.5)",
  },
  PICKED_UP: {
    bg: "#F0FDFA",
    text: "#0F766E",
    border: "#99F6E4",
  },

  // --- DELIVERY WORKFLOW ---
  RECEIVED: {
    bg: "#FFF7ED",
    text: "#C2410C",
    border: "#FED7AA",
  },
  OUT_FOR_DELIVERY: {
    bg: "#FAF5FF",
    text: "#7E22CE",
    border: "#E9D5FF",
  },
  READY_FOR_DELIVERY: {
    bg: "#EFF6FF",
    text: "#2563EB",
    border: "#BFDBFE",
  },
  DELIVERED: {
    bg: "#F0FDF4",
    text: "#15803D",
    border: "#BBF7D0",
  },

  // --- EXCEPTIONS & FAILURES (NEW) ---
  FAILED_DELIVERY: {
    bg: "rgba(239, 68, 68, 0.15)", // Red
    text: "#ef4444",
    border: "rgba(239, 68, 68, 0.5)",
  },
  FAILED_PICKUP: {
    bg: "rgba(239, 68, 68, 0.15)", // Red
    text: "#ef4444",
    border: "rgba(239, 68, 68, 0.5)",
  },
  CANCELLED: {
    bg: "rgba(100, 116, 139, 0.15)", // Dark Slate
    text: "#64748b",
    border: "rgba(100, 116, 139, 0.5)",
  },

  // --- FALLBACK ---
  PENDING: {
    bg: "rgba(148, 163, 184, 0.15)",
    text: "#94a3b8",
    border: "rgba(148, 163, 184, 0.5)",
  },
};

// 1. Define the 3 Workflows with their triggering statuses built-in
export const TRACKING_WORKFLOWS = {
  SHIPMENT_PICKUP: [
    {
      key: "pending_pickup",
      label: "Pending Pickup",
      icon: "clock",
      statuses: ["CREATED", "PENDING_PICKUP"],
    },
    {
      key: "picked_up",
      label: "Picked Up",
      icon: "box-open",
      statuses: ["PICKED_UP"],
    },
    {
      key: "received",
      label: "Received at Hub",
      icon: "warehouse",
      statuses: ["RECEIVED"],
    },
    {
      key: "loaded",
      label: "Loaded",
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
      key: "ready_for_delivery",
      label: "Ready for Delivery",
      icon: "clipboard-check",
      statuses: ["READY_FOR_DELIVERY"],
    },
    {
      key: "out_for_delivery",
      label: "Out for Delivery",
      icon: "shipping-fast",
      statuses: ["OUT_FOR_DELIVERY"],
    },
    {
      key: "delivered",
      label: "Delivered",
      icon: "check-circle",
      statuses: ["DELIVERED"],
    },
  ],
  SHIPMENT_DELIVERY: [
    {
      key: "created",
      label: "Created",
      icon: "file-signature",
      statuses: ["CREATED", "ASSIGNED"],
    },
    {
      key: "received",
      label: "Received at Hub",
      icon: "warehouse",
      statuses: ["RECEIVED"],
    },
    {
      key: "loaded",
      label: "Loaded",
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
      key: "ready_for_delivery",
      label: "Ready for Delivery",
      icon: "clipboard-check",
      statuses: ["READY_FOR_DELIVERY"],
    },
    {
      key: "out_for_delivery",
      label: "Out for Delivery",
      icon: "shipping-fast",
      statuses: ["OUT_FOR_DELIVERY"],
    },
    {
      key: "delivered",
      label: "Delivered",
      icon: "check-circle",
      statuses: ["DELIVERED"],
    },
  ],
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
  DELIVERY: [
    {
      key: "assigned",
      label: "Route Assigned",
      icon: "route",
      statuses: ["CREATED"],
    },
    {
      key: "loaded",
      label: "Loaded",
      icon: "box",
      statuses: ["LOADING", "LOADED"],
    },
    {
      key: "ready",
      label: "Ready for Delivery",
      icon: "clipboard-check",
      statuses: ["READY_FOR_DELIVERY"],
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
    label: "Ready for Delivery",
    value: "READY_FOR_DELIVERY",
    icon: "clipboard-check",
    color: "#2563eb",
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

// Define the custom options for the Checker
export const CHECKER_TRIP_FILTER = [
  { label: "Show All", value: "ALL", icon: "list", color: "#64748b" },
  { label: "Created", value: "CREATED", icon: "plus-circle", color: "#8b5cf6" },
  {
    label: "Assigned",
    value: "ASSIGNED",
    icon: "user-check",
    color: "#f59e0b",
  },
  { label: "Loading", value: "LOADING", icon: "spinner", color: "#3b82f6" },
  { label: "Loaded", value: "LOADED", icon: "box", color: "#10b981" }, // Added Loaded just in case!
];

export const CHECKER_SHIPMENT_FILTER = [
  { label: "Show All", value: "ALL", icon: "list", color: "#64748b" },
  { label: "Assigned", value: "ASSIGNED", icon: "clipboard", color: "#64748b" },
  {
    label: "Loaded (Outbound)",
    value: "LOADED",
    icon: "arrow-up",
    color: "#3b82f6",
  },
  {
    label: "Received (Inbound)",
    value: "RECEIVED",
    icon: "warehouse",
    color: "#10b981",
  },
  {
    label: "Exceptions",
    value: "EXCEPTION",
    icon: "exclamation-triangle",
    color: "#ef4444",
  },
];

export const CHECKER_SHIPMENT_ACTION = [
  {
    label: "Load to Truck",
    action: "LOADED",
    icon: "arrow-up",
    color: "#3b82f6",
  }, // Blue
  // {
  //   label: "Unload from Truck",
  //   action: "UNLOAD",
  //   icon: "arrow-down",
  //   color: "#f59e0b",
  // }, // Orange
  {
    label: "Receive into Hub",
    action: "RECEIVED",
    icon: "warehouse",
    color: "#10b981",
  }, // Green
  {
    label: "Mark as Missing",
    action: "MISSING",
    icon: "question-circle",
    color: "#ef4444",
  }, // Red
];

// trip screen
export const CHECKER_TAB_OPTIONS = [
  { key: "ALL", label: "All" },
  { key: "CREATED", label: "Created" },
  { key: "LOADED", label: "Loaded" },
  { key: "OUT_FOR_DELIVERY", label: "Out for Delivery" },
  // { key: "RECEIVED", label: "Received" },
  // { key: "IN_TRANSIT", label: "Transit" },
  // { key: "RECEIVED", label: "Received" },
  // { key: "ARRIVED", label: "Arrived" },
];

export const DRIVER_TAB_OPTIONS = [
  // { key: "Upcoming", label: "Upcoming" },
  { key: "ALL", label: "All" },
  { key: "COMPLETED", label: "Completed" },
  { key: "IN_TRANSIT", label: "Transit" },
];

export const CHECKER_VISIBLE_STATUSES = [
  "CREATED",
  "ASSIGNED",
  // "LOADING",
  "LOADED",
  "READY_FOR_DELIVERY",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
  // "COMPLETED",
  // "IN_TRANSIT",
];

export const DRIVER_VISIBLE_STATUSES = [
  "CREATED",
  "ASSIGNED",
  "LOADED",
  "IN_TRANSIT",
  "ARRIVED",
  "READY_FOR_DELIVERY",
  "COMPLETED",
];
