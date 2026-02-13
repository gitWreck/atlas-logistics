import React from "react";
import { View, TextInput, StyleSheet } from "react-native";

export default function ShipmentSearch({ value, onChange }) {
  return (
    <View style={styles.controls}>
      <TextInput
        style={styles.searchInput}
        placeholder="Search Tracking Number..."
        placeholderTextColor="#94a3b8"
        value={value}
        onChangeText={onChange}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  controls: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 10,
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
});
