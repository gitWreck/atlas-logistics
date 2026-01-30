import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";

export default function TripDetailsHeader({ tripId, plate, onBack }) {
  return (
    <View style={styles.header}>
      <TouchableOpacity onPress={onBack} style={styles.backBtn}>
        <Ionicons name="arrow-back" size={24} color="#f8fafc" />
      </TouchableOpacity>
      <View>
        <Text style={styles.title}>{tripId}</Text>
        <Text style={styles.subtitle}>{plate || "No Plate"}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    padding: 20,
    paddingTop: 50,
    flexDirection: "row",
    alignItems: "center",
    gap: 15,
  },
  backBtn: { padding: 8 },
  title: { fontSize: 20, fontWeight: "800", color: "#f8fafc" },
  subtitle: { color: "#94a3b8" },
});
