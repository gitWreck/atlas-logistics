import { Dimensions } from "react-native";

export const SUCCESS_MODAL_SECONDS = 5;
export const DELIVERY_PROOF_MIN_IMAGES = 1;
export const DELIVERY_PROOF_MAX_IMAGES = 5;

export const WINDOW_HEIGHT = Dimensions.get("window").height;
export const MIN_DETAILS_SHEET_HEIGHT = Math.round(WINDOW_HEIGHT * 0.2);
export const MAX_DETAILS_SHEET_HEIGHT = Math.round(WINDOW_HEIGHT * 0.8);
export const DEFAULT_DETAILS_SHEET_HEIGHT = Math.round(WINDOW_HEIGHT * 0.5);

export const MODE_SCAN_ACTIONS = {
  loading: [
    {
      label: "Loaded",
      status: "LOADED",
      icon: "truck",
      color: "#2563eb",
    },
  ],
  offloading: [
    {
      label: "Delivered",
      status: "DELIVERED",
      icon: "check-circle",
      color: "#2563eb",
    },
    {
      label: "Received",
      status: "RECEIVED",
      icon: "warehouse",
      color: "#10b981",
    },
  ],
  info: [
    {
      label: "Information",
      status: null,
      icon: "info-circle",
      color: "#6366f1",
    },
  ],
};

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
