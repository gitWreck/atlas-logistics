import React from "react";
import { View, Text, StyleSheet, Platform } from "react-native";
import { useTheme } from "../../contexts/ThemeContext";

const TripStatusRow = ({
  totalShipments = 0,
  totalPackages = 0,
  loaded = 0,
  pending = 0,
  arrived = 0,
  delivered = 0,
}) => {
  const { colors } = useTheme();
  const stats = [
    { label: "Packages", value: totalShipments },
    // { label: "Packages", value: totalPackages },
    { label: "Loaded", value: loaded, accent: "#10b981" },
    {
      label: delivered > 0 ? "Delivered" : arrived > 0 ? "Arrived" : "Pending",
      value: delivered > 0 ? delivered : arrived > 0 ? arrived : pending,
      accent: delivered > 0 || arrived > 0 ? "#3b82f6" : "#f59e0b",
    },
  ];

  return (
    <View style={styles.statsRow}>
      {stats.map((stat) => (
        <View
          key={stat.label}
          style={[
            styles.statBox,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <Text style={[styles.statLabel, { color: colors.textMuted }]}>
            {stat.label}
          </Text>
          <Text
            style={[
              styles.statNumber,
              { color: colors.text },
              stat.accent ? { color: stat.accent } : null,
            ]}
          >
            {stat.value}
          </Text>
        </View>
      ))}
    </View>
  );
};

export default TripStatusRow;

const styles = StyleSheet.create({
  statsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 24,
  },
  statBox: {
    width: "48%",
    backgroundColor: "#ffffff",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
      },
      android: { elevation: 3 },
    }),
  },
  statLabel: {
    fontSize: 12,
    color: "#6b7280",
    fontWeight: "600",
    marginBottom: 4,
  },
  statNumber: {
    fontSize: 18,
    color: "#111827",
    fontWeight: "800",
  },
});
