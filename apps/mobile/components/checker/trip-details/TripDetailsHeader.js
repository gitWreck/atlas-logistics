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

export default function TripDetailsHeader({ tripId, plate, onBack }) {
  return (
    <View style={styles.header}>
      <TouchableOpacity onPress={onBack} style={styles.backBtn}>
        <Ionicons name="arrow-back" size={22} color="#0f172a" />
      </TouchableOpacity>
      <View style={styles.textBlock}>
        {/* <Text style={styles.label}>Trip</Text> */}
        <Text style={styles.title} numberOfLines={1}>
          {tripId}
        </Text>
        <Text style={styles.subtitle}>{plate || "No Plate"}</Text>
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
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#cbd5e1",
  },
  backBtn: { padding: 8, marginRight: 8 },
  textBlock: { flex: 1 },
  label: {
    fontSize: 11,
    fontWeight: "600",
    color: "#64748b",
    textTransform: "uppercase",
    marginBottom: 2,
  },
  title: { fontSize: 16, fontWeight: "700", color: "#0f172a" },
  subtitle: { color: "#475569", fontSize: 12, marginTop: 2 },
});
