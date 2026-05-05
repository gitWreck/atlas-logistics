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
    bg: "rgba(59, 130, 246, 0.2)", // Blue
    text: "#60a5fa",
    border: "#60a5fa",
  },
  LOADING: {
    bg: "rgba(251, 191, 36, 0.15)", // Amber
    text: "#fbbf24",
    border: "rgba(251, 191, 36, 0.5)",
  },
  LOADED: {
    bg: "rgba(251, 191, 36, 0.15)", // Amber
    text: "#fbbf24",
    border: "rgba(251, 191, 36, 0.5)",
  },
  IN_TRANSIT: {
    bg: "#EFF6FF",
    text: "#1447E6",
    border: "#BEDBFF",
  },
  ARRIVED: {
    bg: "rgba(14, 165, 233, 0.15)", // Sky Blue (Intermediate Success)
    text: "#0ea5e9",
    border: "rgba(14, 165, 233, 0.5)",
  },
  COMPLETED: {
    bg: "rgba(34, 197, 94, 0.15)", // Green
    text: "#4ade80",
    border: "rgba(34, 197, 94, 0.5)",
  },

  // --- LOCAL PICKUP WORKFLOW ---
  PENDING_PICKUP: {
    bg: "rgba(249, 115, 22, 0.15)", // Orange (Needs Attention)
    text: "#f97316",
    border: "rgba(249, 115, 22, 0.5)",
  },
  PICKED_UP: {
    bg: "rgba(20, 184, 166, 0.15)", // Teal
    text: "#14b8a6",
    border: "rgba(20, 184, 166, 0.5)",
  },

  // --- DELIVERY WORKFLOW ---
  RECEIVED: {
    bg: "rgba(251, 146, 60, 0.15)",
    text: "#fb923c",
    border: "rgba(251, 146, 60, 0.5)",
  },
  OUT_FOR_DELIVERY: {
    bg: "rgba(192, 132, 252, 0.15)", // Purple
    text: "#e879f9",
    border: "rgba(192, 132, 252, 0.5)",
  },
  DELIVERED: {
    bg: "rgba(34, 197, 94, 0.15)", // Green
    text: "#4ade80",
    border: "rgba(34, 197, 94, 0.5)",
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
  { key: "Active", label: "Active" },
  { key: "COMPLETED", label: "Completed" },
  { key: "IN_TRANSIT", label: "Transit" },
];

export const CHECKER_VISIBLE_STATUSES = [
  "CREATED",
  "ASSIGNED",
  // "LOADING",
  "LOADED",
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
  "COMPLETED",
];
