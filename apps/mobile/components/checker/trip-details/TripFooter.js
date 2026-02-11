import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import GradientButton from "../../ui/figma/GradientButton";

export default function TripFooter({ trip, onFinish }) {
  if (!trip || (trip.status !== "ASSIGNED" && trip.status !== "LOADING")) {
    return null;
  }

  const loaded = trip.totalLoaded || 0;
  const total = trip.totalItems || 0;
  // Calculate percentage, capped at 100%
  const percent = total > 0 ? Math.min((loaded / total) * 100, 100) : 0;

  return (
    <View style={styles.footer}>
      <View style={styles.progressRow}>
        <Text style={styles.progressText}>
          {loaded} / {total} Loaded
        </Text>
        {/* Visual Bar Background */}
        <View style={styles.progressBarBg}>
          <View style={[styles.progressBarFill, { width: `${percent}%` }]} />
        </View>
      </View>

      <GradientButton
        title="Finish & Release"
        onPress={onFinish}
        disabled={loaded === 0}
      />

      {loaded === 0 && (
        <Text style={styles.helperText}>
          Scan at least one package before releasing this trip.
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  footer: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 20,
    borderTopWidth: 1,
    borderTopColor: "#cbd5e1",
    backgroundColor: "#ffffff",
  },
  progressRow: { marginBottom: 12 },
  progressText: {
    color: "#475569",
    marginBottom: 8,
    fontSize: 12,
    fontWeight: "600",
    textAlign: "right",
  },
  progressBarBg: {
    height: 6,
    backgroundColor: "#e5e7eb",
    borderRadius: 3,
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    backgroundColor: "#10b981",
  },
  helperText: {
    marginTop: 8,
    fontSize: 11,
    color: "#64748b",
    textAlign: "center",
  },
});
