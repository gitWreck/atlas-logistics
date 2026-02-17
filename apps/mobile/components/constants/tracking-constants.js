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
