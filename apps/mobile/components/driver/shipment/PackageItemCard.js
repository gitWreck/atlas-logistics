import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { FontAwesome5 } from "@expo/vector-icons";
import { COLORS } from "../../constants/theme";

const PackageItemCard = ({ pkg, index }) => {
  return (
    <View style={styles.container}>
      {/* Icon Box */}
      <View style={styles.iconBox}>
        <Text style={styles.indexText}>#{index + 1}</Text>
      </View>

      {/* Details */}
      <View style={styles.details}>
        <Text style={styles.desc}>{pkg.description || "Package Item"}</Text>
        <Text style={styles.specs}>
          {pkg.weight}kg • {pkg.dimensions || "Standard"}
        </Text>
      </View>

      {/* Warnings (Fragile/Perishable) */}
      <View style={styles.tags}>
        {pkg.isFragile && (
          <View
            style={[styles.tag, { backgroundColor: "rgba(239, 68, 68, 0.2)" }]}
          >
            <FontAwesome5 name="wine-glass" size={10} color={COLORS.danger} />
          </View>
        )}
        {pkg.isPerishable && (
          <View
            style={[styles.tag, { backgroundColor: "rgba(59, 130, 246, 0.2)" }]}
          >
            <FontAwesome5 name="snowflake" size={10} color="#60a5fa" />
          </View>
        )}
      </View>
    </View>
  );
};

export default PackageItemCard;

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1e293b",
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#334155",
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: "#334155",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  indexText: { color: "#fff", fontWeight: "bold" },
  details: { flex: 1 },
  desc: { color: "#fff", fontWeight: "600", fontSize: 14 },
  specs: { color: "#94a3b8", fontSize: 12, marginTop: 2 },
  tags: { flexDirection: "row", gap: 6 },
  tag: { padding: 6, borderRadius: 6 },
});
