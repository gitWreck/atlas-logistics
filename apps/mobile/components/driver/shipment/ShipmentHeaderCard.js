import React from "react";
import { View, Text, StyleSheet, Platform } from "react-native";
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

const LABEL_GREY = "#6b7280";
const VALUE_DARK = "#111827";
const SEPARATOR = "#e5e7eb";

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 15,
    paddingTop: 16,
    paddingHorizontal: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
      },
      android: { elevation: 3 },
    }),
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: SEPARATOR,
  },
  idText: {
    color: LABEL_GREY,
    fontWeight: "bold",
    fontSize: 14,
  },
  section: {
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: SEPARATOR,
    paddingBottom: 12,
  },
  row: { flexDirection: "row", alignItems: "flex-start" },
  addressText: {
    color: VALUE_DARK,
    fontSize: 16,
    fontWeight: "600",
    lineHeight: 22,
  },
  subText: { color: LABEL_GREY, marginTop: 4 },
  label: { color: LABEL_GREY, fontSize: 12, marginBottom: 2 },
  valueText: { color: VALUE_DARK, fontSize: 16, fontWeight: "600" },
  phoneText: { color: COLORS.primary, fontSize: 14, marginTop: 2 },
});
