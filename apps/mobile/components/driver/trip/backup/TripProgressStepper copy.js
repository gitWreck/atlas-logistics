import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Image } from "expo-image";
import { FontAwesome5 } from "@expo/vector-icons";
import { DRIVER_STEPS } from "../../../constants/tracking-constants";

const BLUE = "#155DFC";
const GREY = "#94a3b8";
const GREY_LINE = "#e2e8f0";
const SEPARATOR = "#e5e7eb";

const TripProgressStepper = ({ currentStatus }) => {
  const s = (currentStatus || "").toUpperCase();
  let activeIndex = 0;
  if (s === "COMPLETED" || s === "DELIVERED") activeIndex = 5;
  else if (s === "DELIVERING" || s === "OUT_FOR_DELIVERY") activeIndex = 4;
  else if (s === "IN_TRANSIT") activeIndex = 3;
  else if (s === "ARRIVED") activeIndex = 2;
  else if (s === "LOADED") activeIndex = 1;
  else activeIndex = 0;

  return (
    <View style={styles.card}>
      <Text style={styles.sectionTitle}>Trip Progress</Text>

      <View style={styles.separator} />

      <View style={styles.verticalTimeline}>
        {DRIVER_STEPS.map((step, index) => {
          const isCompletedOrCurrent = index <= activeIndex;
          const isLast = index === DRIVER_STEPS.length - 1;
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
                  {/* <Image
                    source={step.source}
                    style={[
                      styles.stepIcon,
                      { tintColor: isCompletedOrCurrent ? "#fff" : GREY },
                    ]}
                  /> */}
                  <FontAwesome5
                    name={step.icon}
                    size={12}
                    style={[
                      styles.stepIcon,
                      { tintColor: isCompletedOrCurrent ? "#fff" : GREY },
                    ]}
                    color={currentStatus === step.key ? "#3b82f6" : "#cbd5e1"}
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
    color: "#111827",
  },
  verticalTimeline: {},
  stepRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 0,
  },
  labelWrapper: {
    height: 24,
    justifyContent: "center",
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
  },
  circleActive: {
    backgroundColor: BLUE,
    borderColor: BLUE,
  },
  circleInactive: {
    backgroundColor: "#fff",
    borderColor: GREY_LINE,
  },
  stepIcon: {
    width: 13,
    height: 13,
    size: 8,
  },
  connector: {
    width: 2,
    height: 18,
    marginVertical: 8,
  },
  connectorActive: { backgroundColor: BLUE },
  connectorInactive: { backgroundColor: GREY_LINE },
  stepLabel: {
    fontSize: 14,
  },
  stepLabelActive: { color: "#111827" },
  stepLabelInactive: { color: GREY },
  separator: {
    height: 1,
    backgroundColor: SEPARATOR,
    marginVertical: 14,
  },
});
