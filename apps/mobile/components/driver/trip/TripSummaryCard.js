import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { FontAwesome5 } from "@expo/vector-icons";
import { COLORS } from "../../constants/theme";
import StatusBadge from "../../ui/StatusBadge"; // Adjust path

const TripSummaryCard = ({ trip }) => {
  if (!trip) return null;

  return (
    <View style={styles.summaryCard}>
      <View style={styles.cardHeader}>
        <View style={styles.plateBox}>
          <Text style={styles.plateText}>{trip.tripId}</Text>
        </View>
        <StatusBadge status={trip.status} />
      </View>

      {/* Route Big Text */}
      <View style={styles.routeSection}>
        <View style={styles.row}>
          <FontAwesome5
            name="map-signs"
            size={20}
            color={COLORS.primary}
            style={{ marginRight: 10 }}
          />
          <Text style={styles.routeTitle}>{trip.route || "NO ROUTE"}</Text>
        </View>
        <Text style={styles.routeSub}>
          {trip.origin || "Origin"}{" "}
          <FontAwesome5 name="arrow-right" size={10} color="#64748b" />{" "}
          {trip.destination || "Destination"}
        </Text>
      </View>

      {/* Truck & Driver */}
      <View style={styles.infoRow}>
        <FontAwesome5 name="truck" size={14} color="#94a3b8" />
        <Text style={styles.infoText}>
          {trip.plateNumber || "No Plate"} • {trip.driverName || "You"}
        </Text>
      </View>
    </View>
  );
};

export default TripSummaryCard;

const styles = StyleSheet.create({
  summaryCard: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: "#334155",
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  plateBox: {
    backgroundColor: "#334155",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  plateText: { color: "#fff", fontWeight: "bold" },
  routeSection: {
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#334155",
    paddingBottom: 16,
  },
  row: { flexDirection: "row", alignItems: "center" },
  routeTitle: {
    fontSize: 28,
    fontWeight: "800",
    color: "#fff",
    letterSpacing: 1,
  },
  routeSub: { color: "#94a3b8", marginTop: 4, marginLeft: 34 },
  infoRow: { flexDirection: "row", gap: 10, alignItems: "center" },
  infoText: { color: "#94a3b8", fontSize: 14 },
});
