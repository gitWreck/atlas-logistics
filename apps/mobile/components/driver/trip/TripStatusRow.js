import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { COLORS } from "../../constants/theme";

const TripStatusRow = ({ totalShipments, totalPackages }) => {
  return (
    <View style={styles.statsRow}>
      <View style={styles.statBox}>
        <Text style={styles.statNumber}>{totalShipments}</Text>
        <Text style={styles.statLabel}>Total Shipments</Text>
      </View>
      <View style={styles.statBox}>
        <Text style={styles.statNumber}>{totalPackages}</Text>
        <Text style={styles.statLabel}>Total Packages</Text>
      </View>
    </View>
  );
};

export default TripStatusRow;

const styles = StyleSheet.create({
  statsRow: { flexDirection: "row", gap: 16, marginBottom: 24 },
  statBox: {
    flex: 1,
    backgroundColor: "#1e293b",
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#334155",
  },
  statNumber: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#fff",
    marginBottom: 4,
  },
  statLabel: { color: "#94a3b8", fontSize: 12 },
});
