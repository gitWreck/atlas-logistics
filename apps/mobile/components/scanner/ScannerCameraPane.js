import React, { useEffect, useRef } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { CameraView } from "expo-camera";
import { FontAwesome5 } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const FRAME_SIZE = 250;
const SAFE_AREA_CONTROL_GAP = 8;

export default function ScannerCameraPane({
  scanEnabled = true,
  processing,
  flashEnabled,
  modeLabel,
  detailsSheetHeight,
  onBack,
  onToggleFlash,
  onBarcodeScanned,
  accentColor = "#2563eb",
}) {
  const insets = useSafeAreaInsets();
  // Full-screen camera draws under the status bar on iOS; Android often
  // already windows below it. Always offset by the live top inset.
  const topControlsOffset = insets.top + SAFE_AREA_CONTROL_GAP;

  // Animated glowing scan line that sweeps within the frame.
  const sweep = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(sweep, {
          toValue: 1,
          duration: 1800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(sweep, {
          toValue: 0,
          duration: 1800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, [sweep]);

  const lineColor = processing ? "#fbbf24" : accentColor;
  const cornerColor = processing ? "#fbbf24" : accentColor;
  const translateY = sweep.interpolate({
    inputRange: [0, 1],
    outputRange: [-(FRAME_SIZE / 2) + 24, FRAME_SIZE / 2 - 24],
  });

  const Corner = ({ pos }) => (
    <View
      style={[
        styles.corner,
        pos === "tl" && {
          top: 0,
          left: 0,
          borderTopWidth: 4,
          borderLeftWidth: 4,
          borderTopLeftRadius: 18,
        },
        pos === "tr" && {
          top: 0,
          right: 0,
          borderTopWidth: 4,
          borderRightWidth: 4,
          borderTopRightRadius: 18,
        },
        pos === "bl" && {
          bottom: 0,
          left: 0,
          borderBottomWidth: 4,
          borderLeftWidth: 4,
          borderBottomLeftRadius: 18,
        },
        pos === "br" && {
          bottom: 0,
          right: 0,
          borderBottomWidth: 4,
          borderRightWidth: 4,
          borderBottomRightRadius: 18,
        },
        { borderColor: cornerColor },
      ]}
    />
  );

  return (
    <View style={styles.cameraPane}>
      <CameraView
        style={styles.camera}
        facing="back"
        enableTorch={flashEnabled}
        onBarcodeScanned={scanEnabled ? onBarcodeScanned : undefined}
        barcodeScannerSettings={{
          barcodeTypes: ["qr", "code128", "code39", "pdf417"],
        }}
      >
        <Animated.View
          style={[styles.cameraOverlay, { paddingBottom: detailsSheetHeight }]}
        >
          <View style={[styles.topControls, { top: topControlsOffset }]}>
            <TouchableOpacity
              style={[styles.button, styles.backButton]}
              onPress={onBack}
              activeOpacity={0.82}
            >
              <FontAwesome5 name="arrow-left" size={14} color="#ffffff" />
              <Text style={styles.backButtonText}>Back</Text>
            </TouchableOpacity>

            <View style={styles.modeWrapper} pointerEvents="none">
              <View
                style={[
                  styles.modeBadge,
                  { backgroundColor: `${accentColor}E6` },
                ]}
              >
                <Text style={styles.modeBadgeText}>{modeLabel}</Text>
              </View>
            </View>

            <TouchableOpacity
              style={[
                styles.button,
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
          </View>

          <View style={styles.scanFrame}>
            <Corner pos="tl" />
            <Corner pos="tr" />
            <Corner pos="bl" />
            <Corner pos="br" />
            {processing ? (
              <ActivityIndicator size="large" color="#fbbf24" />
            ) : (
              <Animated.View
                style={[
                  styles.scanLine,
                  {
                    backgroundColor: lineColor,
                    shadowColor: lineColor,
                    transform: [{ translateY }],
                  },
                ]}
              />
            )}
          </View>

          <View style={styles.instructionRow}>
            <FontAwesome5 name="qrcode" size={13} color="#e2e8f0" />
            <Text style={styles.scanInstruction}>
              Align code within the frame
            </Text>
          </View>
        </Animated.View>
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
  topControls: {
    position: "absolute",
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    zIndex: 20,
  },
  button: {
    minHeight: 36,
    borderRadius: 999,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    backgroundColor: "rgba(15, 23, 42, 0.88)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.24)",
  },
  backButton: {
    justifyContent: "center",
  },
  backButtonText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "800",
  },
  modeBadge: {
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 7,
    zIndex: 20,
  },
  modeWrapper: {
    flex: 1,
    alignItems: "center",
  },
  modeBadgeText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  flashButton: {
    minHeight: 36,
    borderRadius: 999,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    backgroundColor: "rgba(15, 23, 42, 0.88)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.24)",
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
  
  scanFrame: {
    width: FRAME_SIZE,
    height: FRAME_SIZE,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  corner: {
    position: "absolute",
    width: 40,
    height: 40,
  },
  scanLine: {
    position: "absolute",
    left: 22,
    right: 22,
    height: 2.5,
    borderRadius: 2,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.95,
    shadowRadius: 8,
    elevation: 6,
  },
  instructionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 22,
  },
  scanInstruction: {
    color: "#e2e8f0",
    fontSize: 13,
    fontWeight: "700",
    textAlign: "center",
  },
});
