import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { FontAwesome5 } from "@expo/vector-icons";
import { COLORS } from "../../constants/theme"; // Check path
import StatusBadge from "../../ui/StatusBadge"; // Check path

const TripCard = ({ trip, onPress, actionLabel = "View Trip" }) => {
  return (
    <View style={styles.card}>
      {/* Header: ID + Status */}
      <View style={styles.cardHeader}>
        <View style={styles.plateBox}>
          <Text style={styles.plateText}>{trip.tripId}</Text>
        </View>
        <StatusBadge status={trip.status} />
      </View>

      {/* Details Body */}
      <View style={styles.cardBody}>
        {/* Route Section */}
        <View style={styles.routeContainer}>
          <View style={styles.row}>
            <FontAwesome5
              name="map-signs"
              size={16}
              color={COLORS.primary}
              style={{ marginRight: 8 }}
            />
            <Text style={styles.routeTitle}>{trip.route || "NO ROUTE"}</Text>
          </View>

          <Text style={styles.originDestinationText} numberOfLines={1}>
            {trip.origin || "Origin"}{" "}
            <FontAwesome5
              name="arrow-right"
              size={10}
              color={COLORS.textSecondary}
            />{" "}
            {trip.destination || "Destination"}
          </Text>
        </View>

        {/* Truck Info */}
        <View style={styles.row}>
          <FontAwesome5
            name="truck"
            size={14}
            color={COLORS.textSecondary}
            style={{ width: 24 }}
          />
          <Text style={styles.subText}>
            {trip.truckPlateNumber || "No Truck Assigned"}
          </Text>
        </View>
      </View>

      {/* Footer Button */}
      <TouchableOpacity
        style={styles.actionButton}
        onPress={() => onPress(trip)}
      >
        <Text style={styles.actionButtonText}>{actionLabel}</Text>
        <FontAwesome5 name="arrow-right" size={14} color="#fff" />
      </TouchableOpacity>
    </View>
  );
};

export default TripCard;

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#334155",
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  plateBox: {
    backgroundColor: "#334155",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    justifyContent: "center",
    alignItems: "center",
  },
  plateText: { color: "#fff", fontWeight: "bold", fontSize: 12 },
  cardBody: { gap: 8, marginBottom: 16 },
  row: { flexDirection: "row", alignItems: "center" },
  subText: { color: COLORS.textSecondary, fontSize: 14 },

  actionButton: {
    backgroundColor: "#334155",
    padding: 12,
    borderRadius: 8,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
  },
  actionButtonText: { color: "#fff", fontWeight: "600" },

  routeContainer: {
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#334155",
  },
  routeTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#fff",
    letterSpacing: 1,
  },
  originDestinationText: {
    color: "#94a3b8",
    fontSize: 14,
    marginTop: 4,
    marginLeft: 24,
  },
});
