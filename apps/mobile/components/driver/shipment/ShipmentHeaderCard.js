import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { FontAwesome5 } from "@expo/vector-icons";
import { COLORS } from "../../constants/theme"; // Adjust path
import StatusBadge from "../../ui/StatusBadge"; // Reuse your badge

const ShipmentHeaderCard = ({ shipment }) => {
  return (
    <View style={styles.card}>
      {/* Top Row: ID & Status */}
      <View style={styles.header}>
        <Text style={styles.idText}>{shipment.id || "ID: --"}</Text>
        <StatusBadge status={shipment.status} />
      </View>

      {/* Destination (Big) */}
      <View style={styles.section}>
        <View style={styles.row}>
          <FontAwesome5
            name="map-marker-alt"
            size={20}
            color={COLORS.danger}
            style={{ width: 24 }}
          />
          <View style={{ flex: 1 }}>
            <Text style={styles.addressText}>
              {shipment.recipient.address.street +
                ", " +
                shipment.recipient.address.barangay ||
                shipment.destination ||
                "No Address"}
            </Text>
            <Text style={styles.subText}>
              {shipment.recipient.address.city +
                ", " +
                shipment.recipient.address.province || "City Not Specified"}
            </Text>
          </View>
        </View>
      </View>

      {/* Receiver Info */}
      <View style={[styles.section, { borderBottomWidth: 0 }]}>
        <View style={styles.row}>
          <FontAwesome5
            name="user-check"
            size={16}
            color={COLORS.primary}
            style={{ width: 24 }}
          />
          <View>
            <Text style={styles.label}>Receiver</Text>
            <Text style={styles.valueText}>
              {shipment.recipient.name || "N/A"}
            </Text>
            <Text style={styles.phoneText}>
              {shipment.recipient.phone || "No Phone"}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
};

export default ShipmentHeaderCard;

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#334155",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#334155",
    paddingBottom: 12,
  },
  idText: { color: "#94a3b8", fontWeight: "bold", fontSize: 14 },
  section: {
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(51, 65, 85, 0.5)",
    paddingBottom: 12,
  },
  row: { flexDirection: "row", alignItems: "flex-start" },
  addressText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "bold",
    lineHeight: 24,
  },
  subText: { color: "#94a3b8", marginTop: 4 },
  label: { color: "#64748b", fontSize: 12, marginBottom: 2 },
  valueText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  phoneText: { color: COLORS.primary, fontSize: 14, marginTop: 2 },
});
