import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { FontAwesome5 } from "@expo/vector-icons";

export default function StatusRouteCard({
  status,
  origin,
  destination,
  originCode,
  destCode,
}) {
  return (
    <View style={styles.statusRouteRow}>
      {/* Status Card */}
      <View style={styles.statusCard}>
        <Text style={styles.labelMuted}>Current Status</Text>
        <View style={styles.statusPill}>
          <Text style={styles.statusPillText}>{status || "Unknown"}</Text>
        </View>
        <Text style={styles.updatedText}>Updated just now</Text>
      </View>

      {/* Route Card */}
      <View style={styles.routeCard}>
        <Text style={styles.labelMuted}>Route</Text>
        <View style={styles.routeRow}>
          <View style={styles.routeEndpoint}>
            <Text style={styles.routeCodeText}>{originCode || "ORIG"}</Text>
            <Text style={styles.routeCityText} numberOfLines={1}>
              {origin || ""}
            </Text>
          </View>

          <FontAwesome5 name="long-arrow-alt-right" size={20} color="#64748b" />

          <View style={styles.routeEndpoint}>
            <Text style={styles.routeCodeText}>{destCode || "DEST"}</Text>
            <Text style={styles.routeCityText} numberOfLines={1}>
              {destination || ""}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  statusRouteRow: { flexDirection: "row", gap: 12, marginBottom: 20 },
  statusCard: {
    flex: 1,
    backgroundColor: "#ffffff",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    padding: 14,
  },
  routeCard: {
    flex: 1,
    backgroundColor: "#ffffff",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    padding: 14,
  },
  labelMuted: {
    color: "#64748b",
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: 6,
  },
  statusPill: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "#dcfce7",
  },
  statusPillText: { color: "#16a34a", fontSize: 12, fontWeight: "600" },
  updatedText: { marginTop: 8, color: "#64748b", fontSize: 11 },
  routeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  routeEndpoint: { flex: 1 },
  routeCodeText: { color: "#0f172a", fontSize: 16, fontWeight: "700" },
  routeCityText: { color: "#64748b", fontSize: 11 },
});
