import React from "react";
import { View, Text, StyleSheet } from "react-native";

export default function SignupFooter({ onLoginPress }) {
  return (
    <View style={styles.footerTextContainer}>
      <Text style={styles.footerText}>
        Already have an account?{" "}
        <Text style={styles.footerLink} onPress={onLoginPress}>
          Sign in
        </Text>
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  footerTextContainer: {
    marginTop: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  footerText: {
    fontSize: 13,
    color: "#64748b",
  },
  footerLink: {
    fontSize: 13,
    fontWeight: "600",
    color: "#2563eb",
    textDecorationLine: "underline",
  },
});
