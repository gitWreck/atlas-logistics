import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import ShipmentSearch from "../../checker/shipment-details/ShipmentSearch";

export default function ShipmentPackagesToolbar({
  search,
  onChangeSearch,
  editable,
  selectedCount,
  totalFiltered,
  onToggleSelectAll,
}) {
  return (
    <View style={styles.container}>
      <ShipmentSearch value={search} onChange={onChangeSearch} />

      {editable && (
        <View style={styles.selectionBar}>
          <TouchableOpacity onPress={onToggleSelectAll}>
            <Text style={styles.linkText}>
              {selectedCount > 0 && selectedCount === totalFiltered
                ? "Deselect All"
                : "Select All"}
            </Text>
          </TouchableOpacity>

          <Text style={styles.selectionCount}>{selectedCount} Selected</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#F8FAFC",
    marginBottom: 12,
  },
  selectionBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 4,
    paddingTop: 8,
    paddingBottom: 8,
  },
  linkText: {
    color: "#3B82F6",
    fontWeight: "700",
    fontSize: 13,
  },
  selectionCount: {
    color: "#64748B",
    fontSize: 12,
  },
});
