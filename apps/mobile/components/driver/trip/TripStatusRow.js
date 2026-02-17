import React from "react";
import { View, Text, StyleSheet, Platform } from "react-native";

const TripStatusRow = ({ totalShipments, totalPackages }) => {
  return (
    <View style={styles.statsRow}>
      {/* <View style={styles.statBox}>
        <Text style={styles.statLabel}>Total Shipments</Text>
        <Text style={styles.statNumber}>{totalShipments}</Text>
      </View> */}
      <View style={styles.statBox}>
        <Text style={styles.statLabel}>Total Items</Text>
        <Text style={styles.statNumber}>{totalPackages}</Text>
      </View>
    </View>
  );
};

export default TripStatusRow;

const styles = StyleSheet.create({
  statsRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 24,
  },
  statBox: {
    flex: 1,
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
    marginBottom: 4,
  },
  statNumber: {
    fontSize: 18,
    color: "#111827",
  },
});
