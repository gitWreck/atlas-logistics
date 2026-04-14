"use client";
import React, { useEffect, useRef, useState } from "react";
import { View, Alert, Vibration, StyleSheet, Text } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useLocalSearchParams, useRouter } from "expo-router";
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
import { updateShipmentPackages } from "../../components/utilities/FirebaseFunctions";
import PermissionRequest from "../../components/scanner/PermissionRequest";
import ScannerOverlay from "../../components/scanner/ScannerOverlay";
import ManualEntryModal from "../../components/scanner/ManualEntryModal";
import PackageActionModal from "../../components/checker/shipment-details/PackageActionModal"; // ✅ New Import
import ShipmentInfoModal from "../../components/checker/shipment-details/ShipmentInfoModal";
import { getCurrentLocationSafe } from "../../components/utilities/helpers";

export default function ScannerScreen() {
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [showManual, setShowManual] = useState(false);

  // --- NEW STATES FOR BULK HANDLING ---
  const [actionModalVisible, setActionModalVisible] = useState(false);
  const [targetPackage, setTargetPackage] = useState(null);
  const [parentShipmentId, setParentShipmentId] = useState(null);

  const [infoModalVisible, setInfoModalVisible] = useState(false);
  const [scannedData, setScannedData] = useState(null);
  const [successToast, setSuccessToast] = useState("");
  const toastTimerRef = useRef(null);

  const { mode, tripId } = useLocalSearchParams();

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  if (!permission) return <View />;
  if (!permission.granted)
    return <PermissionRequest onRequest={requestPermission} />;

  const showSuccessToast = (message) => {
    setSuccessToast(message || "Scan successful");
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setSuccessToast(""), 1800);
  };

  const resetScanner = () => {
    setScanned(false);
    setProcessing(false);
    setTargetPackage(null);
    setActionModalVisible(false);
    setInfoModalVisible(false);
    setScannedData(null);
  };

  /**
   * Main execution logic for updating status
   */
  const executeStatusUpdate = async (
    shipmentId,
    barcode,
    status,
    qty = null,
    remarks = "",
  ) => {
    try {
      const location = await getCurrentLocationSafe();

      await updateShipmentPackages({
        shipmentId,
        packageIds: [barcode],
        newStatus: status,
        location: location,
        tripId: tripId,
        manualQty: qty, // ✅ Supports partial sack loading
        remarks: remarks,
      });

      console.log(`Successfully updated ${barcode} to ${status}`);
      showSuccessToast(`Scan successful: ${barcode}`);
      resetScanner();
    } catch (error) {
      Alert.alert("Action Failed", error.message, [
        { text: "Retry", onPress: resetScanner },
      ]);
    }
  };

  const onManualSubmit = (code, qty) => {
    setShowManual(false);

    // we bypass the normal "lookup" flow and execute immediately
    if (qty) {
      // (Usually this is already done in handleLookup inside the modal)
      handleProcessPackage(code, qty);
    } else {
      handleProcessPackage(code);
    }
  };

  /**
   * Scanned Barcode Handler
   */
  // Adjust handleProcessPackage to accept an optional qty override
  const handleProcessPackage = async (barcode, manualQtyOverride = null) => {
    if (processing) return;
    setProcessing(true);
    Vibration.vibrate();

    try {
      const q = query(
        collection(db, "shipments"),
        where("packageBarcodes", "array-contains", barcode),
      );
      const querySnap = await getDocs(q);

      if (querySnap.empty) throw new Error("Package not found.");

      const shipmentDoc = querySnap.docs[0];
      const shipmentData = shipmentDoc.data();
      const pkg = shipmentData.packages.find(
        (p) => p.packageId === barcode,
      );
      if (!pkg) throw new Error("Package not found.");

      // Info mode should only preview shipment details.
      if (mode === "info") {
        setScannedData({
          id: shipmentDoc.id,
          ...shipmentData,
          scannedPackageId: pkg.packageId || barcode,
        });
        showSuccessToast("Scan successful");
        setInfoModalVisible(true);
        return;
      }

      const isBulk = ["Sack", "Bundle", "Roll"].includes(pkg?.packagingType);
      const statusToApply = mode === "loading" ? "LOADED" : "RECEIVED";

      // ✅ LOGIC CHANGE:
      // If we already have a manualQtyOverride (from ManualEntryModal), use it.
      // If we scanned a bulk item and DON'T have an override, open the popup.
      if (isBulk && !manualQtyOverride && mode !== "info") {
        setTargetPackage(pkg);
        setParentShipmentId(shipmentDoc.id);
        setActionModalVisible(true);
        return;
      }

      // Execute immediately using manualQtyOverride or full quantity
      await executeStatusUpdate(
        shipmentDoc.id,
        barcode,
        statusToApply,
        manualQtyOverride || (isBulk ? null : pkg.quantity),
      );
    } catch (error) {
      Alert.alert("Error", error.message, [
        { text: "Retry", onPress: resetScanner },
      ]);
    }
  };

  const onCameraScan = ({ data }) => {
    if (!scanned && !processing) {
      setScanned(true);
      handleProcessPackage(data);
    }
  };

  return (
    <View style={styles.container}>
      <CameraView
        style={styles.camera}
        facing="back"
        onBarcodeScanned={scanned ? undefined : onCameraScan}
        barcodeScannerSettings={{
          barcodeTypes: ["qr", "code128", "code39", "pdf417"],
        }}
      >
        <ScannerOverlay
          processing={processing}
          mode={mode}
          onManualPress={() => setShowManual(true)}
        />
      </CameraView>

      {/* ✅ QUANTITY MODAL: Intercepts Sacks and Bundles */}
      <PackageActionModal
        visible={actionModalVisible}
        onClose={resetScanner}
        count={1}
        maxQty={targetPackage?.quantity || 1}
        onAction={(status, remarks, qty) => {
          executeStatusUpdate(
            parentShipmentId,
            targetPackage.packageId,
            status,
            qty,
            remarks,
          );
        }}
      />

      <ManualEntryModal
        visible={showManual}
        onClose={() => setShowManual(false)}
        onSubmit={(code, qty) => {
          setShowManual(false);
          onManualSubmit(code, qty); // Pass the quantity forward
        }}
      />

      <ShipmentInfoModal
        visible={infoModalVisible}
        data={scannedData}
        onClose={resetScanner}
        onDetails={() => {
          setInfoModalVisible(false);
          router.push({
            pathname: "/(checker)/shipment-details",
            params: { shipmentId: scannedData.id, parentTripId: tripId },
          });
        }}
      />

      {!!successToast && (
        <View style={styles.toastContainer}>
          <Text style={styles.toastText}>{successToast}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  camera: { flex: 1 },
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
