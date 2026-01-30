import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";

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

      <TouchableOpacity
        style={[
          styles.finishBtn,
          loaded > 0 ? styles.btnActive : styles.btnDisabled,
        ]}
        onPress={onFinish}
        disabled={loaded === 0}
      >
        <Text style={styles.finishText}>FINISH & RELEASE</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  footer: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: "#334155",
    backgroundColor: "#1e293b",
  },
  progressRow: { marginBottom: 15 },
  progressText: {
    color: "#94a3b8",
    marginBottom: 8,
    fontSize: 12,
    fontWeight: "bold",
    textAlign: "right",
  },
  progressBarBg: {
    height: 6,
    backgroundColor: "#334155",
    borderRadius: 3,
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    backgroundColor: "#10b981",
  },
  finishBtn: {
    padding: 18,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  btnActive: { backgroundColor: "#3b82f6" },
  btnDisabled: { backgroundColor: "#475569" },
  finishText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 16,
    letterSpacing: 1,
  },
});
