import React, { useEffect, useRef, useState } from "react";
import {
  Text,
  View,
  StyleSheet,
  Alert,
  ActivityIndicator,
  TouchableOpacity,
  Vibration,
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useRouter, useLocalSearchParams } from "expo-router";
import { getFunctions, httpsCallable } from "firebase/functions";
import { Ionicons } from "@expo/vector-icons";
import GetLocation from "react-native-get-location";

export default function DriverScannerScreen() {
  const router = useRouter();
  const { mode, title } = useLocalSearchParams(); // mode is usually "delivered"
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [successToast, setSuccessToast] = useState("");
  const toastTimerRef = useRef(null);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  const showSuccessToast = (message) => {
    setSuccessToast(message || "Scan successful");
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setSuccessToast(""), 1800);
  };

  if (!permission) return <View />;
  if (!permission.granted) {
    return (
      <View style={styles.center}>
        <Text style={{ color: "#fff" }}>Camera permission is required.</Text>
        <TouchableOpacity onPress={requestPermission} style={styles.permBtn}>
          <Text style={styles.btnText}>Grant Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

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
      console.log("Location error (driver scan):", error);
      return null;
    }
  };

  const handleScan = async ({ data }) => {
    if (scanned || processing) return;
    setScanned(true);
    setProcessing(true);
    Vibration.vibrate();

    try {
      const functions = getFunctions(undefined, "asia-southeast1");
      const scanPackageFn = httpsCallable(functions, "scanPackages");

      // Reuse the existing scanPackages function
      const location = await getCurrentLocationSafe();
      const result = await scanPackageFn({
        barcode: data,
        mode: mode || "delivering", // Cloud function expects "delivering"
        ...(location ? { location } : {}),
      });
      showSuccessToast(result?.data?.message || "Scan successful");

      Alert.alert("Success", result.data.message, [
        {
          text: "Scan Next",
          onPress: () => {
            setScanned(false);
            setProcessing(false);
          },
        },
        {
          text: "Done",
          style: "cancel",
          onPress: () => router.back(),
        },
      ]);
    } catch (error) {
      Alert.alert("Error", error.message, [
        {
          text: "OK",
          onPress: () => {
            setScanned(false);
            setProcessing(false);
          },
        },
      ]);
    }
  };

  return (
    <View style={styles.container}>
      <CameraView
        style={styles.camera}
        facing="back"
        onBarcodeScanned={scanned ? undefined : handleScan}
        barcodeScannerSettings={{
          barcodeTypes: ["qr", "code128", "ean13"],
        }}
      >
        {/* Header Overlay */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.closeBtn}
          >
            <Ionicons name="close" size={30} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.title}>{title || "Scan Item"}</Text>
        </View>

        {/* Center Guide */}
        <View style={styles.overlay}>
          {processing && (
            <ActivityIndicator
              size="large"
              color="#fbbf24"
              style={{ marginBottom: 20 }}
            />
          )}
          <View
            style={[styles.square, processing && { borderColor: "#fbbf24" }]}
          />
          <Text style={styles.instruction}>Align barcode within frame</Text>
        </View>
      </CameraView>

      {!!successToast && (
        <View style={styles.toastContainer}>
          <Text style={styles.toastText}>{successToast}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#0f172a",
  },
  camera: { flex: 1 },

  header: {
    position: "absolute",
    top: 50,
    left: 20,
    right: 20,
    zIndex: 10,
    flexDirection: "row",
    alignItems: "center",
  },
  closeBtn: {
    width: 40,
    height: 40,
    backgroundColor: "rgba(0,0,0,0.5)",
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 15,
  },
  title: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "bold",
    textShadowColor: "rgba(0,0,0,0.8)",
    textShadowRadius: 10,
  },

  overlay: { flex: 1, justifyContent: "center", alignItems: "center" },
  square: {
    width: 280,
    height: 280,
    borderWidth: 2,
    borderColor: "#fff",
    borderRadius: 20,
    backgroundColor: "transparent",
  },
  instruction: {
    color: "#fff",
    marginTop: 20,
    fontSize: 16,
    backgroundColor: "rgba(0,0,0,0.6)",
    padding: 8,
    borderRadius: 8,
  },

  permBtn: {
    marginTop: 20,
    backgroundColor: "#fbbf24",
    padding: 12,
    borderRadius: 8,
  },
  btnText: { fontWeight: "bold" },
  toastContainer: {
    position: "absolute",
    bottom: 36,
    left: 20,
    right: 20,
    backgroundColor: "rgba(15, 23, 42, 0.92)",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    alignItems: "center",
  },
  toastText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 13,
  },
});
