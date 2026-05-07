import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { BADGE_COLORS } from "../../constants/templates";

export default function StatusBadge({ status }) {
  // 1. Normalize Status
  const currentStatus = (status || "PENDING").toUpperCase();

  // 2. Get Colors (Fallback to PENDING if undefined)
  const theme = BADGE_COLORS[currentStatus] || BADGE_COLORS.PENDING;

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
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
});
