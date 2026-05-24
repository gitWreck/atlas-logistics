import React from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { CameraView } from "expo-camera";
import { FontAwesome5 } from "@expo/vector-icons";

export default function ScannerCameraPane({
  scanned,
  processing,
  flashEnabled,
  modeLabel,
  detailsSheetHeight,
  onToggleFlash,
  onBarcodeScanned,
}) {
  return (
    <View style={styles.cameraPane}>
      <CameraView
        style={styles.camera}
        facing="back"
        enableTorch={flashEnabled}
        onBarcodeScanned={scanned ? undefined : onBarcodeScanned}
        barcodeScannerSettings={{
          barcodeTypes: ["qr", "code128", "code39", "pdf417"],
        }}
      >
        <View
          style={[
            styles.cameraOverlay,
            { paddingBottom: detailsSheetHeight },
          ]}
        >
          <View style={styles.modeBadge}>
            <Text style={styles.modeBadgeText}>{modeLabel}</Text>
          </View>

          <TouchableOpacity
            style={[
              styles.flashButton,
              flashEnabled && styles.flashButtonActive,
            ]}
            onPress={onToggleFlash}
            activeOpacity={0.82}
          >
            <FontAwesome5
              name={flashEnabled ? "bolt" : "lightbulb"}
              size={16}
              color={flashEnabled ? "#0f172a" : "#ffffff"}
            />
            <Text
              style={[
                styles.flashButtonText,
                flashEnabled && styles.flashButtonTextActive,
              ]}
            >
              {flashEnabled ? "Flash On" : "Flash"}
            </Text>
          </TouchableOpacity>

          {processing && (
            <ActivityIndicator
              size="large"
              color="#fbbf24"
              style={styles.processingIndicator}
            />
          )}

          <View
            style={[styles.scanFrame, processing && styles.scanFrameProcessing]}
          />
          <Text style={styles.scanInstruction}>Package or shipment code</Text>
        </View>
      </CameraView>
    </View>
  );
}

const styles = StyleSheet.create({
  cameraPane: {
    flex: 1,
    backgroundColor: "#000000",
  },
  camera: { flex: 1 },
  cameraOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.45)",
    justifyContent: "center",
    alignItems: "center",
    padding: 18,
  },
  modeBadge: {
    position: "absolute",
    top: 18,
    alignSelf: "center",
    backgroundColor: "rgba(15, 23, 42, 0.78)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.18)",
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  modeBadgeText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  flashButton: {
    position: "absolute",
    top: 18,
    right: 18,
    minHeight: 36,
    borderRadius: 999,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    backgroundColor: "rgba(15, 23, 42, 0.78)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.18)",
  },
  flashButtonActive: {
    backgroundColor: "#fbbf24",
    borderColor: "#fde68a",
  },
  flashButtonText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "800",
  },
  flashButtonTextActive: {
    color: "#0f172a",
  },
  processingIndicator: {
    marginBottom: 14,
  },
  scanFrame: {
    width: 210,
    height: 150,
    borderWidth: 3,
    borderColor: "#3b82f6",
    borderRadius: 18,
    backgroundColor: "transparent",
  },
  scanFrameProcessing: {
    borderColor: "#fbbf24",
  },
  scanInstruction: {
    marginTop: 14,
    color: "#e2e8f0",
    fontSize: 13,
    fontWeight: "700",
    textAlign: "center",
  },
});
