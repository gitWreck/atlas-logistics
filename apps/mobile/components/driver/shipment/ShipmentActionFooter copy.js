import React, { useState, useRef } from "react";
import {
  Text,
  View,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Animated,
  Dimensions,
} from "react-native";
import { FontAwesome5 } from "@expo/vector-icons";
import GradientButton from "../../ui/figma/GradientButton";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

export default function ShipmentActionFooter({
  status,
  actionLoading,
  onAction,
  isPickup = false, // ✅ NEW PROP: Tells the footer which mode to use
  onReportIssue,
  message, // ✅ NEW: from parent
  onMessageChange, // ✅ NEW: from parent
  photoCount = 0, // ✅ New Prop
  tripType = "", // ✅ New Prop
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const animatedHeight = useRef(new Animated.Value(0)).current;

  // 1. HIDE BUTTON IF DONE
  // If the item is successfully finished, return null to make the footer disappear.
  if (status === "DELIVERED" || status === "PICKED_UP") {
    return null;
  }

  const toggleDrawer = () => {
    const toValue = isExpanded ? 0 : 150; // Expand by 150px
    Animated.spring(animatedHeight, {
      toValue,
      useNativeDriver: false,
    }).start();
    setIsExpanded(!isExpanded);
  };

  const isLoaded = status === "LOADED";
  const isOutForDelivery = status === "OUT_FOR_DELIVERY";
  const isArrived = status === "ARRIVED";

  let buttonTitle = "Waiting for Arrival";
  let isFinalAction = false; // Controls if the button turns Green
  let isDisabled = actionLoading;

  // 1. HUB TO HUB LOGIC: Grey out and wait for checker
  if (tripType === "HUB_TRANSFER") {
    buttonTitle = "Waiting for Checker Arrival";
    isDisabled = true;
  }

  // 2. PICKUP LOGIC
  else if (isPickup) {
    buttonTitle = "Complete Pickup"; // Skips "Out for Delivery" entirely
    isFinalAction = true;
    if (photoCount === 0) isDisabled = true; // ✅ Grey out until photo uploaded
  }

  // 3. STANDARD DELIVERY LOGIC
  else {
    if (isOutForDelivery) {
      buttonTitle = "Complete Delivery";
      isFinalAction = true;
      if (photoCount === 0) isDisabled = true; // ✅ Grey out until photo uploaded
    } else if (isArrived) {
      buttonTitle = "Mark Out for Delivery";
    } else {
      isDisabled = true; // Waiting for Arrival
    }
  }
  return (
    <View style={styles.footer}>
      {/* Drawer Handle (Swipe Up Trigger) */}
      <TouchableOpacity onPress={toggleDrawer} style={styles.handleContainer}>
        <View style={styles.handleBar} />
        <Text style={styles.handleText}>
          {isExpanded ? "Hide Message" : "Add Note / Message"}
        </Text>
      </TouchableOpacity>

      {/* Expandable Area */}
      <Animated.View style={{ height: animatedHeight, overflow: "hidden" }}>
        <TextInput
          style={styles.messageInput}
          placeholder="Type a message or delivery instruction..."
          multiline
          value={message}
          onChangeText={onMessageChange}
        />
      </Animated.View>

      <GradientButton
        title={buttonTitle}
        // disabled={(!isArrived && !isOutForDelivery) || actionLoading}
        disabled={isDisabled} // ✅ Controlled by the logic above
        onPress={onAction}
        loading={actionLoading}
        colors={isFinalAction ? ["#16a34a", "#15803d"] : undefined}
      />

      {(status === "PENDING_PICKUP" || status === "OUT_FOR_DELIVERY") && (
        <TouchableOpacity style={styles.reportBtn} onPress={onReportIssue}>
          <Text style={styles.reportText}>Report an Issue</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 34,
    backgroundColor: "#ffffff",
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20, // Rounded top for drawer look
    elevation: 20,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 10,
  },
  handleContainer: { alignItems: "center", paddingVertical: 10 },
  handleBar: {
    width: 40,
    height: 4,
    backgroundColor: "#e2e8f0",
    borderRadius: 2,
    marginBottom: 4,
  },
  handleText: {
    fontSize: 10,
    color: "#94a3b8",
    fontWeight: "700",
    uppercase: "true",
  },
  messageInput: {
    backgroundColor: "#f8fafc",
    borderRadius: 12,
    padding: 12,
    height: 100,
    textAlignVertical: "top",
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    color: "#0f172a",
  },
  reportBtn: { marginTop: 16, alignItems: "center", paddingVertical: 8 },
  reportText: { color: "#ef4444", fontWeight: "600", fontSize: 15 },
});
