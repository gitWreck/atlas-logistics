import React from "react";
import { TouchableOpacity, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { FontAwesome5 } from "@expo/vector-icons";
import { useTheme } from "../../contexts/ThemeContext";

export default function FloatingAddButton({ onPress }) {
  const { resolvedScheme } = useTheme();
  const gradient =
    resolvedScheme === "dark" ? ["#1d4ed8", "#0891b2"] : ["#042C83", "#07B9F4"];

  return (
    <TouchableOpacity
      style={styles.fabWrapper}
      onPress={onPress}
      activeOpacity={0.85}
    >
      <LinearGradient
        colors={gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.fab}
      >
        <FontAwesome5 name="plus" size={18} color="#ffffff" />
      </LinearGradient>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  fabWrapper: {
    position: "absolute",
    right: 24,
    bottom: 32,
  },
  fab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
  },
});
