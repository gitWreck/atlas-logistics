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
import {
  scanPackages,
  updateShipmentPackages,
} from "../../components/utilities/FirebaseFunctions";
import PermissionRequest from "../../components/scanner/PermissionRequest";
import ScannerOverlay from "../../components/scanner/ScannerOverlay";
import ManualEntryModal from "../../components/scanner/ManualEntryModal";
import { getCurrentLocationSafe } from "../../components/utilities/helpers";
import ShipmentInfoModal from "../../components/checker/shipment-details/ShipmentInfoModal";

export default function ScannerScreen() {
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [showManual, setShowManual] = useState(false);

  const [infoModalVisible, setInfoModalVisible] = useState(false);
  const [scannedData, setScannedData] = useState(null);

  const { mode, title } = useLocalSearchParams();

  // --- PERMISSION CHECK ---
  if (!permission) return <View />;
  if (!permission.granted) {
    return <PermissionRequest onRequest={requestPermission} />;
  }

  const handleProcessPackage = async (barcode) => {
    if (processing) return;
    setProcessing(true);
    Vibration.vibrate();

    try {
      // const isShipment = barcode.startsWith("AT-");
      // if (isShipment) {
      //   router.push({
      //     pathname: "/(checker)/shipment-details",
      //     params: { shipmentId: barcode },
      //   });
      //   return; // Navigation will unmount this, so no need to reset
      // }

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
          setScannedData(shipmentData);
          setInfoModalVisible(true);
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

      const location = await getCurrentLocationSafe();
      const statusToApply = mode === "loading" ? "LOADED" : "RECEIVED";

      // We use the same Cloud Function as the manual selection screen
      await updateShipmentPackages({
        packageIds: [barcode],
        newStatus: statusToApply,
        location: location,
        // tripId: ??? -> You'll need to pass the current tripId from the dashboard
      });

      // ✅ TOAST STYLE FEEDBACK (Optional: avoid Alert here for high-speed scanning)
      console.log(`Successfully marked ${barcode} as ${statusToApply}`);

      // Auto-reset after a short delay for "Rapid Fire" scanning
      setTimeout(() => {
        resetScanner();
      }, 1000);
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
      <ShipmentInfoModal
        visible={infoModalVisible}
        data={scannedData}
        onClose={() => {
          setInfoModalVisible(false);
          resetScanner();
        }}
        onDetails={() => {
          setInfoModalVisible(false);
          router.push({
            pathname: "/(checker)/shipment-details",
            params: { shipmentId: scannedData.id || barcode }, // barcode works if it was a direct hit
          });
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  camera: { flex: 1 },
});
