import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { FontAwesome5 } from "@expo/vector-icons";
import { useTheme } from "../../contexts/ThemeContext";

export default function TripDetailsHeader({ tripId, plate, onBack }) {
  const { colors } = useTheme();

  return (
    <View
      style={[
        styles.header,
        { backgroundColor: colors.surface, borderBottomColor: colors.border },
      ]}
    >
      <TouchableOpacity
        onPress={onBack}
        style={[
          styles.backBtn,
          { backgroundColor: colors.cardMuted, borderColor: colors.border },
        ]}
      >
        <FontAwesome5 name="arrow-left" size={15} color={colors.text} />
      </TouchableOpacity>
      <View style={styles.textBlock}>
        <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
          {tripId || "Trip Details"}
        </Text>
        <Text
          style={[styles.subtitle, { color: colors.textMuted }]}
          numberOfLines={1}
        >
          {plate || "No Plate"}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 15,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    alignItems: "center",
    justifyContent: "center",
  },
  textBlock: {
    flex: 1,
    marginLeft: 12,
  },
  title: { fontSize: 16, fontWeight: "700", color: "#0f172a" },
  subtitle: { color: "#64748b", fontSize: 12, marginTop: 2 },
});
