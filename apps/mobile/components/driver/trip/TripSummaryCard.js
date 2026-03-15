import React from "react";
import { View, Text, StyleSheet, Platform } from "react-native";
import { FontAwesome5 } from "@expo/vector-icons";
import { Image } from "expo-image";

const CARD_BG = "#ffffff";
const LABEL_GREY = "#6b7280";
const VALUE_DARK = "#111827";
const SEPARATOR = "#e5e7eb";

const TripSummaryCard = ({ trip }) => {
  if (!trip) return null;

  const tripDisplayId = trip.tripId?.startsWith("TRIP")
    ? trip.tripId
    : `TRIP - ${trip.tripId || "—"}`;
  const truckDisplay = trip.truckPlateNumber?.startsWith("TRK")
    ? trip.truckPlateNumber
    : trip.truckPlateNumber
      ? `TRK - ${trip.truckPlateNumber}`
      : "—";

  const isLocalPickup = trip.tripType === "LOCAL_PICKUP";

  return (
    <View style={styles.card}>
      <Text style={styles.sectionTitle}>Trip Summary</Text>

      <View style={styles.separator} />

      {/* Row 1: Trip Number & Type */}
      <View style={styles.twoColRow}>
        <View style={styles.half}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              marginBottom: 2,
            }}
          >
            <Text style={[styles.label, { marginBottom: 0, marginRight: 8 }]}>
              Trip Number
            </Text>

            {/* NEW: Trip Type Badge */}
            <View
              style={[
                styles.typeBadge,
                isLocalPickup ? styles.typeLocalBg : styles.typeTransferBg,
              ]}
            >
              <Text
                style={[
                  styles.typeText,
                  isLocalPickup
                    ? styles.typeLocalText
                    : styles.typeTransferText,
                ]}
              >
                {isLocalPickup ? "LOCAL PICKUP" : "HUB TRANSFER"}
              </Text>
            </View>
          </View>
          <Text style={[styles.value, { fontWeight: "600" }]}>
            {tripDisplayId}
          </Text>
        </View>
      </View>
      <View style={styles.separator} />

      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        {/* From */}
        <View
          style={[styles.locationBlock, { flex: 1 }]}
          // style={styles.locationBlock}
        >
          <View style={styles.locationRow1}>
            <View style={styles.iconColumn}>
              <Image
                source={require("../../../assets/icons/location.svg")}
                style={[
                  styles.locationIcon,
                  { width: 16, height: 16, tintColor: LABEL_GREY },
                ]}
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

        {/* To */}
        <View style={[styles.locationBlock, { flex: 1 }]}>
          <View style={styles.locationRow1}>
            <View style={styles.iconColumn}>
              <Image
                source={require("../../../assets/icons/location.svg")}
                style={[
                  styles.locationIcon,
                  { width: 16, height: 16, tintColor: LABEL_GREY },
                ]}
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

      <View style={styles.separator} />

      {/* Row: Driver | Vehicle */}
      <View style={styles.twoColRow}>
        <View style={styles.half}>
          <Text style={styles.label}>Driver</Text>
          <Text style={styles.value}>{trip.driverName || "—"}</Text>
        </View>
        <View style={styles.half}>
          <Text style={styles.label}>Vehicle</Text>
          <Text style={styles.value}>{truckDisplay}</Text>
        </View>
      </View>
    </View>
  );
};

export default TripSummaryCard;

const styles = StyleSheet.create({
  card: {
    backgroundColor: CARD_BG,
    borderRadius: 15,
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
  sectionTitle: {
    fontSize: 15,
    color: VALUE_DARK,
  },
  twoColRow: {
    flexDirection: "row",
  },
  half: { flex: 1 },
  label: {
    fontSize: 12,
    color: LABEL_GREY,
    marginBottom: 2,
  },
  value: {
    fontSize: 14,
    color: VALUE_DARK,
  },
  locationBlock: {
    marginBottom: 0,
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
    marginRight: 4,
  },
  locationIcon: { width: 16, textAlign: "center" },
  locationValue: {
    flex: 1,
    fontSize: 14,
    marginLeft: 5,
    marginTop: 6,
    color: VALUE_DARK,
  },
  labelInRow: { marginBottom: 0 },
  separator: {
    height: 1,
    backgroundColor: SEPARATOR,
    marginVertical: 14,
  },

  // --- NEW TRIP TYPE BADGE STYLES ---
  typeBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
  },
  typeLocalBg: {
    backgroundColor: "rgba(245, 158, 11, 0.1)", // Amber background
    borderColor: "rgba(245, 158, 11, 0.2)",
  },
  typeTransferBg: {
    backgroundColor: "rgba(59, 130, 246, 0.1)", // Blue background
    borderColor: "rgba(59, 130, 246, 0.2)",
  },
  typeText: {
    fontSize: 9,
    fontWeight: "bold",
  },
  typeLocalText: {
    color: "#f59e0b", // Amber text
  },
  typeTransferText: {
    color: "#3b82f6", // Blue text
  },
});
