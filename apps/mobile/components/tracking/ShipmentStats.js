import React from "react";
import { View, Text, StyleSheet } from "react-native";

export default function ShipmentStats({ total, loaded, pending }) {
  return (
    <View style={styles.footerStatsRow}>
      <View style={styles.footerStatCard}>
        <Text style={styles.footerStatLabel}>TOTAL ITEMS</Text>
        <Text style={styles.footerStatValue}>{total}</Text>
      </View>
      <View style={styles.footerStatCard}>
        <Text style={styles.footerStatLabel}>LOADED</Text>
        <Text style={styles.footerStatValue}>{loaded}</Text>
      </View>
      <View style={styles.footerStatCard}>
        <Text style={styles.footerStatLabel}>PENDING</Text>
        <Text style={styles.footerStatValue}>{pending}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  footerStatsRow: {
    flexDirection: "row",
    backgroundColor: "#ffffff",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    overflow: "hidden",
  },
  footerStatCard: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 12,
    alignItems: "center",
    borderRightWidth: 1,
    borderRightColor: "#e2e8f0",
  },
  footerStatLabel: {
    color: "#64748b",
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: 4,
  },
  footerStatValue: { color: "#0f172a", fontSize: 16, fontWeight: "700" },
});
