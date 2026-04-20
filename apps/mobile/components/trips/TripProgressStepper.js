import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { FontAwesome5 } from "@expo/vector-icons";
import { TRACKING_WORKFLOWS } from "../../components/constants/templates";

const BLUE = "#155DFC";
const GREY = "#94a3b8";
const GREY_LINE = "#e2e8f0";
const SEPARATOR = "#e5e7eb";

// Pass `tripType` instead of `isPickup` (Defaults to HUB_TRANSFER)
const TripProgressStepper = ({ currentStatus, tripType = "HUB_TRANSFER" }) => {
  const s = (currentStatus || "CREATED").toUpperCase();

  // 2. Select the correct workflow array based on the prop
  const activeSteps =
    TRACKING_WORKFLOWS[tripType] || TRACKING_WORKFLOWS.HUB_TRANSFER;

  // 3. One-line Array Method to find the active index
  // Note: We use findLastIndex in case multiple steps share a status, or if we skip a step.
  let activeIndex = activeSteps
    .map((step) => step.statuses.includes(s))
    .lastIndexOf(true);

  // Fallback: If status isn't in the array (e.g. CANCELLED), default to step 0 or handle uniquely
  if (activeIndex === -1) activeIndex = 0;

  const getTitle = () => {
    if (tripType === "LOCAL_PICKUP") return "Pickup Route Progress";
    if (tripType === "LOCAL_DELIVERY") return "Delivery Route Progress";
    return "Hub Transfer Progress";
  };

  return (
    <View style={styles.card}>
      <Text style={styles.sectionTitle}>{getTitle()}</Text>

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
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
  },
  sectionTitle: { fontSize: 15, fontWeight: "600", color: "#111827" },
  verticalTimeline: {},
  stepRow: { flexDirection: "row", alignItems: "flex-start" },
  labelWrapper: {
    height: 36,
    justifyContent: "flex-start",
    paddingTop: 2,
    flex: 1,
  },
  leftColumn: { width: 28, alignItems: "center", marginRight: 12 },
  circle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    backgroundColor: "#fff",
  },
  circleActive: { backgroundColor: BLUE, borderColor: BLUE },
  circleInactive: { backgroundColor: "#fff", borderColor: GREY_LINE },
  connector: { width: 2, height: 24, marginVertical: 4 },
  connectorActive: { backgroundColor: BLUE },
  connectorInactive: { backgroundColor: GREY_LINE },
  stepLabel: { fontSize: 14, fontWeight: "500" },
  stepLabelActive: { color: "#111827" },
  stepLabelInactive: { color: GREY },
  separator: { height: 1, backgroundColor: SEPARATOR, marginVertical: 14 },
});
