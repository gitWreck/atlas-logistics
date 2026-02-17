import React, { useState } from "react";
import { View, Alert, Vibration, StyleSheet } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useLocalSearchParams, useRouter } from "expo-router";
import GetLocation from "react-native-get-location";
import {
  doc,
  getDoc,
  collection,
  query,
  where,
  getDocs,
} from "firebase/firestore";
import { db } from "../../firebase";

// Import Custom Components
import { scanPackages } from "../../components/utilities/FirebaseFunctions";
import PermissionRequest from "../../components/scanner/PermissionRequest";
import ScannerOverlay from "../../components/scanner/ScannerOverlay";
import ManualEntryModal from "../../components/scanner/ManualEntryModal";

export default function ScannerScreen() {
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [showManual, setShowManual] = useState(false);

  const { mode } = useLocalSearchParams();

  // --- PERMISSION CHECK ---
  if (!permission) return <View />;
  if (!permission.granted) {
    return <PermissionRequest onRequest={requestPermission} />;
  }

  // --- HELPERS ---
  const getCurrentLocationSafe = async () => {
    try {
      const loc = await GetLocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 15000,
      });
      return loc ? { lat: loc.latitude, lng: loc.longitude } : null;
    } catch (error) {
      console.log("Location error:", error);
      return null;
    }
  };

  const handleProcessPackage = async (barcode) => {
    if (processing) return;
    setProcessing(true);
    Vibration.vibrate();

    try {
      // ------------------------------------------
      // MODE: INFO (Read Directly from Phone)
      // ------------------------------------------
      if (mode === "info") {
        let shipmentData = null;
        let shipmentId = barcode;

        // STEP 1: Try finding the document directly (Shipment Level Scan)
        const shipmentRef = doc(db, "shipments", barcode);
        const docSnap = await getDoc(shipmentRef);

        if (docSnap.exists()) {
          shipmentData = docSnap.data();
        } else {
          // STEP 2: If not found, search inside packages (Package Level Scan)
          // "Find the shipment where packageBarcodes array contains this barcode"
          const q = query(
            collection(db, "shipments"),
            where("packageBarcodes", "array-contains", barcode),
          );
          const querySnap = await getDocs(q);

          if (!querySnap.empty) {
            // Found the parent shipment!
            const parentDoc = querySnap.docs[0];
            shipmentData = parentDoc.data();
            shipmentId = parentDoc.id;
          }
        }

        // STEP 3: Display Results
        if (shipmentData) {
          const infoText = `
          Shipment: ${shipmentData.trackingNumber}
          Status: ${shipmentData.status || "N/A"}
          Origin: ${shipmentData.originCode} ➔ ${shipmentData.destinationCode}
          Sender: ${shipmentData.sender?.name || "N/A"}
          Receiver: ${shipmentData.recipient?.name || "N/A"}
          Packages: ${shipmentData.packageBarcodes?.length || 0} items
        `.trim();

          Alert.alert("Shipment Found", infoText, [
            { text: "OK", onPress: resetScanner },
          ]);
        } else {
          Alert.alert(
            "Not Found",
            "No shipment or package found with this ID.",
            [{ text: "Scan Again", onPress: resetScanner }],
          );
        }
        return;
      }

      // ------------------------------------------
      // MODE: LOAD/OFFLOAD (Cloud Function)
      // ------------------------------------------
      // The Cloud Function should already handle this logic internally,
      // but if it doesn't, you might need to update it too.
      // For now, we assume your 'scanPackages' function handles the lookup.

      const location = await getCurrentLocationSafe();

      const result = await scanPackages({
        barcode: barcode,
        mode: mode,
        ...(location ? { location } : {}),
      });

      Alert.alert("Success", result.data.message, [
        { text: "Next", onPress: resetScanner },
      ]);
    } catch (error) {
      console.error(error);
      Alert.alert("Error", error.message || "Scan failed", [
        { text: "Retry", onPress: resetScanner },
      ]);
    }
  };

  const resetScanner = () => {
    setScanned(false);
    setProcessing(false);
  };

  const onCameraScan = ({ data }) => {
    if (!scanned && !processing) {
      setScanned(true);
      handleProcessPackage(data);
    }
  };

  const onManualSubmit = (code) => {
    setShowManual(false);
    handleProcessPackage(code);
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
            "ean13",
            "ean8",
            "upc_e",
            "code128",
            "code39",
            "pdf417",
          ],
        }}
      >
        <ScannerOverlay
          processing={processing}
          mode={mode}
          onManualPress={() => setShowManual(true)}
        />
      </CameraView>

      <ManualEntryModal
        visible={showManual}
        onClose={() => setShowManual(false)}
        onSubmit={onManualSubmit}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  camera: { flex: 1 },
});
