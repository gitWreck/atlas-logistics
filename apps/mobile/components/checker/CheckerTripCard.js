import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from "react-native";
import { FontAwesome5 } from "@expo/vector-icons";
import { COLORS } from "../../components/constants/theme"; // Adjust path
import StatusBadge from "../../components/ui/StatusBadge"; // Adjust path

const CheckerTripCard = ({ trip, onPress }) => {
  // Calculate Progress
  const total = trip.total || 0;
  const loaded = trip.loaded || 0;
  const progressPercent = total > 0 ? (loaded / total) * 100 : 0;

  // Determine Bar Color based on fullness
  let barColor = COLORS.primary;
  if (progressPercent >= 100)
    barColor = COLORS.success; // Green if full
  else if (progressPercent > 50) barColor = COLORS.secondary; // Blue if half

  return (
    <View style={styles.card}>
      {/* HEADER: ID + Status */}
      <View style={styles.cardHeader}>
        <View style={styles.idBox}>
          <FontAwesome5 name="hashtag" size={10} color="#94a3b8" />
          <Text style={styles.idText}>{trip.id}</Text>
        </View>
        <StatusBadge status={trip.status} />
      </View>

      {/* BODY: Plate & Route */}
      <View style={styles.body}>
        <Text style={styles.plateText}>{trip.plate || "NO PLATE"}</Text>
        <Text style={styles.routeText}>{trip.route || "No Route Info"}</Text>
      </View>

      {/* PROGRESS SECTION */}
      <View style={styles.progressContainer}>
        <View style={styles.progressRow}>
          <Text style={styles.progressLabel}>Status</Text>
          <Text style={styles.progressValue}>
            {loaded} / {total} Items
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

export default CheckerTripCard;

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

  body: { marginBottom: 16 },
  plateText: {
    color: "#0f172a",
    fontSize: 18,
    fontWeight: "700",
    letterSpacing: 1,
  },
  routeText: { color: "#475569", fontSize: 12, marginTop: 2 },

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
