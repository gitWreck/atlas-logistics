// components/checker/StatsFilter.js
import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";

export default function StatusFilter({ activeFilter, onFilterChange }) {
  return (
    <View style={styles.controlsRow}>
      <Text style={styles.sectionTitle}>Facility Overview</Text>
      <View style={styles.filterContainer}>
        {["TODAY", "WEEK"].map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[
              styles.filterTab,
              activeFilter === tab && styles.activeFilter,
            ]}
            onPress={() => onFilterChange(tab)}
          >
            <Text
              style={[
                styles.filterText,
                activeFilter === tab && styles.activeFilterText,
              ]}
            >
              {tab === "TODAY" ? "Today" : "Week"}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sectionTitle: { fontSize: 18, fontWeight: "700", color: "#f8fafc" },
  controlsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
    marginTop: 10,
  },
  filterContainer: {
    flexDirection: "row",
    backgroundColor: "#1e293b",
    borderRadius: 8,
    padding: 2,
    borderWidth: 1,
    borderColor: "#334155",
  },
  filterTab: { paddingVertical: 4, paddingHorizontal: 12, borderRadius: 6 },
  activeFilter: { backgroundColor: "#3b82f6" },
  filterText: { color: "#94a3b8", fontSize: 12, fontWeight: "600" },
  activeFilterText: { color: "#fff" },
});
