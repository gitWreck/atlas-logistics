import React from "react";
import {
  View,
  Text,
  ActivityIndicator,
  StyleSheet,
  TouchableOpacity,
} from "react-native";
import { FontAwesome } from "@expo/vector-icons";

export default function ScannerOverlay({ processing, mode, onManualPress }) {
  return (
    <View style={styles.overlay}>
      {processing && (
        <ActivityIndicator
          size="large"
          color="#fff"
          style={{ marginBottom: 20 }}
        />
      )}

      <Text style={styles.overlayText}>
        Mode: {mode?.toUpperCase() || "SCAN"}
      </Text>

      {/* The Scanning Square */}
      <View style={[styles.square, processing && { borderColor: "#fbbf24" }]} />

      <Text style={styles.instruction}>Scan individual package barcode</Text>

      {/* Manual Button (Floating at bottom) */}
      <TouchableOpacity style={styles.manualButton} onPress={onManualPress}>
        <FontAwesome name="keyboard-o" size={24} color="white" />
        <Text style={styles.manualButtonText}>Enter ID Manually</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
  },
  overlayText: {
    color: "white",
    fontSize: 24,
    fontWeight: "900",
    marginBottom: 40,
    top: -50,
    textShadowColor: "black",
    textShadowRadius: 10,
  },
  square: {
    width: 260,
    height: 260,
    borderWidth: 4,
    borderColor: "#3b82f6", // Atlas Blue
    borderRadius: 20,
    backgroundColor: "transparent",
  },
  instruction: {
    color: "#e2e8f0",
    marginTop: 20,
    fontSize: 14,
  },
  manualButton: {
    position: "absolute",
    bottom: 60,
    alignSelf: "center",
    backgroundColor: "rgba(15, 23, 42, 0.8)", // Dark Slate
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 30,
    borderWidth: 1,
    borderColor: "white",
  },
  manualButtonText: {
    color: "white",
    fontWeight: "bold",
    marginLeft: 10,
  },
});
