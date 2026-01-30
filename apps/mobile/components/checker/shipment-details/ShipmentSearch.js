import React from "react";
import { View, TextInput, StyleSheet } from "react-native";

export default function ShipmentSearch({ value, onChange }) {
  return (
    <View style={styles.controls}>
      <TextInput
        style={styles.searchInput}
        placeholder="Search Tracking Number..."
        placeholderTextColor="#64748b"
        value={value}
        onChangeText={onChange}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  controls: { padding: 16 },
  searchInput: {
    backgroundColor: "#1e293b",
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#334155",
    color: "#f8fafc",
  },
});
