import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { COLORS, STATUS_STEPS } from "../constants/tracking-constants";
import { FontAwesome5 } from "@expo/vector-icons";

export default function TrackingTimeline({
  steps,
  activeIndex,
  selectedIndex,
  onSelectStep,
  locationsPerStep,
}) {
  return (
    <View style={styles.timelineWrapper}>
      {steps.map((step, index) => {
        const isActive = index <= activeIndex;
        const isLineActive = index < activeIndex;
        const isLast = index === steps.length - 1;
        const hasLocation =
          locationsPerStep[index] && locationsPerStep[index].length > 0;
        const isSelected = selectedIndex === index;

        return (
          <TouchableOpacity
            key={step.code}
            style={styles.timelineStepRow}
            activeOpacity={hasLocation ? 0.7 : 1}
            onPress={() => hasLocation && onSelectStep(index)}
          >
            {/* Left Column: Icon + Line */}
            <View style={styles.timelineLeftColumn}>
              <View
                style={[
                  styles.timelineIconCircle,
                  isActive ? styles.activeCircle : styles.inactiveCircle,
                  isSelected && styles.selectedCircle,
                ]}
              >
                {/* <Image
                  source={step.source}
                  style={[
                    styles.timelineStepIcon,
                    { tintColor: isActive ? "#fff" : COLORS.GREY },
                  ]}
                /> */}
                <FontAwesome5
                  name={step.iconName}
                  size={14}
                  color={isActive ? "#fff" : COLORS.GREY}
                />
              </View>
              {!isLast && (
                <View
                  style={[
                    styles.timelineConnector,
                    isLineActive ? styles.activeLine : styles.inactiveLine,
                  ]}
                />
              )}
            </View>

            {/* Right Column: Label */}
            <View style={styles.timelineLabelWrapper}>
              <Text
                style={[styles.timelineLabel, isActive && styles.activeLabel]}
              >
                {step.label}
              </Text>
              {hasLocation && (
                <Text style={styles.timelineLocationHint}>
                  {isSelected
                    ? "Showing this stop on map"
                    : "Tap to view on map"}
                </Text>
              )}
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  timelineWrapper: {
    paddingVertical: 16,
    paddingHorizontal: 4,
    marginBottom: 20,
  },
  timelineStepRow: { flexDirection: "row", alignItems: "flex-start" },
  timelineLeftColumn: { width: 32, alignItems: "center", marginRight: 12 },
  timelineIconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    justifyContent: "center",
    alignItems: "center",
  },
  activeCircle: { backgroundColor: COLORS.BLUE, borderColor: COLORS.BLUE },
  inactiveCircle: { backgroundColor: "#fff", borderColor: COLORS.GREY_LINE },
  selectedCircle: { borderColor: COLORS.ORANGE, borderWidth: 2.5 },
  timelineStepIcon: { width: 16, height: 16 },
  timelineConnector: { width: 2, height: 28, marginVertical: 4 },
  activeLine: { backgroundColor: COLORS.BLUE },
  inactiveLine: { backgroundColor: COLORS.GREY_LINE },
  timelineLabelWrapper: { justifyContent: "center", paddingTop: 4 },
  timelineLabel: { color: COLORS.GREY, fontSize: 12 },
  activeLabel: { color: COLORS.TEXT_DARK, fontWeight: "600" },
  timelineLocationHint: { marginTop: 2, fontSize: 10, color: "#64748b" },
});
