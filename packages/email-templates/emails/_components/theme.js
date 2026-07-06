"use strict";

const colors = {
  navy: "#1e3a5f",
  navyDark: "#0f2744",
  white: "#ffffff",
  slate50: "#f8fafc",
  slate100: "#f1f5f9",
  slate200: "#e2e8f0",
  slate500: "#64748b",
  slate600: "#475569",
  slate700: "#334155",
  slate900: "#0f172a",
  blue50: "#eff6ff",
  blue600: "#2563eb",
  green600: "#16a34a",
  green700: "#15803d",
  purple100: "#f3e8ff",
  purple700: "#7e22ce",
  green100: "#dcfce7",
  green800: "#166534",
};

const statusBadgeStyles = {
  DELIVERED: { backgroundColor: colors.green100, color: colors.green800 },
  COMPLETED: { backgroundColor: colors.green100, color: colors.green800 },
  OUT_FOR_DELIVERY: {
    backgroundColor: colors.purple100,
    color: colors.purple700,
  },
  PARTIALLY_DELIVERED: {
    backgroundColor: colors.purple100,
    color: colors.purple700,
  },
  FAILED_DELIVERY: { backgroundColor: "#fee2e2", color: "#b91c1c" },
  default: { backgroundColor: colors.slate200, color: colors.slate700 },
};

function getStatusBadgeStyle(statusCode = "") {
  const key = String(statusCode || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "_");
  return statusBadgeStyles[key] || statusBadgeStyles.default;
}

module.exports = {
  colors,
  getStatusBadgeStyle,
};
