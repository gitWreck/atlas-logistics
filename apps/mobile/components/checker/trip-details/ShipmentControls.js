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
        placeholderTextColor="#64748b"
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
  controls: { padding: 16, gap: 10 },
  searchInput: {
    backgroundColor: "#1e293b",
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#334155",
    color: "#f8fafc",
  },
  actionRow: { flexDirection: "row", gap: 10 },
  smallBtn: { flex: 1, padding: 10, borderRadius: 8, alignItems: "center" },
  btnText: { color: "#fff", fontWeight: "700", fontSize: 12 },
});
