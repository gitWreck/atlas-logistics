// components/checker/StatsFilter.js
import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useTheme } from "../../contexts/ThemeContext";

const GRADIENT_COLORS = ["#042C83", "#07B9F4"];

export default function StatusFilter({ activeFilter, onFilterChange }) {
  const { colors } = useTheme();

  return (
    <View style={styles.controlsRow}>
      <Text style={[styles.sectionTitle, { color: colors.text }]}>
        Facility Overview
      </Text>
      <View
        style={[
          styles.filterContainer,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        {["TODAY", "WEEK"].map((tab) => {
          const isActive = activeFilter === tab;
          return (
            <TouchableOpacity
              key={tab}
              style={styles.filterTabWrapper}
              onPress={() => onFilterChange(tab)}
              activeOpacity={0.8}
            >
              {isActive ? (
                <LinearGradient
                  colors={GRADIENT_COLORS}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.filterTab}
                >
                  <Text style={[styles.filterText, styles.activeFilterText]}>
                    {tab === "TODAY" ? "Today" : "Week"}
                  </Text>
                </LinearGradient>
              ) : (
                <View style={styles.filterTab}>
                  <Text style={[styles.filterText, { color: colors.textMuted }]}>
                    {tab === "TODAY" ? "Today" : "Week"}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sectionTitle: { fontSize: 18, fontWeight: "700", color: "#0f172a" },
  controlsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
    marginTop: 16,
  },
  filterContainer: {
    flexDirection: "row",
    backgroundColor: "#ffffff",
    borderRadius: 9999,
    padding: 4,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    alignItems: "center",
  },
  filterTabWrapper: {
    marginHorizontal: 2,
  },
  filterTab: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 9999,
  },
  filterText: { color: "#475569", fontSize: 12, fontWeight: "600" },
  activeFilterText: { color: "#fff" },
});
