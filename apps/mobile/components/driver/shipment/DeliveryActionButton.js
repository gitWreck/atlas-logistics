import React from "react";
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { FontAwesome5 } from "@expo/vector-icons";
import { COLORS } from "../../constants/theme";

const DeliveryActionButton = ({ status, onPress, loading }) => {
  // 1. Determine State
  const isOut = status === "OUT_FOR_DELIVERY" || status === "DELIVERING";
  const isDelivered = status === "DELIVERED" || status === "COMPLETED";

  // 2. Define Styles & Text
  let bg = COLORS.primary; // Default: Mark Out for Delivery
  let text = "MARK OUT FOR DELIVERY";
  let icon = "truck";

  if (isOut) {
    bg = COLORS.success; // Green
    text = "CONFIRM DELIVERY";
    icon = "check-circle";
  } else if (isDelivered) {
    bg = "#334155"; // Disabled/Grey
    text = "ALREADY DELIVERED";
    icon = "check-double";
  }

  return (
    <TouchableOpacity
      style={[
        styles.btn,
        { backgroundColor: bg },
        isDelivered && styles.disabled,
      ]}
      onPress={onPress}
      disabled={isDelivered || loading}
    >
      {loading ? (
        <ActivityIndicator color="#fff" />
      ) : (
        <>
          <FontAwesome5
            name={icon}
            size={18}
            color="#fff"
            style={{ marginRight: 10 }}
          />
          <Text style={styles.text}>{text}</Text>
        </>
      )}
    </TouchableOpacity>
  );
};

export default DeliveryActionButton;

const styles = StyleSheet.create({
  btn: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    padding: 18,
    borderRadius: 12,
    marginTop: 10,
    elevation: 2,
  },
  text: { color: "#fff", fontWeight: "bold", fontSize: 16, letterSpacing: 0.5 },
  disabled: { opacity: 0.7 },
});
