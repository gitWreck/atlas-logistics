import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from "react-native";
import { FontAwesome5 } from "@expo/vector-icons";
import { COLORS } from "../constants/theme"; // Adjust path
import { getFormattedTime } from "../utilities/helpers";
import StatusBadge from "../ui/figma/StatusBadge"; // Adjust path

const TripCard = ({ trip, onPress }) => {
  console.log("trip details: ", trip);

  // Calculate Progress
  const total = trip.total || 0;
  const loaded = trip.loaded || 0;
  const progressPercent = total > 0 ? Math.round((loaded / total) * 100) : 0;

  // Determine Bar Color based on fullness
  let barColor = COLORS.primary;
  if (progressPercent >= 100)
    barColor = COLORS.success; // Green if full
  else if (progressPercent > 50) barColor = COLORS.secondary; // Blue if half

  // Helper variables for missing data
  const driverName = trip.driverName || "Unassigned Driver";

  // Format the Trip Type nicely
  let tripTypeLabel = "Hub Transfer";
  if (trip.tripType === "LOCAL_DELIVERY")
    tripTypeLabel = "Local Delivery Route";
  if (trip.tripType === "LOCAL_PICKUP") tripTypeLabel = "Local Pickup Route";

  return (
    <View style={styles.card}>
      {/* HEADER: ID + Status */}
      <View style={styles.cardHeader}>
        <View style={styles.idBox}>
          <FontAwesome5 name="hashtag" size={10} color="#94a3b8" />
          {/* Sliced the ID so it doesn't overflow the screen */}
          <Text style={styles.idText}>{trip.id}</Text>
        </View>
        <StatusBadge status={trip.status} />
      </View>

      {/* BODY: Two-Column Layout */}
      <View style={styles.body}>
        {/* Left Side: Plate & Trip Type */}
        <View style={styles.leftContent}>
          <Text style={styles.plateText}>{trip.plate || "NO PLATE"}</Text>
          <Text style={styles.typeText}>{tripTypeLabel}</Text>
        </View>

        {/* Right Side: Route, Driver, & Updated At */}
        <View style={styles.rightContent}>
          <Text style={styles.routeText} numberOfLines={1}>
            {trip.route || "No Route Info"}
          </Text>
          <Text style={styles.driverText} numberOfLines={1}>
            {driverName}
          </Text>
          <Text style={styles.dateText}>
            Last Update: {getFormattedTime(trip.updatedAt)}
          </Text>
        </View>
      </View>

      {/* PROGRESS SECTION */}
      <View style={styles.progressContainer}>
        <View style={styles.progressRow}>
          <Text style={styles.progressLabel}>Loading Progress</Text>
          <Text style={styles.progressValue}>
            {/* ✅ NEW: Added percentage to text */}
            {loaded} / {total} Items ({progressPercent}%)
          </Text>
        </View>

        <View style={styles.progressBarBg}>
          <View
            style={[
              styles.progressBarFill,
              {
                width: `${Math.min(progressPercent, 100)}%`,
                backgroundColor: barColor,
              },
            ]}
          />
        </View>
      </View>

      {/* FOOTER: Action */}
      <TouchableOpacity
        style={styles.actionRow}
        onPress={() => onPress(trip)}
        activeOpacity={0.7}
      >
        <Text style={styles.actionText}>Manage Load</Text>
        <FontAwesome5 name="arrow-right" size={12} color="#067FC6" />
      </TouchableOpacity>
    </View>
  );
};

export default TripCard;

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 6,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  idBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#e5f2ff",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  idText: { color: "#0f172a", fontWeight: "600", fontSize: 12 },

  body: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 16,
  },
  leftContent: {
    flex: 1,
    paddingRight: 10,
  },
  rightContent: {
    flex: 1.2, // Gives the right side a bit more room for long names/routes
    alignItems: "flex-end", // Aligns all text inside to the right edge
  },

  plateText: {
    color: "#0f172a",
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: 1,
  },
  typeText: {
    color: "#067FC6",
    fontSize: 11,
    fontWeight: "700",
    marginTop: 4,
    textTransform: "uppercase",
  },

  // Right side text styles
  routeText: {
    color: "#0f172a",
    fontSize: 13,
    fontWeight: "600",
    textAlign: "right",
  },
  driverText: {
    color: "#475569",
    fontSize: 12,
    marginTop: 4,
    textAlign: "right",
  },
  dateText: {
    color: "#94a3b8",
    fontSize: 11,
    marginTop: 4,
    fontStyle: "italic",
    textAlign: "right",
  },

  progressContainer: { marginBottom: 16 },
  progressRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  progressLabel: {
    color: "#64748b",
    fontSize: 10,
    fontWeight: "600",
    textTransform: "uppercase",
  },
  progressValue: { color: "#0f172a", fontSize: 12, fontWeight: "600" },

  progressBarBg: {
    height: 8,
    backgroundColor: "#e5e7eb",
    borderRadius: 4,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#cbd5e1",
  },
  progressBarFill: { height: "100%", borderRadius: 4 },

  actionRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 4,
    gap: 6,
  },
  actionText: { color: "#067FC6", fontWeight: "600", fontSize: 13 },
});
