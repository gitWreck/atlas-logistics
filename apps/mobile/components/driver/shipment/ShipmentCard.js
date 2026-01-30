import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { FontAwesome5 } from "@expo/vector-icons";
import { COLORS } from "../../constants/theme";
import StatusBadge from "../../ui/StatusBadge"; // Reuse your existing badge

const ShipmentCard = ({ shipment, onPress }) => {
  console.log("shipment details: ", shipment);
  return (
    <View style={styles.card}>
      {/* HEADER: ID + Status */}
      <View style={styles.cardHeader}>
        <Text style={styles.idText}>
          {shipment.id || shipment.trackingNumber}
        </Text>
        <StatusBadge status={shipment.status} />
      </View>

      {/* BODY: Destination is King */}
      <View style={styles.body}>
        {/* Destination Icon & Text */}
        <View style={styles.locationRow}>
          <View style={styles.iconBox}>
            <FontAwesome5
              name="map-marker-alt"
              size={16}
              color={COLORS.danger}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.destinationText} numberOfLines={2}>
              {shipment.receiver.address.street +
                ", " +
                shipment.receiver.address.barangay ||
                shipment.destination ||
                "No Address"}
            </Text>
            <Text style={styles.cityText}>
              {shipment.receiver.address.city +
                ", " +
                shipment.receiver.address.province || "City, Province"}
            </Text>
          </View>
        </View>

        {/* Receiver & Package Count */}
        <View style={styles.metaRow}>
          <View style={styles.metaItem}>
            <FontAwesome5 name="user" size={12} color="#94a3b8" />
            <Text style={styles.metaText}>
              {shipment.receiver.name || "Receiver"}
            </Text>
          </View>
          <View style={styles.separator} />
          <View style={styles.metaItem}>
            <FontAwesome5 name="box" size={12} color="#94a3b8" />
            <Text style={styles.metaText}>
              {shipment.loadedCount || 0}/{shipment.totalItems || 0} Items
            </Text>
          </View>
        </View>
      </View>

      {/* FOOTER: Action Button */}
      <TouchableOpacity
        style={styles.actionBtn}
        onPress={() => onPress(shipment)}
      >
        <Text style={styles.actionText}>VIEW DETAILS</Text>
        <FontAwesome5 name="chevron-right" size={12} color="#fff" />
      </TouchableOpacity>
    </View>
  );
};

export default ShipmentCard;

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#334155",
    overflow: "hidden",
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#334155",
    backgroundColor: "rgba(255,255,255,0.02)",
  },
  idText: { color: "#94a3b8", fontWeight: "bold", fontSize: 12 },

  body: { padding: 16 },
  locationRow: { flexDirection: "row", gap: 12, marginBottom: 12 },
  iconBox: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(239, 68, 68, 0.1)", // Red tint
    justifyContent: "center",
    alignItems: "center",
  },
  destinationText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
    lineHeight: 22,
  },
  cityText: { color: "#94a3b8", fontSize: 13, marginTop: 2 },

  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#0f172a",
    padding: 8,
    borderRadius: 8,
  },
  metaItem: {
    flexDirection: "row",
    gap: 6,
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
  },
  metaText: { color: "#cbd5e1", fontSize: 12, fontWeight: "500" },
  separator: { width: 1, height: 16, backgroundColor: "#334155" },

  actionBtn: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    padding: 12,
    backgroundColor: "#334155",
    gap: 8,
  },
  actionText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "bold",
    letterSpacing: 1,
  },
});
