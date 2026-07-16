import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { useTheme } from "../../../contexts/ThemeContext";

export default function ShipmentPackagesToolbar({
  search,
  onChangeSearch,
  editable,
  selectedCount,
  totalFiltered,
  onToggleSelectAll,
}) {
  const { colors } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      {/* selection controls removed per design */}
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
  // selectionCount style removed with selection UI
});
