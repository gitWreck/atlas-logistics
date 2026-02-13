import React, { useState } from "react";
import {
  Text,
  View,
  StyleSheet,
  Alert,
  ActivityIndicator,
  TouchableOpacity,
  Modal,
  KeyboardAvoidingView,
  Platform,
  TextInput,
  Vibration,
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useLocalSearchParams } from "expo-router";
import { FontAwesome } from "@expo/vector-icons";
import { scanPackages } from "../../components/utilities/FirebaseFunctions";
import GetLocation from "react-native-get-location";

export default function ScannerScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [showManual, setShowManual] = useState(false);
  const [manualCode, setManualCode] = useState("");

  const { mode } = useLocalSearchParams();

  // 1. Permission Check
  if (!permission) return <View />;
  if (!permission.granted) {
    return (
      <View style={styles.center}>
        <Text>Camera permission is required.</Text>
        <Text onPress={requestPermission} style={styles.link}>
          Grant Permission
        </Text>
      </View>
    );
  }

  // Rename 'handleBarCodeScanned' to this:
  const getCurrentLocationSafe = async () => {
    try {
      const loc = await GetLocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 15000,
      });

      if (!loc) return null;
      return {
        lat: loc.latitude,
        lng: loc.longitude,
      };
    } catch (error) {
      console.log("Location error (checker scan):", error);
      return null;
    }
  };

  const processPackage = async (barcode) => {
    if (processing) return; // Prevent double taps
    setProcessing(true);

    // (Optional) If coming from manual input, maybe don't vibrate?
    // Or keep it for consistent feedback.
    Vibration.vibrate();

    try {
      const location = await getCurrentLocationSafe();
      const result = await scanPackages({
        barcode: barcode, // ✅ Accepts string from Camera OR Text Input
        mode: mode,
        ...(location ? { location } : {}),
      });

      console.log("results: ", result);

      Alert.alert("Success", result.data.message, [
        {
          text: "Next",
          onPress: () => {
            setScanned(false);
            setProcessing(false);
            setManualCode(""); // Clear text field if used
          },
        },
      ]);
    } catch (error) {
      Alert.alert("Error", error.message);
      setScanned(false);
      setProcessing(false);
    }
  };

  const onCameraScan = ({ data }) => {
    if (!scanned && !processing) {
      console.log("barcode", data);
      setScanned(true);
      processPackage(data);
    }
  };

  return (
    <View style={styles.container}>
      <CameraView
        style={styles.camera}
        facing="back"
        onBarcodeScanned={scanned ? undefined : onCameraScan}
        barcodeScannerSettings={{
          barcodeTypes: [
            "qr",
            "ean13", // Standard retail products
            "ean8", // Smaller retail products
            "upc_e", // US products
            "code128", // 📦 Very common for logistics/shipping labels
            "code39", // Older logistics standard
            "pdf417", // Complex labels (like on IDs or shipping manifests)
          ],
        }}
      >
        <View style={styles.overlay}>
          {processing && (
            <ActivityIndicator
              size="large"
              color="#fff"
              style={{ marginBottom: 20 }}
            />
          )}
          <Text style={styles.overlayText}>Mode: {mode?.toUpperCase()}</Text>
          <View
            style={[styles.square, processing && { borderColor: "yellow" }]}
          />
          <Text style={styles.instruction}>
            Scan individual package barcode
          </Text>
        </View>
      </CameraView>

      <TouchableOpacity
        style={styles.manualButton}
        onPress={() => setShowManual(true)}
      >
        <FontAwesome name="keyboard-o" size={24} color="white" />
        <Text style={styles.manualButtonText}>Enter ID Manually</Text>
      </TouchableOpacity>

      {/* 3. THE MANUAL INPUT POPUP (Modal) */}
      {/* 3. THE MANUAL INPUT POPUP (Modal) */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={showManual}
        onRequestClose={() => setShowManual(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Manual Entry</Text>
            <Text style={styles.modalSubtitle}>
              Type the tracking number exactly
            </Text>

            <TextInput
              style={styles.input}
              placeholder="AT-2026..."
              placeholderTextColor="#94a3b8"
              value={manualCode}
              onChangeText={setManualCode}
              autoCapitalize="characters"
              autoCorrect={false}
            />

            {/* ACTION BUTTONS: Row Layout */}
            <View style={styles.modalActions}>
              {/* Cancel Button */}
              <TouchableOpacity
                style={[styles.actionBtn, styles.cancelBtn]}
                onPress={() => setShowManual(false)}
              >
                <Text style={styles.cancelText}>CANCEL</Text>
              </TouchableOpacity>

              {/* Submit Button */}
              <TouchableOpacity
                style={[styles.actionBtn, styles.submitBtn]}
                onPress={() => {
                  setShowManual(false);
                  processPackage(manualCode);
                }}
              >
                <Text style={styles.submitText}>SUBMIT</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  camera: { flex: 1 },
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
  instruction: {
    color: "#e2e8f0",
    marginTop: 20,
    fontSize: 14,
  },
  square: {
    width: 260,
    height: 260,
    borderWidth: 4,
    borderColor: "#2563eb",
    borderRadius: 20,
    backgroundColor: "transparent",
  },
  link: { color: "blue", marginTop: 10, fontWeight: "bold" },
  manualButton: {
    position: "absolute",
    bottom: 50,
    alignSelf: "center",
    backgroundColor: "rgba(0,0,0,0.8)",
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
  modalOverlay: {
    flex: 1, // Takes up full screen height
    justifyContent: "flex-end", // 👈 Pushes everything to the BOTTOM
    backgroundColor: "rgba(0,0,0,0.5)",
  },

  modalContent: {
    backgroundColor: "white",
    padding: 24,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    width: "100%",

    // Optional: Add safe area padding for iPhone Home Indicator
    paddingBottom: 40,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#0f172a",
    marginBottom: 4,
    textAlign: "center",
  },
  modalSubtitle: {
    color: "#64748b",
    fontSize: 14,
    textAlign: "center",
    marginBottom: 20,
  },
  input: {
    backgroundColor: "#f1f5f9",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    padding: 16,
    fontSize: 18,
    fontWeight: "600",
    color: "#0f172a",
    textAlign: "center",
    marginBottom: 24,
  },

  // 🛠️ KEY LAYOUT FIXES START HERE
  modalActions: {
    flexDirection: "row", // Put them side by side
    gap: 12, // Space between them
    width: "100%",
  },
  actionBtn: {
    flex: 1, // 👈 This makes them stretch to fill the row
    height: 50,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  cancelBtn: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#cbd5e1",
  },
  submitBtn: {
    backgroundColor: "#3b82f6", // Atlas Blue
  },
  cancelText: {
    fontWeight: "700",
    color: "#64748b",
  },
  submitText: {
    fontWeight: "700",
    color: "#fff",
  },
});
