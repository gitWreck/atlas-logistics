"use client";
import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Alert,
  Vibration,
  StyleSheet,
  Text,
  Modal,
  TouchableOpacity,
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useLocalSearchParams, useRouter } from "expo-router";
import { collection, query, where, getDocs } from "firebase/firestore";
import { FontAwesome5 } from "@expo/vector-icons";
import { db } from "../../firebase";

import PermissionRequest from "../../components/scanner/PermissionRequest";
import ScannerOverlay from "../../components/scanner/ScannerOverlay";
import ManualEntryModal from "../../components/scanner/ManualEntryModal";
import PackageActionModal from "../../components/checker/shipment-details/PackageActionModal";
import ShipmentInfoModal from "../../components/checker/shipment-details/ShipmentInfoModal";
import { updateShipmentPackages } from "../../components/utilities/FirebaseFunctions";
import { getCurrentLocationSafe } from "../../components/utilities/helpers";

const SUCCESS_MODAL_SECONDS = 5;

export default function ScannerScreen() {
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();

  const [scanned, setScanned] = useState(false);
  const [processing, setProcessing] = useState(false);

  const [showManual, setShowManual] = useState(false);

  const [actionModalVisible, setActionModalVisible] = useState(false);
  const [targetPackage, setTargetPackage] = useState(null);
  const [parentShipmentId, setParentShipmentId] = useState(null);
  const [pendingActionStatus, setPendingActionStatus] = useState(null);

  const [infoModalVisible, setInfoModalVisible] = useState(false);
  const [scannedData, setScannedData] = useState(null);

  const [successModalVisible, setSuccessModalVisible] = useState(false);
  const [successPayload, setSuccessPayload] = useState(null);
  const [countdown, setCountdown] = useState(SUCCESS_MODAL_SECONDS);

  const successTimerRef = useRef(null);
  const countdownTimerRef = useRef(null);

  const { mode, tripId } = useLocalSearchParams();

  useEffect(() => {
    return () => {
      clearSuccessTimers();
    };
  }, []);

  const clearSuccessTimers = () => {
    if (successTimerRef.current) clearTimeout(successTimerRef.current);
    if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    successTimerRef.current = null;
    countdownTimerRef.current = null;
  };

  const resetScanner = () => {
    setScanned(false);
    setProcessing(false);
    setTargetPackage(null);
    setParentShipmentId(null);
    setPendingActionStatus(null);
    setActionModalVisible(false);
    setInfoModalVisible(false);
    setScannedData(null);
  };

  const closeSuccessModal = () => {
    clearSuccessTimers();
    setSuccessModalVisible(false);
    setSuccessPayload(null);
    resetScanner();
  };

  const showSuccessModal = ({
    barcode,
    shipmentId,
    shipmentStatus,
    packageStatus,
    quantity,
    message,
    source = "scan",
  }) => {
    clearSuccessTimers();

    setSuccessPayload({
      barcode,
      shipmentId,
      shipmentStatus,
      packageStatus,
      quantity,
      message,
      source,
    });

    setCountdown(SUCCESS_MODAL_SECONDS);
    setSuccessModalVisible(true);

    countdownTimerRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(countdownTimerRef.current);
          countdownTimerRef.current = null;
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    successTimerRef.current = setTimeout(() => {
      closeSuccessModal();
    }, SUCCESS_MODAL_SECONDS * 1000);
  };

  if (!permission) return <View />;
  if (!permission.granted) {
    return <PermissionRequest onRequest={requestPermission} />;
  }

  const getStatusToApply = () => {
    if (mode === "loading") return "LOADED";
    if (mode === "offloading") return "RECEIVED";
    return null;
  };

  const executeStatusUpdate = async ({
    shipmentId,
    barcode,
    status,
    qty = null,
    remarks = "",
    source = "scan",
    shipmentDocData = null,
  }) => {
    try {
      const location = await getCurrentLocationSafe();

      await updateShipmentPackages({
        shipmentId,
        packageIds: [barcode],
        newStatus: status,
        location,
        tripId,
        manualQty: qty,
        remarks,
      });

      showSuccessModal({
        barcode,
        shipmentId,
        shipmentStatus: shipmentDocData?.status || "",
        packageStatus: status,
        quantity: qty,
        message:
          source === "manual"
            ? "Manual entry processed successfully."
            : "Scan processed successfully.",
        source,
      });
    } catch (error) {
      console.error("Package update failed:", error);
      Alert.alert(
        "Action Failed",
        error.message || "Failed to update package.",
        [{ text: "Retry", onPress: resetScanner }],
      );
      setProcessing(false);
    }
  };

  const openInfoPreview = (shipmentDoc, pkg, barcode) => {
    setScannedData({
      id: shipmentDoc.id,
      ...shipmentDoc.data(),
      scannedPackageId: pkg.packageId || barcode,
    });
    setInfoModalVisible(true);
    setProcessing(false);
  };

  const handleResolvedPackage = async ({
    shipmentDoc,
    pkg,
    barcode,
    manualQtyOverride = null,
    source = "scan",
  }) => {
    const shipmentData = shipmentDoc.data();
    const statusToApply = getStatusToApply();

    if (mode === "info") {
      openInfoPreview(shipmentDoc, pkg, barcode);
      return;
    }

    if (!statusToApply) {
      throw new Error("Unsupported scan mode.");
    }

    const packagingGroup = String(pkg?.packagingGroup || "").toUpperCase();
    const isBulk = packagingGroup === "BULK";

    if (isBulk && manualQtyOverride == null) {
      setTargetPackage(pkg);
      setParentShipmentId(shipmentDoc.id);
      setPendingActionStatus(statusToApply);
      setActionModalVisible(true);
      setProcessing(false);
      return;
    }

    await executeStatusUpdate({
      shipmentId: shipmentDoc.id,
      barcode,
      status: statusToApply,
      qty: isBulk ? manualQtyOverride : null,
      remarks: "",
      source,
      shipmentDocData: shipmentData,
    });
  };

  const lookupPackageByBarcode = async (barcode) => {
    const q = query(
      collection(db, "shipments"),
      where("packageBarcodes", "array-contains", barcode),
    );

    const querySnap = await getDocs(q);

    if (querySnap.empty) {
      throw new Error("Package not found.");
    }

    const shipmentDoc = querySnap.docs[0];
    const shipmentData = shipmentDoc.data();

    const pkg = (shipmentData.packages || []).find(
      (p) => p.packageId === barcode,
    );

    if (!pkg) {
      throw new Error("Package not found in shipment.");
    }

    return { shipmentDoc, shipmentData, pkg };
  };

  const handleProcessPackage = async (
    barcode,
    manualQtyOverride = null,
    source = "scan",
  ) => {
    if (processing) return;

    setProcessing(true);
    Vibration.vibrate();

    try {
      const { shipmentDoc, pkg } = await lookupPackageByBarcode(barcode);

      await handleResolvedPackage({
        shipmentDoc,
        pkg,
        barcode,
        manualQtyOverride,
        source,
      });
    } catch (error) {
      console.error("Process package error:", error);
      Alert.alert("Error", error.message || "Failed to process package.", [
        { text: "Retry", onPress: resetScanner },
      ]);
      setProcessing(false);
    }
  };

  const onCameraScan = ({ data }) => {
    if (!scanned && !processing) {
      setScanned(true);
      handleProcessPackage(data, null, "scan");
    }
  };

  const onManualSubmit = async (code) => {
    setShowManual(false);
    setScanned(true);
    await handleProcessPackage(code, null, "manual");
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

      <PackageActionModal
        visible={actionModalVisible}
        onClose={resetScanner}
        count={1}
        maxQty={targetPackage?.quantity || 1}
        onAction={(status, remarks, qty) => {
          executeStatusUpdate({
            shipmentId: parentShipmentId,
            barcode: targetPackage?.packageId,
            status,
            qty,
            remarks,
            source: "scan",
          });
          setActionModalVisible(false);
        }}
        packagingGroup={targetPackage?.packagingGroup}
        defaultAction={pendingActionStatus}
      />

      <ManualEntryModal
        visible={showManual}
        onClose={() => setShowManual(false)}
        onSubmit={onManualSubmit}
        loading={processing}
        mode={mode}
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

      <Modal
        visible={successModalVisible}
        transparent
        animationType="fade"
        onRequestClose={closeSuccessModal}
      >
        <View style={styles.successOverlay}>
          <View style={styles.successCard}>
            <View style={styles.successIconWrap}>
              <FontAwesome5 name="check" size={24} color="#fff" />
            </View>

            <Text style={styles.successTitle}>Success</Text>
            <Text style={styles.successMessage}>
              {successPayload?.message || "Package processed successfully."}
            </Text>

            <View style={styles.successMetaBox}>
              <View style={styles.successMetaRow}>
                <Text style={styles.successMetaLabel}>Package</Text>
                <Text style={styles.successMetaValue}>
                  {successPayload?.barcode || "—"}
                </Text>
              </View>

              <View style={styles.successMetaRow}>
                <Text style={styles.successMetaLabel}>Status</Text>
                <Text style={styles.successMetaValue}>
                  {successPayload?.packageStatus || "—"}
                </Text>
              </View>

              {!!successPayload?.quantity && (
                <View style={styles.successMetaRow}>
                  <Text style={styles.successMetaLabel}>Quantity</Text>
                  <Text style={styles.successMetaValue}>
                    {successPayload?.quantity}
                  </Text>
                </View>
              )}

              <View style={styles.successMetaRow}>
                <Text style={styles.successMetaLabel}>Source</Text>
                <Text style={styles.successMetaValue}>
                  {successPayload?.source === "manual"
                    ? "Manual Input"
                    : "Scan"}
                </Text>
              </View>
            </View>

            <Text style={styles.countdownText}>Closing in {countdown}s</Text>

            <TouchableOpacity
              style={styles.closeButton}
              onPress={closeSuccessModal}
              activeOpacity={0.8}
            >
              <Text style={styles.closeButtonText}>Close Now</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  camera: { flex: 1 },

  successOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.55)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  successCard: {
    width: "100%",
    maxWidth: 360,
    backgroundColor: "#ffffff",
    borderRadius: 24,
    padding: 24,
    alignItems: "center",
  },
  successIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#10b981",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  successTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#0f172a",
  },
  successMessage: {
    marginTop: 8,
    fontSize: 14,
    color: "#64748b",
    textAlign: "center",
  },
  successMetaBox: {
    width: "100%",
    marginTop: 18,
    backgroundColor: "#f8fafc",
    borderRadius: 16,
    padding: 14,
    gap: 10,
  },
  successMetaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  successMetaLabel: {
    fontSize: 12,
    color: "#64748b",
    fontWeight: "700",
  },
  successMetaValue: {
    flex: 1,
    textAlign: "right",
    fontSize: 12,
    color: "#0f172a",
    fontWeight: "700",
  },
  countdownText: {
    marginTop: 16,
    fontSize: 12,
    color: "#94a3b8",
    fontWeight: "700",
  },
  closeButton: {
    marginTop: 14,
    width: "100%",
    backgroundColor: "#0f172a",
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
  },
  closeButtonText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "800",
  },
});
