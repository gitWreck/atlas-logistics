import { Dimensions } from "react-native";

export const SUCCESS_MODAL_SECONDS = 2;
export const DELIVERY_PROOF_MIN_IMAGES = 1;
export const DELIVERY_PROOF_MAX_IMAGES = 5;

export const WINDOW_HEIGHT = Dimensions.get("window").height;
export const MIN_DETAILS_SHEET_HEIGHT = Math.round(WINDOW_HEIGHT * 0.2);
export const MAX_DETAILS_SHEET_HEIGHT = Math.round(WINDOW_HEIGHT * 0.8);
export const DEFAULT_DETAILS_SHEET_HEIGHT = Math.round(WINDOW_HEIGHT * 0.5);

/** Checker: load released pieces onto the van (Available tab). */
export const CHECKER_LOAD_SCAN_ACTIONS = [
  {
    label: "Load",
    status: "LOAD_TO_VEHICLE",
    icon: "truck",
    color: "#2563eb",
  },
];

/** Checker: complete last-mile work on pieces already on the van. */
export const CHECKER_OFFLOAD_SCAN_ACTIONS = [
  {
    label: "Delivered",
    status: "DELIVERED",
    icon: "check-circle",
    color: "#2563eb",
  },
  {
    label: "Failed delivery",
    status: "FAILED_DELIVERY",
    icon: "exclamation-triangle",
    color: "#dc2626",
  },
  {
    label: "Return to warehouse",
    status: "RETURNED_TO_WAREHOUSE",
    icon: "warehouse",
    color: "#b45309",
  },
];

/** Trip manifest: hub unload / linehaul receive at destination. */
export const TRIP_OFFLOAD_SCAN_ACTIONS = [
  {
    label: "Out for Delivery",
    shortLabel: "Out",
    status: "OUT_FOR_DELIVERY",
    icon: "route",
    color: "#7c3aed",
  },
  {
    label: "Delivered",
    status: "DELIVERED",
    icon: "check-circle",
    color: "#2563eb",
  },
  {
    label: "Failed delivery",
    status: "FAILED_DELIVERY",
    icon: "exclamation-triangle",
    color: "#dc2626",
  },
  {
    label: "Received",
    status: "RECEIVED",
    icon: "warehouse",
    color: "#10b981",
  },
  {
    label: "Return to warehouse",
    status: "RETURNED_TO_WAREHOUSE",
    icon: "warehouse",
    color: "#b45309",
  },
];

export const MODE_SCAN_ACTIONS = {
  loading: [
    {
      label: "Loaded",
      status: "LOADED",
      icon: "truck",
      color: "#2563eb",
    },
  ],
  offloading: TRIP_OFFLOAD_SCAN_ACTIONS,
  info: [
    {
      label: "Information",
      status: null,
      icon: "info-circle",
      color: "#6366f1",
    },
  ],
  delivery: CHECKER_LOAD_SCAN_ACTIONS,
};

export function getPrimaryScanActions(mode, { tripId = null } = {}) {
  if (mode === "delivery") {
    return CHECKER_LOAD_SCAN_ACTIONS;
  }
  if (mode === "offloading" && !tripId) {
    return CHECKER_OFFLOAD_SCAN_ACTIONS;
  }
  return MODE_SCAN_ACTIONS[mode] || [];
}

export function getDefaultScanStatus(mode, { tripId = null } = {}) {
  if (mode === "offloading" && !tripId) {
    return "DELIVERED";
  }
  return getPrimaryScanActions(mode, { tripId })?.[0]?.status ?? null;
}

export function isCheckerLastMileScanMode(mode, { tripId = null } = {}) {
  return mode === "delivery" || (mode === "offloading" && !tripId);
}

export const ISSUE_SCAN_ACTIONS = [
  {
    label: "Mark Missing",
    status: "MISSING",
    icon: "exclamation-triangle",
    color: "#dc2626",
  },
  {
    label: "Mark Damaged",
    status: "DAMAGED",
    icon: "tools",
    color: "#f59e0b",
  },
];

export const OFFLOAD_COMPLETION_SOURCE_STATUSES = [
  "LOADED",
  "READY_FOR_DELIVERY",
  "OUT_FOR_DELIVERY",
];

export const EMPTY_TRIP_SUMMARY = {
  tripId: "",
  status: "",
  shipmentCount: 0,
  totalPackages: 0,
  scannedPackages: 0,
  loadedPackages: 0,
  deliveredPackages: 0,
  progress: 0,
};

export const EMPTY_SHIPMENT_SUMMARY = {
  shipmentId: "",
  status: "",
  shipmentCount: 0,
  totalPackages: 0,
  scannedPackages: 0,
  loadedPackages: 0,
  deliveredPackages: 0,
  progress: 0,
};

export const EMPTY_SCAN_DETAILS = {
  type: "waiting",
  code: "",
  title: "Ready to scan",
  shipmentId: "",
  trackingNumber: "",
  packageStatus: "",
  shipmentStatus: "",
  currentTripId: "",
  customerName: "",
  source: "",
};
