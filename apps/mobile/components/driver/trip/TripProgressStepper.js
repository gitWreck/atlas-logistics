import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { FontAwesome5 } from "@expo/vector-icons";
import { COLORS } from "../../constants/theme";

const TripProgressStepper = ({ currentStatus }) => {
  const steps = [
    { key: "RECEIVED", label: "Received", icon: "box" },
    { key: "LOADED", label: "Loaded", icon: "dolly" },
    { key: "IN_TRANSIT", label: "In Transit", icon: "shipping-fast" },
    {
      key: "OUT_FOR_DELIVERY",
      label: "Out for Delivery",
      icon: "truck-loading",
    },
    { key: "DELIVERED", label: "Delivered", icon: "check-circle" },
  ];

  // Logic to determine active step index
  let activeIndex = 0;
  const s = (currentStatus || "").toUpperCase();

  if (s === "COMPLETED" || s === "DELIVERED") activeIndex = 4;
  else if (s === "DELIVERING" || s === "OUT_FOR_DELIVERY") activeIndex = 3;
  else if (s === "IN_TRANSIT") activeIndex = 2;
  else if (s === "LOADED") activeIndex = 1;
  else activeIndex = 0;

  return (
    <View style={styles.progressContainer}>
      <View style={styles.stepIconsRow}>
        {steps.map((step, index) => {
          const isActive = index <= activeIndex;
          const isLast = index === steps.length - 1;

          return (
            <React.Fragment key={step.key}>
              <View style={{ alignItems: "center", width: 60 }}>
                <View
                  style={[
                    styles.stepCircle,
                    isActive ? styles.stepActive : styles.stepInactive,
                  ]}
                >
                  <FontAwesome5
                    name={step.icon}
                    size={14}
                    color={isActive ? "#fff" : COLORS.textSecondary}
                  />
                </View>
                <Text
                  style={[
                    styles.stepLabel,
                    isActive
                      ? { color: COLORS.primary }
                      : { color: COLORS.textSecondary },
                  ]}
                >
                  {step.label}
                </Text>
              </View>

              {/* Connector Line */}
              {!isLast && (
                <View
                  style={[
                    styles.connector,
                    index < activeIndex
                      ? styles.connectorActive
                      : styles.connectorInactive,
                  ]}
                />
              )}
            </React.Fragment>
          );
        })}
      </View>
    </View>
  );
};

export default TripProgressStepper;

const styles = StyleSheet.create({
  progressContainer: { marginBottom: 24 },
  stepIconsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  stepCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
    borderWidth: 2,
  },
  stepActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  stepInactive: { backgroundColor: "transparent", borderColor: "#475569" },
  stepLabel: {
    fontSize: 10,
    textAlign: "center",
    width: 60,
    fontWeight: "600",
  },
  connector: { flex: 1, height: 2, marginTop: 16 },
  connectorActive: { backgroundColor: COLORS.primary },
  connectorInactive: { backgroundColor: "#475569" },
});
