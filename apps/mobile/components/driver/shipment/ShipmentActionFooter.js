import React, { useState, useRef } from "react";
import {
  Text,
  View,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Animated,
  Dimensions,
  PanResponder,
} from "react-native";
import { FontAwesome5 } from "@expo/vector-icons";
import GradientButton from "../../ui/figma/GradientButton";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");
const MIN_HEIGHT = 160; // Base height when collapsed
const MAX_HEIGHT = 420; // Expanded height to fit text area + extra buttons

// --- STATUS BUTTON LOGIC ---
const statusConfig = {
  ARRIVED: {
    title: "Mark Out for Delivery",
    final: false,
  },
  OUT_FOR_DELIVERY: {
    title: "Complete Delivery",
    final: true,
    requiresPhoto: true,
  },
  FAILED_PICKUP: {
    title: "Retry Pickup",
    disabled: true,
  },
  FAILED_DELIVERY: {
    title: "Retry Delivery",
    disabled: true,
  },
};

export default function ShipmentActionFooter({
  status,
  actionLoading,
  onAction,
  onReportIssue,
  message,
  onMessageChange,
  isPickup = false,
  photoCount = 0,
  tripType = "",
  onSendSMS, // Your separate sendmanualsms function
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [syncSms, setSyncSms] = useState(false);
  const animatedHeight = useRef(new Animated.Value(MIN_HEIGHT)).current;

  if (status === "DELIVERED" || status === "PICKED_UP") return null;

  // --- DRAWER ANIMATION LOGIC ---
  const toggleDrawer = (expand) => {
    Animated.spring(animatedHeight, {
      toValue: expand ? MAX_HEIGHT : MIN_HEIGHT,
      useNativeDriver: false,
      friction: 8,
    }).start();
    setIsExpanded(expand);
  };

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) =>
        Math.abs(gestureState.dy) > 10,
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy < -20)
          toggleDrawer(true); // Swipe Up
        else if (gestureState.dy > 20) toggleDrawer(false); // Swipe Down
      },
    }),
  ).current;

  // --- MAIN BUTTON LOGIC ---
  let buttonTitle = "Waiting for Arrival";
  let isFinalAction = false;
  let isDisabled = actionLoading;

  if (tripType === "HUB_TRANSFER") {
    buttonTitle = "Waiting for Checker";
    isDisabled = true;
  } else if (isPickup) {
    buttonTitle = "Complete Pickup";
    isFinalAction = true;
    if (photoCount === 0) isDisabled = true;
  } else {
    const config = statusConfig[status];

    if (config) {
      buttonTitle = config.title;
      isFinalAction = config.final || false;

      if (config.requiresPhoto && photoCount === 0) {
        isDisabled = true;
      }

      if (config.disabled) {
        isDisabled = true;
      }
    } else {
      isDisabled = true;
    }
  }

  const handleMainAction = () => {
    if (syncSms && message.trim()) {
      onSendSMS();
    }
    onAction();
  };

  return (
    <Animated.View style={[styles.footer, { height: animatedHeight }]}>
      {/* 1. HANDLE / SWIPE TRIGGER */}
      <View {...panResponder.panHandlers} style={styles.handleContainer}>
        <View style={styles.handleBar} />
        <TouchableOpacity onPress={() => toggleDrawer(!isExpanded)}>
          <Text style={styles.handleText}>
            {isExpanded ? "SWIPE DOWN TO HIDE" : "SWIPE UP FOR MESSAGING"}
          </Text>
        </TouchableOpacity>
      </View>

      {/* 2. PRIMARY BUTTONS (Always Visible) */}
      <View style={styles.mainActionRow}>
        <GradientButton
          title={buttonTitle}
          disabled={isDisabled}
          onPress={handleMainAction}
          loading={actionLoading}
          colors={isFinalAction ? ["#16a34a", "#15803d"] : undefined}
        />

        <TouchableOpacity style={styles.reportBtn} onPress={onReportIssue}>
          <Text style={styles.reportText}>Report Issue</Text>
        </TouchableOpacity>
      </View>

      {/* 3. MESSAGING SECTION (Hidden below, appears on swipe) */}
      <View style={styles.messagingSection}>
        <View style={styles.divider} />

        <Text style={styles.label}>Message / SMS Content</Text>
        <TextInput
          style={styles.messageInput}
          placeholder="e.g. Your package is arriving in 5 mins..."
          multiline
          value={message}
          onChangeText={onMessageChange}
        />

        {/* Sync Checkbox */}
        <TouchableOpacity
          style={styles.checkboxRow}
          onPress={() => setSyncSms(!syncSms)}
        >
          <View style={[styles.checkbox, syncSms && styles.checkboxActive]}>
            {syncSms && <FontAwesome5 name="check" size={10} color="#fff" />}
          </View>
          <Text style={styles.checkboxLabel}>
            Send SMS automatically on status update
          </Text>
        </TouchableOpacity>

        {/* Manual Send Button */}
        <TouchableOpacity
          style={[styles.sendSmsBtn, !message.trim() && { opacity: 0.5 }]}
          onPress={onSendSMS}
          disabled={!message.trim() || actionLoading}
        >
          <FontAwesome5 name="paper-plane" size={14} color="#fff" />
          <Text style={styles.sendSmsText}>SEND SMS MANUALLY</Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    backgroundColor: "#ffffff",
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    elevation: 25,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 15,
  },
  handleContainer: { alignItems: "center", paddingVertical: 12, width: "100%" },
  handleBar: {
    width: 45,
    height: 5,
    backgroundColor: "#cbd5e1",
    borderRadius: 3,
    marginBottom: 6,
  },
  handleText: {
    fontSize: 10,
    color: "#94a3b8",
    fontWeight: "800",
    letterSpacing: 1,
  },

  mainActionRow: { paddingBottom: 10 },
  reportBtn: { marginTop: 12, alignItems: "center" },
  reportText: { color: "#ef4444", fontWeight: "700", fontSize: 14 },

  messagingSection: { marginTop: 10 },
  divider: { height: 1, backgroundColor: "#f1f5f9", marginBottom: 15 },
  label: {
    fontSize: 11,
    fontWeight: "700",
    color: "#64748b",
    marginBottom: 8,
    textTransform: "uppercase",
  },
  messageInput: {
    backgroundColor: "#f8fafc",
    borderRadius: 15,
    padding: 15,
    height: 100,
    textAlignVertical: "top",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    color: "#0f172a",
    fontSize: 14,
  },
  checkboxRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 15,
    marginBottom: 15,
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: "#3b82f6",
    marginRight: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxActive: { backgroundColor: "#3b82f6" },
  checkboxLabel: { fontSize: 13, color: "#475569", fontWeight: "500" },

  sendSmsBtn: {
    backgroundColor: "#0f172a",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: 12,
    gap: 10,
  },
  sendSmsText: { color: "#fff", fontWeight: "800", fontSize: 13 },
});
