import React from "react";
import { View, Text, StyleSheet } from "react-native";

// Color Palette for Dark Theme
const COLORS = {
  // ✅ ADDED: Active Trip Statuses
  IN_TRANSIT: {
    bg: "rgba(34, 197, 94, 0.2)", // Green background
    text: "#4ade80", // Green text
    border: "#4ade80", // Green border
  },
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
  DELIVERED: {
    bg: "rgba(34, 197, 94, 0.15)",
    text: "#4ade80",
    border: "rgba(34, 197, 94, 0.5)",
  },
  COMPLETED: {
    // Map COMPLETED to DELIVERED style
    bg: "rgba(34, 197, 94, 0.15)",
    text: "#4ade80",
    border: "rgba(34, 197, 94, 0.5)",
  },
  OUT_FOR_DELIVERY: {
    bg: "rgba(192, 132, 252, 0.15)",
    text: "#e879f9",
    border: "rgba(192, 132, 252, 0.5)",
  },
  PARTIALLY_DELIVERED: {
    bg: "rgba(45, 212, 191, 0.15)",
    text: "#2dd4bf",
    border: "rgba(45, 212, 191, 0.5)",
  },
  READY_FOR_DELIVERY: {
    bg: "rgba(59, 130, 246, 0.15)",
    text: "#60a5fa",
    border: "rgba(59, 130, 246, 0.5)",
  },
  LOADED: {
    bg: "rgba(251, 191, 36, 0.15)", // Changed to Amber/Orange for visibility
    text: "#fbbf24",
    border: "rgba(251, 191, 36, 0.5)",
  },
  AVAILABLE_FOR_DELIVERY: {
    bg: "rgba(59, 130, 246, 0.15)",
    text: "#60a5fa",
    border: "rgba(59, 130, 246, 0.5)",
  },
  AVAILABLE_AT_WAREHOUSE: {
    bg: "rgba(59, 130, 246, 0.15)",
    text: "#60a5fa",
    border: "rgba(59, 130, 246, 0.5)",
  },
  RECEIVED: {
    bg: "rgba(251, 146, 60, 0.15)",
    text: "#fb923c",
    border: "rgba(251, 146, 60, 0.5)",
  },
  RELEASED: {
    bg: "rgba(59, 130, 246, 0.15)",
    text: "#60a5fa",
    border: "rgba(59, 130, 246, 0.5)",
  },
  FAILED_DELIVERY: {
    bg: "rgba(239, 68, 68, 0.15)",
    text: "#f87171",
    border: "rgba(239, 68, 68, 0.5)",
  },
  PENDING: {
    bg: "rgba(148, 163, 184, 0.15)",
    text: "#94a3b8",
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

export default function StatusBadge({ status }) {
  // 1. Normalize Status
  const currentStatus = (status || "PENDING").toUpperCase();

  // 2. Get Colors (Fallback to PENDING if undefined)
  const theme = COLORS[currentStatus] || COLORS.PENDING;

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
