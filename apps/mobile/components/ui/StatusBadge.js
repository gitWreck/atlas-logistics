import React from "react";
import { View, Text, StyleSheet } from "react-native";

// Color Palette for Dark Theme
const COLORS = {
  DELIVERED: {
    bg: "rgba(34, 197, 94, 0.15)",
    text: "#4ade80",
    border: "rgba(34, 197, 94, 0.5)",
  }, // Bright Green
  OUT_FOR_DELIVERY: {
    bg: "rgba(192, 132, 252, 0.15)",
    text: "#e879f9",
    border: "rgba(192, 132, 252, 0.5)",
  }, // Purple
  LOADED: {
    bg: "rgba(59, 130, 246, 0.15)",
    text: "#60a5fa",
    border: "rgba(59, 130, 246, 0.5)",
  }, // Blue
  RECEIVED: {
    bg: "rgba(251, 146, 60, 0.15)",
    text: "#fb923c",
    border: "rgba(251, 146, 60, 0.5)",
  }, // Orange
  PENDING: {
    bg: "rgba(148, 163, 184, 0.15)",
    text: "#94a3b8",
    border: "rgba(148, 163, 184, 0.5)",
  }, // Slate Gray
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
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1, // Adds a nice crisp edge
    alignSelf: "flex-start", // Ensures badge wraps tightly around text
    alignItems: "center",
    justifyContent: "center",
  },
  text: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
});
