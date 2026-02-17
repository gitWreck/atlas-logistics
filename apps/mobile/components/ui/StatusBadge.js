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
    bg: "rgba(97, 40, 231, 0.91)", // Slate
    text: "#f0f0f0ff",
    border: "rgba(138, 111, 202, 0.91)",
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
  LOADED: {
    bg: "rgba(251, 191, 36, 0.15)", // Changed to Amber/Orange for visibility
    text: "#fbbf24",
    border: "rgba(251, 191, 36, 0.5)",
  },
  RECEIVED: {
    bg: "rgba(251, 146, 60, 0.15)",
    text: "#fb923c",
    border: "rgba(251, 146, 60, 0.5)",
  },
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
    fontWeight: "800",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
});
