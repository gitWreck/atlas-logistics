import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";

export default function ShipmentHeader({ shipmentId, onBack }) {
  return (
    <View style={styles.header}>
      <TouchableOpacity onPress={onBack} style={styles.backBtn}>
        <Ionicons name="arrow-back" size={24} color="#f8fafc" />
      </TouchableOpacity>
      <View>
        <Text style={styles.title}>Shipment Contents</Text>
        <Text style={styles.subtitle}>ID: {shipmentId}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    padding: 20,
    paddingTop: 50,
    backgroundColor: "#0f172a",
    flexDirection: "row",
    alignItems: "center",
    gap: 15,
    borderBottomWidth: 1,
    borderColor: "#334155",
  },
  backBtn: { padding: 8 },
  title: { fontSize: 18, fontWeight: "800", color: "#f8fafc" },
  subtitle: { color: "#94a3b8", fontSize: 12 },
});
