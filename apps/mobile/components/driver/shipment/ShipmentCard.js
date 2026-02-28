import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from "react-native";
import { FontAwesome5 } from "@expo/vector-icons";
import StatusBadge from "../../ui/figma/StatusBadge";

const LABEL_GREY = "#6b7280";
const VALUE_DARK = "#111827";
const SEPARATOR_COLOR = "#e5e7eb";
const LINK_BLUE = "#2563eb";

const ShipmentCard = ({ shipment, onPress }) => {
  console.log("shipments: ", shipment);

  const tripId = shipment.id || shipment.trackingNumber || "—";
  const address = shipment.recipient?.address;
  const destination =
    (address?.street && address?.barangay
      ? `${address.street}, ${address.barangay}`
      : null) ||
    (address?.city && address?.province
      ? `${address.city}, ${address.province}`
      : null) ||
    shipment.destination ||
    "No Address";

  const quantity = shipment.totalItems ?? shipment.loadedCount ?? 0;

  return (
    <View style={styles.card}>
      {/* HEADER: Trip Number (icon + label/value) | Status */}
      <View style={styles.cardHeader}>
        <View style={styles.headerLeft}>
          <View style={styles.iconBox}>
            <FontAwesome5 name="box" size={14} color={LABEL_GREY} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Tracking Number</Text>
            <Text style={styles.value} numberOfLines={1}>
              {tripId}
            </Text>
          </View>
        </View>
        <StatusBadge status={shipment.status} />
      </View>

      {/* CONTENT: Item, Destination */}
      <View style={styles.body}>
        {/* <View style={styles.contentRow}>
          <Text style={styles.label}>Item</Text>
          <Text style={styles.value} numberOfLines={1}>
            {itemLabel}
          </Text>
        </View> */}

        {/* ✅ NEW: Customer Name Row */}
        <View style={styles.contentRow}>
          <Text style={styles.label}>Customer</Text>
          <Text style={styles.value} numberOfLines={1}>
            {shipment.recipient?.name || shipment.sender?.name || "Unknown"}
          </Text>
        </View>

        <View style={[styles.contentRow, styles.contentRowLast]}>
          <Text style={styles.label}>Destination</Text>
          <Text style={styles.value} numberOfLines={2}>
            {destination}
          </Text>
        </View>
      </View>

      <View style={styles.separatorLine} />

      {/* FOOTER: Quantity | View Details */}
      <TouchableOpacity
        style={styles.footer}
        onPress={() => onPress(shipment)}
        activeOpacity={0.7}
      >
        <Text style={styles.quantityText}>Quantity: {quantity}</Text>
        <View style={styles.viewDetailsRow}>
          <Text style={styles.viewDetailsText}>View Details</Text>
          <FontAwesome5 name="chevron-right" size={12} color={LINK_BLUE} />
        </View>
      </TouchableOpacity>
    </View>
  );
};

export default ShipmentCard;

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    overflow: "hidden",
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
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    padding: 16,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    gap: 10,
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: "#f3f4f6",
    justifyContent: "center",
    alignItems: "center",
  },
  label: {
    fontSize: 12,
    color: LABEL_GREY,
    marginBottom: 2,
  },
  value: {
    fontSize: 14,
    color: VALUE_DARK,
  },
  body: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  contentRow: {
    marginBottom: 10,
  },
  contentRowLast: {
    marginBottom: 0,
  },
  separatorLine: {
    height: 1,
    backgroundColor: SEPARATOR_COLOR,
    marginHorizontal: 16,
  },
  footer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  quantityText: {
    fontSize: 14,
    color: VALUE_DARK,
    fontWeight: "500",
  },
  viewDetailsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  viewDetailsText: {
    fontSize: 14,
    color: LINK_BLUE,
    fontWeight: "500",
  },
});
