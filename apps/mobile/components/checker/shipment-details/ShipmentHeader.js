import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  StatusBar,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

export default function ShipmentHeader({ shipmentId, onBack }) {
  return (
    <View style={styles.header}>
      <TouchableOpacity onPress={onBack} style={styles.backBtn}>
        <Ionicons name="arrow-back" size={22} color="#0f172a" />
      </TouchableOpacity>
      <View style={styles.textBlock}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>Shipment Contents</Text>
        </View>
        <Text style={styles.subtitle}>ID: {shipmentId}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 20,
    paddingTop:
      Platform.OS === "android" ? (StatusBar.currentHeight || 0) + 12 : 24,
    paddingBottom: 16,
    backgroundColor: "#ffffff",
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 1,
    borderColor: "#cbd5e1",
  },
  headerRow: {
    flexDirection: "row", // ✅ This puts them on the same line
    alignItems: "baseline", // ✅ Aligns the bottom of the texts perfectly
    gap: 6, // ✅ Adds a little space between the two words
  },
  backBtn: { padding: 8, marginRight: 8 },
  textBlock: { flex: 1 },
  title: { fontSize: 16, fontWeight: "700", color: "#0f172a" },
  subtitle: { color: "#475569", fontSize: 12, marginTop: 2 },
});
