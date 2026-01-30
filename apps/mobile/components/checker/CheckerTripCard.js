import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
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
          <Text style={styles.progressLabel}>Loading Status</Text>
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
      <TouchableOpacity style={styles.actionBtn} onPress={() => onPress(trip)}>
        <Text style={styles.actionText}>MANAGE LOAD</Text>
        <FontAwesome5 name="arrow-right" size={12} color="#fff" />
      </TouchableOpacity>
    </View>
  );
};

export default CheckerTripCard;

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#334155",
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
    backgroundColor: "#1e293b",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  idText: { color: "#94a3b8", fontWeight: "bold", fontSize: 12 },

  body: { marginBottom: 16 },
  plateText: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "800",
    letterSpacing: 1,
  },
  routeText: { color: "#94a3b8", fontSize: 12, marginTop: 2 },

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
  progressValue: { color: "#fff", fontSize: 12, fontWeight: "bold" },

  progressBarBg: {
    height: 8,
    backgroundColor: "#0f172a",
    borderRadius: 4,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#334155",
  },
  progressBarFill: { height: "100%", borderRadius: 4 },

  actionBtn: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 12,
    backgroundColor: "#334155",
    borderRadius: 8,
    gap: 8,
  },
  actionText: { color: "#fff", fontWeight: "700", fontSize: 12 },
});
