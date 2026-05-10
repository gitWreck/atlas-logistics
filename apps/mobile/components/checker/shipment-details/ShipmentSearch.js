import React from "react";
import { View, TextInput, StyleSheet } from "react-native";
import { useTheme } from "../../../contexts/ThemeContext";

export default function ShipmentSearch({ value, onChange }) {
  const { colors } = useTheme();

  return (
    <View style={[styles.controls, { backgroundColor: colors.bg }]}>
      <TextInput
        style={[
          styles.searchInput,
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
            color: colors.text,
          },
        ]}
        placeholder="Search Tracking Number..."
        placeholderTextColor={colors.textMuted}
        value={value}
        onChangeText={onChange}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  controls: {
    // paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 10,
    backgroundColor: "#f1f5f9",
  },
  searchInput: {
    backgroundColor: "#ffffff",
    padding: 12,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    color: "#0f172a",
  },
});
