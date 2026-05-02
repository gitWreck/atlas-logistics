import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { FontAwesome5 } from "@expo/vector-icons";

export default function TripDetailsHeader({ tripId, plate, onBack }) {
  return (
    <View style={styles.header}>
      <TouchableOpacity onPress={onBack} style={styles.backBtn}>
        <FontAwesome5 name="arrow-left" size={15} color="#0f172a" />
      </TouchableOpacity>
      <View style={styles.textBlock}>
        <Text style={styles.title} numberOfLines={1}>
          {tripId || "Trip Details"}
        </Text>
        <Text style={styles.subtitle} numberOfLines={1}>
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
