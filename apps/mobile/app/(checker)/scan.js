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
import AtlasButton from "../../components/ui/AtlasButton";
import { scanPackages } from "../../components/utilities/FirebaseFunctions";

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
  const processPackage = async (barcode) => {
    if (processing) return; // Prevent double taps
    setProcessing(true);

    // (Optional) If coming from manual input, maybe don't vibrate?
    // Or keep it for consistent feedback.
    Vibration.vibrate();

    try {
      const result = await scanPackages({
        barcode: barcode, // ✅ Accepts string from Camera OR Text Input
        mode: mode,
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
              value={manualCode}
              onChangeText={setManualCode}
              autoCapitalize="characters"
              autoCorrect={false}
            />

            <View style={styles.modalActions}>
              <AtlasButton
                title="CANCEL"
                style={{ backgroundColor: "#ef4444", flex: 1, marginRight: 10 }}
                onPress={() => setShowManual(false)}
              />
              <AtlasButton
                title="SUBMIT"
                style={{ flex: 1 }}
                onPress={() => {
                  setShowManual(false); // Close modal
                  processPackage(manualCode); // 🚀 Call the same logic!
                }}
              />
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
    flex: 1,
    justifyContent: "flex-end", // Aligns to bottom like a sheet
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  modalContent: {
    backgroundColor: "white",
    padding: 24,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    padding: 16,
    fontSize: 18,
    marginVertical: 20,
    backgroundColor: "#f8fafc",
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
});
