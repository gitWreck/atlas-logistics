import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { FontAwesome5 } from "@expo/vector-icons";
import {
  PICKUP_STEPS,
  DELIVERY_STEPS,
} from "../../constants/tracking-constants";

const BLUE = "#155DFC";
const GREY = "#94a3b8";
const GREY_LINE = "#e2e8f0";
const SEPARATOR = "#e5e7eb";

const TripProgressStepper = ({ currentStatus, isPickup = false }) => {
  const s = (currentStatus || "").toUpperCase();
  let activeIndex = 0;

  // 1. Set the correct steps array based on the workflow
  const activeSteps = isPickup ? PICKUP_STEPS : DELIVERY_STEPS;

  // 2. Calculate the Active Index
  if (isPickup) {
    if (s === "PICKED_UP" || s === "RECEIVED" || s === "COMPLETED")
      activeIndex = 3;
    else if (s === "ARRIVED") activeIndex = 2;
    else if (s === "IN_TRANSIT" || s === "EN_ROUTE") activeIndex = 1;
    else activeIndex = 0; // PENDING_PICKUP or CREATED
  } else {
    // Delivery Workflow
    if (s === "DELIVERED" || s === "COMPLETED") activeIndex = 5;
    else if (s === "OUT_FOR_DELIVERY" || s === "DELIVERING") activeIndex = 4;
    else if (s === "ARRIVED") activeIndex = 3;
    else if (s === "IN_TRANSIT") activeIndex = 2;
    else if (s === "LOADED") activeIndex = 1;
    else activeIndex = 0; // RECEIVED or CREATED
  }

  return (
    <View style={styles.card}>
      <Text style={styles.sectionTitle}>
        {isPickup ? "Pickup Progress" : "Delivery Progress"}
      </Text>

      <View style={styles.separator} />

      <View style={styles.verticalTimeline}>
        {activeSteps.map((step, index) => {
          const isCompletedOrCurrent = index <= activeIndex;
          const isLast = index === activeSteps.length - 1;
          const lineActive = index < activeIndex;

          return (
            <View key={step.key} style={styles.stepRow}>
              <View style={styles.leftColumn}>
                <View
                  style={[
                    styles.circle,
                    isCompletedOrCurrent
                      ? styles.circleActive
                      : styles.circleInactive,
                  ]}
                >
                  <FontAwesome5
                    name={step.icon}
                    size={12}
                    color={isCompletedOrCurrent ? "#fff" : "#cbd5e1"}
                  />
                </View>
                {!isLast && (
                  <View
                    style={[
                      styles.connector,
                      lineActive
                        ? styles.connectorActive
                        : styles.connectorInactive,
                    ]}
                  />
                )}
              </View>
              <View style={styles.labelWrapper}>
                <Text
                  style={[
                    styles.stepLabel,
                    isCompletedOrCurrent
                      ? styles.stepLabelActive
                      : styles.stepLabelInactive,
                  ]}
                >
                  {step.label}
                </Text>
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
};

export default TripProgressStepper;

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 15,
    padding: 16,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#111827",
  },
  verticalTimeline: {},
  stepRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  labelWrapper: {
    height: 36,
    justifyContent: "flex-start",
    paddingTop: 2,
    flex: 1,
  },
  leftColumn: {
    width: 28,
    alignItems: "center",
    marginRight: 12,
  },
  circle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    backgroundColor: "#fff",
  },
  circleActive: {
    backgroundColor: BLUE,
    borderColor: BLUE,
  },
  circleInactive: {
    backgroundColor: "#fff",
    borderColor: GREY_LINE,
  },
  connector: {
    width: 2,
    height: 24,
    marginVertical: 4,
  },
  connectorActive: { backgroundColor: BLUE },
  connectorInactive: { backgroundColor: GREY_LINE },
  stepLabel: {
    fontSize: 14,
    fontWeight: "500",
  },
  stepLabelActive: { color: "#111827" },
  stepLabelInactive: { color: GREY },
  separator: {
    height: 1,
    backgroundColor: SEPARATOR,
    marginVertical: 14,
  },
});
