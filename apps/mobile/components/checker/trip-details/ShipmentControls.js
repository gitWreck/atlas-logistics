import React from "react";
import {
  View,
  TextInput,
  TouchableOpacity,
  Text,
  StyleSheet,
} from "react-native";

export default function ShipmentControls({
  search,
  onSearchChange,
  onBulkOutForDelivery,
  onBulkDelivered,
}) {
  return (
    <View style={styles.controls}>
      {/* Search Input */}
      <TextInput
        style={styles.searchInput}
        placeholder="Search shipment ID or route..."
        placeholderTextColor="#94a3b8"
        value={search}
        onChangeText={onSearchChange}
      />

      {/* Action Buttons */}
      <View style={styles.actionRow}>
        <TouchableOpacity
          style={[styles.smallBtn, { backgroundColor: "#8b5cf6" }]}
          onPress={onBulkOutForDelivery}
        >
          <Text style={styles.btnText}>Set All Out for Delivery</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.smallBtn, { backgroundColor: "#10b981" }]}
          onPress={onBulkDelivered}
        >
          <Text style={styles.btnText}>Set All Delivered</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  controls: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 10,
    gap: 10,
    backgroundColor: "#f1f5f9",
  },
  searchInput: {
    backgroundColor: "#ffffff",
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    color: "#0f172a",
  },
  actionRow: { flexDirection: "row", gap: 10 },
  smallBtn: { flex: 1, padding: 10, borderRadius: 9999, alignItems: "center" },
  btnText: { color: "#fff", fontWeight: "600", fontSize: 12 },
});
