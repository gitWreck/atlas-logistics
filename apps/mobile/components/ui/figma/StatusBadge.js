import React from "react";
import { View, Text, StyleSheet } from "react-native";

// Color Palette for Dark Theme
const COLORS = {
  // --- TRIP & HUB STATUSES ---
  CREATED: {
    bg: "rgba(148, 163, 184, 0.2)", // Slate
    text: "#cbd5e1",
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

export default function StatusBadge({ status }) {
  // 1. Normalize Status
  const currentStatus = (status || "PENDING").toUpperCase();

  // 2. Get Colors (Fallback to PENDING if undefined)
  const theme = COLORS[currentStatus] || COLORS.PENDING;

  // 3. Format Text (Remove underscores)
  const label = currentStatus.replace(/_/g, " ");

  console.log("status: ", status);

  return (
    <View
      style={[
        styles.badge,
        { backgroundColor: theme.bg, borderColor: theme.border },
      ]}
    >
      <Text style={[styles.text, { color: theme.text }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    // ✅ BIGGER DIMENSIONS
    paddingHorizontal: 12, // Was 10
    paddingVertical: 6, // Was 4
    borderRadius: 8,
    borderWidth: 1,
    alignSelf: "flex-start",
    alignItems: "center",
    justifyContent: "center",
    minWidth: 90, // ✅ Ensures they are all roughly the same width
  },
  text: {
    // ✅ BIGGER FONT
    fontSize: 12, // Was 10
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
});
