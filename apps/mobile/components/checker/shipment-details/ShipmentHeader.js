import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  StatusBar,
} from "react-native";
import { FontAwesome5 } from "@expo/vector-icons";

export default function ShipmentHeader({ shipmentId, shipment, onBack }) {
  return (
    <View style={styles.container}>
      <View style={styles.navBar}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <FontAwesome5 name="arrow-left" size={18} color="#0f172a" />
        </TouchableOpacity>
        <View style={styles.titleBlock}>
          <Text style={styles.title}>Shipment Contents</Text>
          <Text style={styles.subtitle}>ID: {shipmentId}</Text>
        </View>
        <View style={styles.statusBadge}>
          <Text style={styles.statusText}>{shipment?.status || "PENDING"}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#ffffff",
    paddingTop:
      Platform.OS === "android" ? (StatusBar.currentHeight || 0) + 8 : 44,
    zIndex: 10,
  },
  navBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#f8fafc",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  titleBlock: { flex: 1 },
  title: { fontSize: 16, fontWeight: "800", color: "#0f172a" },
  subtitle: { color: "#64748b", fontSize: 11, fontWeight: "600" },
  statusBadge: {
    backgroundColor: "#eff6ff",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusText: { fontSize: 10, fontWeight: "700", color: "#2563eb" },
});
