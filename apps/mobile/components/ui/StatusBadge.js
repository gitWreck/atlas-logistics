import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { useTheme } from "../../contexts/ThemeContext";

// Color Palette for Dark Theme
const COLORS = {
  // ✅ ADDED: Active Trip Statuses
  ASSIGNED: {
    bg: "rgba(59, 130, 246, 0.2)", // Blue
    text: "#60a5fa",
    border: "#60a5fa",
  },
  CREATED: {
    bg: "rgba(148, 163, 184, 0.2)", // Slate
    text: "#cbd5e1",
    border: "#94a3b8",
  },
  ARRIVED: {
    bg: "rgba(97, 40, 231, 0.91)",
    text: "#f0f0f0ff",
    border: "rgba(138, 111, 202, 0.91)",
  },
  UNLOADING: {
    bg: "rgba(45, 212, 191, 0.2)",
    text: "#2dd4bf",
    border: "rgba(45, 212, 191, 0.5)",
  },
  OPEN: {
    bg: "rgba(148, 163, 184, 0.2)",
    text: "#cbd5e1",
    border: "#94a3b8",
  },
  LOCKED: {
    bg: "rgba(245, 158, 11, 0.2)",
    text: "#fbbf24",
    border: "rgba(245, 158, 11, 0.5)",
  },
  RECEIVING_IN_PROGRESS: {
    bg: "rgba(45, 212, 191, 0.2)",
    text: "#2dd4bf",
    border: "rgba(45, 212, 191, 0.5)",
  },
  RECONCILED: {
    bg: "rgba(34, 197, 94, 0.15)",
    text: "#4ade80",
    border: "rgba(34, 197, 94, 0.5)",
  },

  // Existing Package Statuses
  PENDING_PICKUP: {
    bg: "rgba(245, 158, 11, 0.15)",
    text: "#d97706",
    border: "rgba(245, 158, 11, 0.5)",
  },
  ACTIVE: {
    bg: "rgba(34, 197, 94, 0.15)",
    text: "#15803d",
    border: "rgba(34, 197, 94, 0.5)",
  },
  IN_TRANSIT: {
    bg: "rgba(34, 197, 94, 0.15)",
    text: "#15803d",
    border: "rgba(34, 197, 94, 0.5)",
  },
  OUT_FOR_DELIVERY: {
    bg: "rgba(34, 197, 94, 0.15)",
    text: "#15803d",
    border: "rgba(34, 197, 94, 0.5)",
  },
  DELIVERED: {
    bg: "rgba(243, 244, 246, 0.85)",
    text: "#475569",
    border: "rgba(203, 213, 225, 0.75)",
  },
  COMPLETED: {
    // Map COMPLETED to DELIVERED style
    bg: "rgba(243, 244, 246, 0.85)",
    text: "#475569",
    border: "rgba(203, 213, 225, 0.75)",
  },
  RECEIVED: {
    bg: "rgba(243, 244, 246, 0.85)",
    text: "#475569",
    border: "rgba(203, 213, 225, 0.75)",
  },
  RETURNED: {
    bg: "rgba(249, 115, 22, 0.15)",
    text: "#b45309",
    border: "rgba(249, 115, 22, 0.5)",
  },
  RELEASED: {
    bg: "rgba(59, 130, 246, 0.15)",
    text: "#60a5fa",
    border: "rgba(59, 130, 246, 0.5)",
  },
  FAILED_DELIVERY: {
    bg: "rgba(239, 68, 68, 0.15)",
    text: "#b91c1c",
    border: "rgba(239, 68, 68, 0.5)",
  },
  CANCELLED: {
    bg: "rgba(254, 226, 226, 0.9)",
    text: "#b91c1c",
    border: "rgba(239, 68, 68, 0.5)",
  },
  PENDING: {
    bg: "rgba(148, 163, 184, 0.15)",
    text: "#475569",
    border: "rgba(148, 163, 184, 0.5)",
  },
};

COLORS.RECEIVED_AT_DIVISORIA = COLORS.RECEIVED;
COLORS.AVAILABLE_AT_ODIONGAN_WAREHOUSE = COLORS.AVAILABLE_AT_WAREHOUSE;
COLORS.ARRIVED_AT_ODIONGAN = COLORS.AVAILABLE_AT_WAREHOUSE;

const STATUS_LABELS = {
  RECEIVED_AT_DIVISORIA: "Received at Divisoria",
  RECEIVED: "Received at Divisoria",
  AVAILABLE_AT_ODIONGAN_WAREHOUSE: "Available at Odiongan",
  AVAILABLE_AT_WAREHOUSE: "Available at Odiongan",
  ARRIVED_AT_ODIONGAN: "Arrived at Odiongan",
  COMPLETED: "Delivered",
};

function getSemanticStatusTheme(status, colors) {
  if (status === "PENDING_PICKUP") {
    return { bg: colors.warningSoft, text: colors.warning, border: colors.warning };
  }
  if (status === "ACTIVE" || status === "IN_TRANSIT" || status === "OUT_FOR_DELIVERY") {
    return { bg: colors.successSoft, text: colors.success, border: colors.success };
  }
  if (
    status === "DELIVERED" ||
    status === "COMPLETED" ||
    status === "RECEIVED" ||
    status === "RECEIVED_AT_DIVISORIA"
  ) {
    return {
      bg: colors.neutralSoft,
      text: colors.neutral,
      border: colors.neutralBorder,
    };
  }
  if (status === "CANCELLED" || status === "FAILED_DELIVERY") {
    return { bg: colors.dangerSoft, text: colors.danger, border: colors.danger };
  }
  if (status === "RETURNED" || status.startsWith("RETURNED_")) {
    return { bg: colors.orangeSoft, text: colors.orange, border: colors.orangeBorder };
  }
  return null;
}

export default function StatusBadge({ status }) {
  const { colors } = useTheme();
  // 1. Normalize Status
  const currentStatus = (status || "PENDING").toUpperCase();

  // 2. Get Colors (Fallback to PENDING if undefined)
  const theme = getSemanticStatusTheme(currentStatus, colors) || COLORS[currentStatus] || COLORS.PENDING;

  // 3. Format Text
  const label =
    STATUS_LABELS[currentStatus] || currentStatus.replace(/_/g, " ");
  const isLongLabel = label.length > 16;

  return (
    <View
      style={[
        styles.badge,
        isLongLabel && styles.badgeCompact,
        { backgroundColor: theme.bg, borderColor: theme.border },
      ]}
    >
      <Text
        style={[
          styles.text,
          isLongLabel && styles.textCompact,
          { color: theme.text },
        ]}
        numberOfLines={2}
      >
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    alignSelf: "flex-start",
    alignItems: "center",
    justifyContent: "center",
    maxWidth: "100%",
    flexShrink: 1,
  },
  badgeCompact: {
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  text: {
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    textAlign: "center",
  },
  textCompact: {
    fontSize: 10,
    letterSpacing: 0.3,
    lineHeight: 13,
  },
});
