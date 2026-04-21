import React from "react";
import { View, Text, StyleSheet } from "react-native";

export default function StatusBoard({
  stats = {},
  filterMode = "TODAY",
  cards = [],
}) {
  const defaultTimeLabel = filterMode === "TODAY" ? "Today" : "7 Days";

  const resolvedCards = cards.map((card) => ({
    ...card,
    value:
      typeof card.value === "function"
        ? card.value(stats)
        : (card.value ?? stats?.[card.key] ?? 0),
    subLabel:
      typeof card.subLabel === "function"
        ? card.subLabel(filterMode, stats)
        : (card.subLabel ?? defaultTimeLabel),
  }));

  return (
    <View style={styles.statsRow}>
      {resolvedCards.map((card) => (
        <View key={card.key || card.label} style={styles.statCard}>
          <Text style={styles.statVal}>{card.value}</Text>
          <Text style={styles.statLabel}>{card.label}</Text>
          <Text
            style={[
              styles.statSub,
              card.subLabelColor ? { color: card.subLabelColor } : null,
            ]}
          >
            {card.subLabel}
          </Text>
          <View
            style={[
              styles.statBar,
              { backgroundColor: card.color || "#3b82f6" },
            ]}
          />
        </View>
      ))}
    </View>
  );
}

export const CHECKER_STATUS_BOARD_CARDS = [
  {
    key: "RECEIVED",
    label: "Received",
    color: "#3b82f6",
  },
  {
    key: "LOADED",
    label: "Loaded",
    color: "#10b981",
  },
  {
    key: "TOTAL",
    label: "Total",
    color: "#f59e0b",
    subLabel: "Active",
    subLabelColor: "#f59e0b",
  },
];

export const DRIVER_STATUS_BOARD_CARDS = [
  {
    key: "ASSIGNED",
    label: "Assigned",
    color: "#6366f1",
  },
  {
    key: "LOADED",
    label: "Loaded",
    color: "#10b981",
  },
  {
    key: "IN_TRANSIT",
    label: "In Transit",
    color: "#0ea5e9",
  },

  {
    key: "COMPLETED",
    label: "Completed",
    color: "#10b981",
  },
];

const styles = StyleSheet.create({
  statsRow: {
    flexDirection: "row",
    flexWrap: "wrap", // ✅ allows next row
    gap: 12,
  },
  statCard: {
    width: "31%", // ✅ ~3 cards per row (with gap)
    backgroundColor: "#ffffff",
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#cbd5e1",
  },
  statVal: {
    fontSize: 24,
    fontWeight: "800",
    color: "#0f172a",
    marginBottom: 4,
  },
  statLabel: {
    color: "#475569",
    fontSize: 12,
    fontWeight: "600",
  },
  statSub: {
    fontSize: 10,
    color: "#64748b",
    marginBottom: 8,
    marginTop: 2,
  },
  statBar: {
    height: 4,
    borderRadius: 2,
    width: "40%",
  },
});
