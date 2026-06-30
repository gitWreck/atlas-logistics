import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";

export default function PermissionRequest({ onRequest }) {
  return (
    <View style={styles.center}>
      <Text style={styles.title}>Camera access needed</Text>
      <Text style={styles.text}>
        Atlas uses your camera to scan package QR codes and capture
        proof-of-delivery photos when you complete a shipment.
      </Text>
      <TouchableOpacity
        onPress={onRequest}
        style={styles.button}
        activeOpacity={0.85}
      >
        <Text style={styles.buttonText}>Continue</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
  },
  title: {
    fontSize: 18,
    fontWeight: "600",
    color: "#0f172a",
    marginBottom: 8,
    textAlign: "center",
  },
  text: {
    fontSize: 15,
    lineHeight: 22,
    color: "#475569",
    textAlign: "center",
  },
  button: {
    marginTop: 24,
    minWidth: 160,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
    backgroundColor: "#2563eb",
    alignItems: "center",
  },
  buttonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "600",
  },
});
