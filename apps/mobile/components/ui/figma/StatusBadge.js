import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { BADGE_COLORS, BADGE_COLORS_DARK } from "../../constants/templates";
import { useTheme } from "../../../contexts/ThemeContext";

export default function StatusBadge({ status }) {
  const { resolvedScheme } = useTheme();

  // 1. Normalize Status
  const currentStatus = (status || "PENDING").toUpperCase();

  // 2. Get Colors (Fallback to PENDING if undefined)
  const palette =
    resolvedScheme === "dark" ? BADGE_COLORS_DARK : BADGE_COLORS;
  const theme = palette[currentStatus] || palette.PENDING;

  // 3. Format Text (Remove underscores)
  const label = currentStatus.replace(/_/g, " ");
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
