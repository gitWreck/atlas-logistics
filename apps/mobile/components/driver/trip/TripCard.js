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
import { Image } from "expo-image";

const CARD_BG = "#ffffff";
const LABEL_GREY = "#6b7280";
const VALUE_DARK = "#111827";
const SEPARATOR = "#e5e7eb";
const LINK_BLUE = "#067FC6";

const TripCard = ({ trip, onPress, actionLabel = "View Trip" }) => {
  const tripDisplayId = trip.tripId?.startsWith("TRIP")
    ? trip.tripId
    : `TRIP - ${trip.tripId || "—"}`;
  const truckDisplay = trip.truckPlateNumber?.startsWith("TRK")
    ? trip.truckPlateNumber
    : trip.truckPlateNumber
      ? `TRK - ${trip.truckPlateNumber}`
      : "No Truck Assigned";

  return (
    <View style={styles.card}>
      {/* Header: Trip Number label + value, Status badge */}
      <View style={styles.cardHeader}>
        <View style={styles.tripNumberBlock}>
          <Text style={styles.label}>Trip Number</Text>
          <Text style={styles.tripValue}>{tripDisplayId}</Text>
        </View>
        <StatusBadge status={trip.status} />
      </View>

      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        {/* From: row1 = icon + label (fixed gap); row2 = spacer + value (aligned with icon) */}
        <View style={[styles.locationBlock, { flex: 1 }]}>
          <View style={styles.locationRow1}>
            <View style={styles.iconColumn}>
              <FontAwesome5
                name="map-marker-alt"
                size={14}
                color={LABEL_GREY}
                style={styles.locationIcon}
              />
            </View>
            <Text style={[styles.label, styles.labelInRow]}>From</Text>
          </View>

          <View style={styles.locationRow2}>
            <Text style={styles.locationValue} numberOfLines={1}>
              {trip.origin || "—"}
            </Text>
          </View>
        </View>

        {/* To: same layout */}
        <View style={[styles.locationBlock, { flex: 1 }]}>
          <View style={styles.locationRow1}>
            <View style={styles.iconColumn}>
              <FontAwesome5
                name="map-marker-alt"
                size={14}
                color={LABEL_GREY}
                style={styles.locationIcon}
              />
            </View>
            <Text style={[styles.label, styles.labelInRow]}>To</Text>
          </View>
          <View style={styles.locationRow2}>
            <Text style={styles.locationValue} numberOfLines={1}>
              {trip.destination || "—"}
            </Text>
          </View>
        </View>
      </View>

      {/* Separator */}
      <View style={styles.separator} />

      {/* Footer: Truck + View Trip link */}
      <View style={styles.footer}>
        <View style={styles.footerRow}>
          <Image
            source={require("../../../assets/icons/truck.svg")}
            style={[styles.truckIcon, { width: 18, height: 18 }]}
          />
          <Text style={styles.truckText}>{truckDisplay}</Text>
        </View>
        <TouchableOpacity
          style={styles.viewTripTouchable}
          onPress={() => onPress(trip)}
          activeOpacity={0.7}
        >
          <Text style={styles.viewTripText}>{actionLabel}</Text>
          <Image
            source={require("../../../assets/icons/right-arrow.svg")}
            style={[styles.rightArrowIcon, { width: 15, height: 15 }]}
          />
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default TripCard;

const styles = StyleSheet.create({
  card: {
    backgroundColor: CARD_BG,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
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
    marginBottom: 16,
  },
  tripNumberBlock: {
    flex: 1,
  },
  label: {
    fontSize: 12,
    color: LABEL_GREY,
    marginBottom: 2,
  },
  tripValue: {
    fontSize: 13,
    color: VALUE_DARK,
  },
  locationBlock: {
    marginBottom: 12,
  },
  locationRow1: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 2,
  },
  locationRow2: {
    flexDirection: "row",
    alignItems: "center",
  },
  iconColumn: {
    width: 20,
    alignItems: "center",
    marginRight: 8,
  },
  locationIcon: {
    width: 16,
    textAlign: "center",
  },
  locationValue: {
    flex: 1,
    fontSize: 15,
    marginLeft: 5,
    marginTop: 10,
    color: VALUE_DARK,
  },
  labelInRow: {
    marginBottom: 0,
  },
  separator: {
    height: 1,
    backgroundColor: SEPARATOR,
    marginVertical: 14,
  },
  footer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  footerRow: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  truckIcon: {
    marginRight: 8,
    width: 18,
  },
  rightArrowIcon: {
    width: 18,
    marginLeft: 4,
  },
  truckText: {
    fontSize: 14,
    color: VALUE_DARK,
  },
  viewTripTouchable: {
    flexDirection: "row",
    alignItems: "center",
  },
  viewTripText: {
    fontSize: 14,
    color: LINK_BLUE,
  },
  viewTripChevron: {
    fontSize: 14,
    fontWeight: "600",
    color: LINK_BLUE,
  },
});
