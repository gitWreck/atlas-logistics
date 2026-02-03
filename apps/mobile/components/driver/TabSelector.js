import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";

// Same gradient as GradientButton for consistency
const GRADIENT_COLORS = ["#042C83", "#07B9F4"];

const TabSelector = ({ activeTab, onTabChange }) => {
  const tabs = ["Active", "Upcoming", "Completed"];

  return (
    <View style={styles.tabContainer}>
      {tabs.map((tab) => {
        const isActive = activeTab === tab;
        return (
          <TouchableOpacity
            key={tab}
            style={styles.tabWrapper}
            onPress={() => onTabChange(tab)}
            activeOpacity={0.8}
          >
            {isActive ? (
              <LinearGradient
                colors={GRADIENT_COLORS}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.tabButton}
              >
                <Text style={styles.tabTextActive}>{tab}</Text>
              </LinearGradient>
            ) : (
              <View style={styles.tabButtonInactive}>
                <Text style={styles.tabText}>{tab}</Text>
              </View>
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

export default TabSelector;

const styles = StyleSheet.create({
  tabContainer: {
    flexDirection: "row",
    marginBottom: 16,
    marginHorizontal: 16,
    marginTop: 25,
    padding: 4,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 9999, // fully circular / pill-shaped
    backgroundColor: "#ffffff",
    gap: 4,
  },
  tabWrapper: {
    flex: 1,
  },
  tabButton: {
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 9999, // fully circular / pill-shaped
  },
  tabButtonInactive: {
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 9999, // fully circular / pill-shaped
    backgroundColor: "transparent",
  },
  tabText: {
    color: "#64748b",
    fontWeight: "600",
    fontSize: 14,
  },
  tabTextActive: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 14,
  },
});
