import React from "react";
import { View, StyleSheet } from "react-native";
import GradientButton from "../../ui/figma/GradientButton";

export default function ShipmentActionFooter({
  status,
  actionLoading,
  onAction,
  isPickup = false, // ✅ NEW PROP: Tells the footer which mode to use
}) {
  // 1. HIDE BUTTON IF DONE
  // If the item is successfully finished, return null to make the footer disappear.
  if (status === "DELIVERED" || status === "PICKED_UP") {
    return null;
  }

  const isLoaded = status === "LOADED";
  const isOutForDelivery = status === "OUT_FOR_DELIVERY";
  const isArrived = status === "ARRIVED";

  let buttonTitle = "Waiting for Arrival";
  let isFinalAction = false; // Controls if the button turns Green

  // 2. PICKUP LOGIC
  if (isPickup) {
    if (isArrived) {
      buttonTitle = "Complete Pickup"; // Skips "Out for Delivery" entirely
      isFinalAction = true;
    }
  }
  // 3. STANDARD DELIVERY LOGIC
  else {
    if (isOutForDelivery) {
      buttonTitle = "Complete Delivery";
      isFinalAction = true;
    } else if (isArrived) {
      buttonTitle = "Mark Out for Delivery";
    }
  }

  return (
    <View style={styles.footer}>
      <GradientButton
        title={buttonTitle}
        // Disable if it hasn't arrived yet, or if an action is loading
        disabled={(!isArrived && !isOutForDelivery) || actionLoading}
        onPress={onAction}
        loading={actionLoading}
        // Turns green only for the final completion step
        colors={isFinalAction ? ["#16a34a", "#15803d"] : undefined}
      />

      {/* ✅ NEW: Report Issue Secondary Button */}
      {(status === "PENDING_PICKUP" || status === "OUT_FOR_DELIVERY") && (
        <TouchableOpacity
          style={{ marginTop: 16, alignItems: "center", paddingVertical: 8 }}
          onPress={onReportIssue}
          disabled={actionLoading}
        >
          <Text style={{ color: "#ef4444", fontWeight: "600", fontSize: 15 }}>
            Report an Issue
          </Text>
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
    paddingTop: 16,
    paddingBottom: 34,
    backgroundColor: "#ffffff",
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
  },
});
