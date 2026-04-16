// components/checker/StatsBoard.js
import React from "react";
import { View, Text, StyleSheet } from "react-native";

export default function StatusBoard({ stats, filterMode }) {
  const timeLabel = filterMode === "TODAY" ? "Today" : "7 Days";

  return (
    <View style={styles.statsRow}>
      {/* INBOUND */}
      <View style={styles.statCard}>
        <Text style={styles.statVal}>{stats.received}</Text>
        <Text style={styles.statLabel}>Received</Text>
        <Text style={styles.statSub}>{timeLabel}</Text>
        <View style={[styles.statBar, { backgroundColor: "#3b82f6" }]} />
      </View>

      {/* OUTBOUND */}
      <View style={styles.statCard}>
        <Text style={styles.statVal}>{stats.loaded}</Text>
        <Text style={styles.statLabel}>Loaded</Text>
        <Text style={styles.statSub}>{timeLabel}</Text>
        <View style={[styles.statBar, { backgroundColor: "#10b981" }]} />
      </View>

      {/* BACKLOG (Always Active) */}
      <View style={styles.statCard}>
        <Text style={styles.statVal}>{stats.total}</Text>
        <Text style={styles.statLabel}>Total</Text>
        <Text style={[styles.statSub, { color: "#f59e0b" }]}>Active</Text>
        <View style={[styles.statBar, { backgroundColor: "#f59e0b" }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  statsRow: {
    flexDirection: "row",
    gap: 12,
    // marginBottom: 20
  },
  statCard: {
    flex: 1,
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
  statLabel: { color: "#475569", fontSize: 12, fontWeight: "600" },
  statSub: { fontSize: 10, color: "#64748b", marginBottom: 8, marginTop: 2 },
  statBar: { height: 4, borderRadius: 2, width: "40%" },
});
