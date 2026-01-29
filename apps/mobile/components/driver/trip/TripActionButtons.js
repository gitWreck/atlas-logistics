import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { FontAwesome5 } from "@expo/vector-icons";
import { COLORS } from "../../constants/theme";

const TripActionButtons = ({
  status,
  onStartTrip,
  onViewShipments,
  onReportDelay,
  loading,
}) => {
  // 1. Determine State
  const isReadyToStart = status === "LOADED" || status === "ASSIGNED";
  const isDriving = status === "IN_TRANSIT";

  return (
    <View style={styles.bottomActions}>
      {/* === PRIMARY BUTTON (Start Trip OR View Shipments) === */}
      {isReadyToStart ? (
        // SCENARIO A: READY TO START (Green Button)
        <TouchableOpacity
          style={[styles.primaryBtn, { backgroundColor: COLORS.success }]}
          onPress={onStartTrip}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <FontAwesome5
                name="play"
                size={18}
                color="#fff"
                style={{ marginRight: 8 }}
              />
              <Text style={styles.btnText}>START TRIP</Text>
            </>
          )}
        </TouchableOpacity>
      ) : (
        // SCENARIO B: ALREADY DRIVING (Blue Button)
        <TouchableOpacity style={styles.primaryBtn} onPress={onViewShipments}>
          <FontAwesome5
            name="box-open"
            size={18}
            color="#fff"
            style={{ marginRight: 8 }}
          />
          <Text style={styles.btnText}>View Shipments</Text>
        </TouchableOpacity>
      )}

      {/* === SECONDARY BUTTON (Check Manifest OR Report Delay) === */}
      <TouchableOpacity
        style={styles.secondaryBtn}
        onPress={isReadyToStart ? onViewShipments : onReportDelay}
      >
        {isReadyToStart ? (
          // If starting, secondary is "Check Manifest" (Blue Text)
          <>
            <FontAwesome5
              name="clipboard-list"
              size={16}
              color={COLORS.primary}
              style={{ marginRight: 8 }}
            />
            <Text style={[styles.btnText, { color: COLORS.primary }]}>
              Check Manifest
            </Text>
          </>
        ) : (
          // If driving, secondary is "Report Delay" (Red Text)
          <>
            <FontAwesome5
              name="exclamation-triangle"
              size={16}
              color={COLORS.danger}
              style={{ marginRight: 8 }}
            />
            <Text style={[styles.btnText, { color: COLORS.danger }]}>
              Report Delay
            </Text>
          </>
        )}
      </TouchableOpacity>
    </View>
  );
};

export default TripActionButtons;

const styles = StyleSheet.create({
  bottomActions: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: COLORS.background,
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: "#334155",
    gap: 12,
  },
  primaryBtn: {
    backgroundColor: COLORS.primary,
    padding: 16,
    borderRadius: 12,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  secondaryBtn: {
    backgroundColor: "rgba(15, 23, 42, 0.5)", // Darker transparent bg
    padding: 16,
    borderRadius: 12,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#334155",
  },
  btnText: { color: "#fff", fontWeight: "bold", fontSize: 16 },
});
