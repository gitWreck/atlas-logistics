import React from "react";
import { TouchableOpacity, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Feather from "@expo/vector-icons/Feather";
import { useTheme } from "../../contexts/ThemeContext";

export default function FloatingAddButton({ onPress, bottom = 32, right = 24 }) {
  const { colors } = useTheme();

  return (
    <TouchableOpacity
      style={[styles.fabWrapper, { bottom, right }]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      <LinearGradient
        colors={[colors.primaryDeep, colors.primary]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.fab}
      >
        <Feather name="plus" size={30} color={colors.onPrimary} />
      </LinearGradient>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  fabWrapper: {
    position: "absolute",
    zIndex: 20,
    elevation: 8,
  },
  fab: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.22,
    shadowRadius: 14,
  },
});
