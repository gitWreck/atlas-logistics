"use client";
import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Alert,
  ActivityIndicator,
  Vibration,
  StyleSheet,
  Text,
  Modal,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  PanResponder,
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
} from "firebase/firestore";
import { FontAwesome5 } from "@expo/vector-icons";
import { db } from "../../firebase";

import PermissionRequest from "../../components/scanner/PermissionRequest";
import ManualEntryModal from "../../components/scanner/ManualEntryModal";
import PackageActionModal from "../../components/checker/shipment-details/PackageActionModal";
import ShipmentInfoModal from "../../components/checker/shipment-details/ShipmentInfoModal";
import {
  updateShipmentPackages,
  updateTripStatus,
} from "../../components/utilities/FirebaseFunctions";
import {
  getCurrentLocationSafe,
  updatedBy,
} from "../../components/utilities/helpers";
import { useAuth } from "../../contexts/AuthContext";
import { useTheme } from "../../contexts/ThemeContext";

const SUCCESS_MODAL_SECONDS = 5;
const WINDOW_HEIGHT = Dimensions.get("window").height;
const MIN_DETAILS_SHEET_HEIGHT = Math.round(WINDOW_HEIGHT * 0.2);
const MAX_DETAILS_SHEET_HEIGHT = Math.round(WINDOW_HEIGHT * 0.8);
const DEFAULT_DETAILS_SHEET_HEIGHT = Math.round(WINDOW_HEIGHT * 0.5);

const clampSheetHeight = (height) =>
  Math.max(
    MIN_DETAILS_SHEET_HEIGHT,
    Math.min(height, MAX_DETAILS_SHEET_HEIGHT),
  );

const MODE_SCAN_ACTIONS = {
  loading: [
    {
      label: "Loaded",
      status: "LOADED",
      icon: "truck",
      color: "#2563eb",
    },
  ],
  offloading: [
    {
      label: "Received",
      status: "RECEIVED",
      icon: "warehouse",
      color: "#10b981",
    },
    {
      label: "Delivered",
      status: "DELIVERED",
      icon: "check-circle",
      color: "#2563eb",
    },
  ],
  info: [
    {
      label: "Information",
      status: null,
      icon: "info-circle",
      color: "#6366f1",
    },
  ],
};

const ISSUE_SCAN_ACTIONS = [
  {
    label: "Mark Missing",
    status: "MISSING",
    icon: "exclamation-triangle",
    color: "#dc2626",
  },
  {
    label: "Mark Damaged",
    status: "DAMAGED",
    icon: "tools",
    color: "#f59e0b",
  },
];

const OFFLOAD_COMPLETION_SOURCE_STATUSES = [
  "LOADED",
  "READY_FOR_DELIVERY",
  "OUT_FOR_DELIVERY",
];

const EMPTY_TRIP_SUMMARY = {
  tripId: "",
  status: "",
  shipmentCount: 0,
  totalPackages: 0,
  scannedPackages: 0,
  loadedPackages: 0,
  progress: 0,
};

const EMPTY_SCAN_DETAILS = {
  type: "waiting",
  code: "",
  title: "Ready to scan",
  shipmentId: "",
  trackingNumber: "",
  packageStatus: "",
  shipmentStatus: "",
  currentTripId: "",
  customerName: "",
  source: "",
};

export default function ScannerScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { profile } = useAuth();
  const [permission, requestPermission] = useCameraPermissions();

  const [scanned, setScanned] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [flashEnabled, setFlashEnabled] = useState(false);
  const [showManual, setShowManual] = useState(false);

  const [actionModalVisible, setActionModalVisible] = useState(false);
  const [targetPackage, setTargetPackage] = useState(null);
  const [parentShipmentId, setParentShipmentId] = useState(null);
  const [parentShipmentData, setParentShipmentData] = useState(null);
  const [pendingActionStatus, setPendingActionStatus] = useState(null);
  const [pendingActionSource, setPendingActionSource] = useState("scan");

  const [infoModalVisible, setInfoModalVisible] = useState(false);
  const [scannedData, setScannedData] = useState(null);

  const [successModalVisible, setSuccessModalVisible] = useState(false);
  const [successPayload, setSuccessPayload] = useState(null);
  const [countdown, setCountdown] = useState(SUCCESS_MODAL_SECONDS);
  const [tripSummary, setTripSummary] = useState(EMPTY_TRIP_SUMMARY);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [tripStatusUpdating, setTripStatusUpdating] = useState(false);
  const [latestScan, setLatestScan] = useState(EMPTY_SCAN_DETAILS);
  const [scanActionStatus, setScanActionStatus] = useState(null);
  const [detailsSheetHeight, setDetailsSheetHeight] = useState(
    DEFAULT_DETAILS_SHEET_HEIGHT,
  );

  const successTimerRef = useRef(null);
  const countdownTimerRef = useRef(null);
  const detailsSheetHeightRef = useRef(DEFAULT_DETAILS_SHEET_HEIGHT);
  const dragStartHeightRef = useRef(DEFAULT_DETAILS_SHEET_HEIGHT);
  const detailsSheetPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) =>
        Math.abs(gestureState.dy) > 2,
      onPanResponderGrant: () => {
        dragStartHeightRef.current = detailsSheetHeightRef.current;
      },
      onPanResponderMove: (_, gestureState) => {
        const nextHeight = clampSheetHeight(
          dragStartHeightRef.current - gestureState.dy,
        );
        detailsSheetHeightRef.current = nextHeight;
        setDetailsSheetHeight(nextHeight);
      },
      onPanResponderRelease: (_, gestureState) => {
        const nextHeight = clampSheetHeight(
          dragStartHeightRef.current - gestureState.dy,
        );
        detailsSheetHeightRef.current = nextHeight;
        setDetailsSheetHeight(nextHeight);
      },
    }),
  ).current;

  const { mode, tripId } = useLocalSearchParams();
  const resolvedMode = Array.isArray(mode) ? mode[0] : mode;
  const resolvedTripId = Array.isArray(tripId) ? tripId[0] : tripId;

  const getDefaultScanStatus = (targetMode = resolvedMode) =>
    MODE_SCAN_ACTIONS[targetMode]?.[0]?.status ?? null;

  const isIssueStatus = (status) =>
    ISSUE_SCAN_ACTIONS.some((action) => action.status === status);

  const canApplyOffloadCompletion = (status) =>
    OFFLOAD_COMPLETION_SOURCE_STATUSES.includes(
      String(status || "").toUpperCase(),
    );

  const clampProgress = (value, total) => {
    if (!total) return 0;
    return Math.max(0, Math.min(value, total));
  };

  const getShipmentTotal = (shipment = {}) => {
    const total =
      shipment.totalItems ??
      shipment.packageCount ??
      shipment.totals?.totalContentQty ??
      shipment.totals?.totalItems ??
      shipment.packageBarcodes?.length ??
      shipment.packages?.length ??
      0;

    return Math.max(Number(total) || 0, 0);
  };

  const getShipmentScannedCount = (shipment = {}) => {
    const total = getShipmentTotal(shipment);
    const loaded = Number(shipment.loadedCount ?? shipment.totals?.loaded ?? 0);
    const missing = Number(
      shipment.missingCount ?? shipment.totals?.missing ?? 0,
    );
    const damaged = Number(
      shipment.damagedCount ?? shipment.totals?.damaged ?? 0,
    );
    const received = Number(
      shipment.receivedCount ??
        shipment.deliveredCount ??
        shipment.totals?.received ??
        shipment.totals?.delivered ??
        0,
    );

    if (resolvedMode === "offloading") {
      return clampProgress(total - loaded, total);
    }

    if (resolvedMode === "loading") {
      return clampProgress(loaded + missing + damaged, total);
    }

    return clampProgress(Math.max(loaded, received) + missing + damaged, total);
  };

  const getShipmentLoadedCount = (shipment = {}) => {
    const total = getShipmentTotal(shipment);
    const loaded = Number(shipment.loadedCount ?? shipment.totals?.loaded ?? 0);

    return clampProgress(loaded, total);
  };

  const fetchTripScanSummary = async (targetTripId = resolvedTripId) => {
    if (!targetTripId) {
      setTripSummary(EMPTY_TRIP_SUMMARY);
      return EMPTY_TRIP_SUMMARY;
    }

    setSummaryLoading(true);

    try {
      const [tripSnap, shipmentSnap] = await Promise.all([
        getDoc(doc(db, "truck_trips", String(targetTripId))),
        getDocs(
          collection(db, "truck_trips", String(targetTripId), "trip_shipments"),
        ),
      ]);

      const shipments = shipmentSnap.docs.map((shipmentDoc) => ({
        id: shipmentDoc.id,
        ...shipmentDoc.data(),
      }));

      const totalPackages = shipments.reduce(
        (sum, shipment) => sum + getShipmentTotal(shipment),
        0,
      );
      const scannedPackages = shipments.reduce(
        (sum, shipment) => sum + getShipmentScannedCount(shipment),
        0,
      );
      const loadedPackages = shipments.reduce(
        (sum, shipment) => sum + getShipmentLoadedCount(shipment),
        0,
      );
      const progress =
        totalPackages > 0
          ? Math.round((scannedPackages / totalPackages) * 100)
          : 0;

      const summary = {
        tripId: String(targetTripId),
        status: tripSnap.exists() ? tripSnap.data()?.status || "" : "",
        shipmentCount: shipments.length,
        totalPackages,
        scannedPackages,
        loadedPackages,
        progress,
      };

      setTripSummary(summary);
      return summary;
    } catch (error) {
      console.error("Trip scan summary failed:", error);
      return tripSummary;
    } finally {
      setSummaryLoading(false);
    }
  };

  const getShipmentTripId = (shipmentData) => {
    const data = shipmentData ?? {};
    return (
      data.currentTripId ||
      data.currentTruckTripId ||
      data.tripId ||
      resolvedTripId ||
      ""
    );
  };

  const setLatestScanDetails = ({
    shipmentDoc,
    shipmentData,
    pkg = null,
    barcode,
    source = "scan",
    appliedStatus = "",
  }) => {
    const currentTripId = getShipmentTripId(shipmentData);

    setLatestScan({
      type: pkg ? "package" : "shipment",
      code: barcode,
      title: pkg ? "Package Scanned" : "Shipment Scanned",
      shipmentId: shipmentDoc.id,
      trackingNumber:
        shipmentData.trackingNumber ||
        shipmentData.shipmentId ||
        shipmentDoc.id,
      packageStatus: appliedStatus || pkg?.status || "",
      shipmentStatus: shipmentData.status || "",
      currentTripId,
      customerName:
        shipmentData.recipient?.name ||
        shipmentData.receiverName ||
        shipmentData.sender?.name ||
        "",
      source,
    });

    return currentTripId;
  };

  useEffect(() => {
    return () => {
      clearSuccessTimers();
    };
  }, []);

  useEffect(() => {
    fetchTripScanSummary(resolvedTripId);
  }, [resolvedTripId, resolvedMode]);

  useEffect(() => {
    detailsSheetHeightRef.current = detailsSheetHeight;
  }, [detailsSheetHeight]);

  useEffect(() => {
    setScanActionStatus(getDefaultScanStatus(resolvedMode));
  }, [resolvedMode]);

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
    setParentShipmentData(null);
    setPendingActionStatus(null);
    setPendingActionSource("scan");
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
    if (resolvedMode === "loading") {
      return scanActionStatus || "LOADED";
    }
    if (resolvedMode === "offloading") {
      return scanActionStatus || "RECEIVED";
    }
    if (resolvedMode === "info" && isIssueStatus(scanActionStatus)) {
      return scanActionStatus;
    }
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
        tripId: resolvedTripId,
        manualQty: qty,
        remarks,
        scanAction: resolvedMode,
        updatedBy: updatedBy(profile),
      });

      await fetchTripScanSummary(
        getShipmentTripId(shipmentDocData) || resolvedTripId,
      );

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
      scannedPackageId: pkg?.packageId || barcode,
    });
    setInfoModalVisible(true);
    setProcessing(false);
  };

  const promptDeliveryProof = (shipmentDoc, shipmentData) => {
    setProcessing(false);

    Alert.alert(
      "Proof Required",
      "Upload delivery photos before confirming this shipment as delivered.",
      [
        { text: "Scan Next", style: "cancel", onPress: resetScanner },
        {
          text: "Upload Proof",
          onPress: () =>
            router.push({
              pathname: "/(checker)/shipment-details",
              params: {
                shipmentId: shipmentDoc.id,
                parentTripId:
                  getShipmentTripId(shipmentData) ||
                  tripSummary.tripId ||
                  resolvedTripId,
              },
            }),
        },
      ],
    );
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
    const currentTripId = setLatestScanDetails({
      shipmentDoc,
      shipmentData,
      pkg,
      barcode,
      source,
      appliedStatus: statusToApply,
    });

    await fetchTripScanSummary(currentTripId);

    if (resolvedMode === "info" && !statusToApply) {
      openInfoPreview(shipmentDoc, pkg, barcode);
      return;
    }

    if (!statusToApply) {
      throw new Error("Unsupported scan mode.");
    }

    if (
      resolvedMode === "offloading" &&
      ["RECEIVED", "DELIVERED"].includes(statusToApply)
    ) {
      const packageStatus = String(pkg?.status || "").toUpperCase();
      const shipmentStatus = String(shipmentData?.status || "").toUpperCase();

      if (
        !canApplyOffloadCompletion(packageStatus) &&
        !canApplyOffloadCompletion(shipmentStatus)
      ) {
        throw new Error(
          "This item must be Loaded, Ready for Delivery, or Out for Delivery before it can be received or delivered.",
        );
      }
    }

    if (statusToApply === "DELIVERED") {
      promptDeliveryProof(shipmentDoc, shipmentData);
      return;
    }

    const packagingGroup = String(pkg?.packagingGroup || "").toUpperCase();
    const isBulk = packagingGroup === "BULK";

    if (isBulk && manualQtyOverride == null) {
      setTargetPackage(pkg);
      setParentShipmentId(shipmentDoc.id);
      setParentShipmentData(shipmentData);
      setPendingActionStatus(statusToApply);
      setPendingActionSource(source);
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

  const getShipmentDocByCode = async (code) => {
    const directSnap = await getDoc(doc(db, "shipments", code));

    if (directSnap.exists()) {
      return directSnap;
    }

    const trackingSnap = await getDocs(
      query(collection(db, "shipments"), where("trackingNumber", "==", code)),
    );

    if (!trackingSnap.empty) {
      return trackingSnap.docs[0];
    }

    const shipmentIdSnap = await getDocs(
      query(collection(db, "shipments"), where("shipmentId", "==", code)),
    );

    if (!shipmentIdSnap.empty) {
      return shipmentIdSnap.docs[0];
    }

    return null;
  };

  const lookupScannedCode = async (barcode) => {
    const packageQuery = query(
      collection(db, "shipments"),
      where("packageBarcodes", "array-contains", barcode),
    );

    const querySnap = await getDocs(packageQuery);

    if (!querySnap.empty) {
      const shipmentDoc = querySnap.docs[0];
      const shipmentData = shipmentDoc.data();

      const pkg = (shipmentData.packages || []).find(
        (p) => p.packageId === barcode || p.trackingNumber === barcode,
      );

      if (!pkg) {
        throw new Error("Package not found in shipment.");
      }

      return { shipmentDoc, shipmentData, pkg, scanType: "package" };
    }

    const shipmentDoc = await getShipmentDocByCode(barcode);

    if (!shipmentDoc) {
      throw new Error("Package or shipment not found.");
    }

    return {
      shipmentDoc,
      shipmentData: shipmentDoc.data(),
      pkg: null,
      scanType: "shipment",
    };
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
      const { shipmentDoc, shipmentData, pkg, scanType } =
        await lookupScannedCode(barcode);

      if (scanType === "shipment") {
        const currentTripId = setLatestScanDetails({
          shipmentDoc,
          shipmentData,
          barcode,
          source,
        });

        await fetchTripScanSummary(currentTripId);

        if (resolvedMode === "info") {
          openInfoPreview(shipmentDoc, null, barcode);
        }

        setProcessing(false);
        return;
      }

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

  const handleMarkOutForDelivery = () => {
    const targetTripId = tripSummary.tripId || resolvedTripId;

    if (!targetTripId || tripStatusUpdating) return;

    Alert.alert(
      "Mark Out for Delivery",
      "All packages are loaded. Mark this trip as out for delivery?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Mark",
          onPress: async () => {
            setTripStatusUpdating(true);

            try {
              await updateTripStatus({
                tripId: targetTripId,
                status: "OUT_FOR_DELIVERY",
              });
              await fetchTripScanSummary(targetTripId);
              Alert.alert("Trip Updated", "Trip marked as out for delivery.");
            } catch (error) {
              console.error("Trip status update failed:", error);
              Alert.alert(
                "Action Failed",
                error.message || "Failed to update trip status.",
              );
            } finally {
              setTripStatusUpdating(false);
            }
          },
        },
      ],
    );
  };

  const handleMarkCompleted = () => {
    const targetTripId = tripSummary.tripId || resolvedTripId;

    if (!targetTripId || tripStatusUpdating) return;

    Alert.alert(
      "Complete Trip",
      "All loaded packages are offloaded. Mark this trip as completed?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Complete",
          onPress: async () => {
            setTripStatusUpdating(true);

            try {
              await updateTripStatus({
                tripId: targetTripId,
                status: "COMPLETED",
              });
              await fetchTripScanSummary(targetTripId);
              Alert.alert("Trip Updated", "Trip marked as completed.");
            } catch (error) {
              console.error("Trip status update failed:", error);
              Alert.alert(
                "Action Failed",
                error.message || "Failed to update trip status.",
              );
            } finally {
              setTripStatusUpdating(false);
            }
          },
        },
      ],
    );
  };

  const modeLabel =
    resolvedMode === "offloading"
      ? "Offloading"
      : resolvedMode === "info"
        ? "Info"
        : "Loading";
  const latestTypeLabel =
    latestScan.type === "package"
      ? "Package"
      : latestScan.type === "shipment"
        ? "Shipment"
        : "Waiting";
  const progressLabel =
    resolvedMode === "offloading"
      ? "Offloaded"
      : resolvedMode === "info"
        ? "Scanned"
        : "Loaded";
  const primaryScanActions = MODE_SCAN_ACTIONS[resolvedMode] || [];
  const selectedScanAction = [
    ...primaryScanActions,
    ...ISSUE_SCAN_ACTIONS,
  ].find((action) => action.status === scanActionStatus);
  const scanActionHeading = selectedScanAction?.status
    ? "Scan will mark as"
    : "Scan mode";
  const tripStatus = String(tripSummary.status || "").toUpperCase();
  const canMarkTripOutForDelivery =
    resolvedMode === "loading" &&
    !!(tripSummary.tripId || resolvedTripId) &&
    tripSummary.totalPackages > 0 &&
    tripSummary.loadedPackages >= tripSummary.totalPackages &&
    !["OUT_FOR_DELIVERY", "COMPLETED", "CANCELLED"].includes(tripStatus);
  const canMarkTripCompleted =
    resolvedMode === "offloading" &&
    !!(tripSummary.tripId || resolvedTripId) &&
    tripSummary.totalPackages > 0 &&
    tripSummary.loadedPackages <= 0 &&
    !["COMPLETED", "CANCELLED"].includes(tripStatus);

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <View style={styles.cameraPane}>
        <CameraView
          style={styles.camera}
          facing="back"
          enableTorch={flashEnabled}
          onBarcodeScanned={scanned ? undefined : onCameraScan}
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
              onPress={() => setFlashEnabled((current) => !current)}
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
              style={[
                styles.scanFrame,
                processing && styles.scanFrameProcessing,
              ]}
            />
            <Text style={styles.scanInstruction}>Package or shipment code</Text>
          </View>
        </CameraView>
      </View>

      <ScrollView
        style={[
          styles.detailsPane,
          {
            height: detailsSheetHeight,
            backgroundColor: colors.bg,
            borderColor: colors.border,
          },
        ]}
        contentContainerStyle={styles.detailsContent}
        showsVerticalScrollIndicator={false}
        stickyHeaderIndices={[0]}
      >
        <View
          style={[styles.sheetHandleArea, { backgroundColor: colors.bg }]}
          {...detailsSheetPanResponder.panHandlers}
        >
          <View style={styles.sheetHandle} />
          <Text style={[styles.sheetHandleText, { color: colors.textMuted }]}>
            Details
          </Text>
        </View>

        <View style={styles.panelHeader}>
          <View>
            <Text style={[styles.panelEyebrow, { color: colors.textMuted }]}>
              Scanner
            </Text>
            <Text style={[styles.panelTitle, { color: colors.text }]}>
              Scan Details
            </Text>
          </View>
          <View
            style={[styles.latestBadge, { backgroundColor: colors.cardMuted }]}
          >
            <Text style={[styles.latestBadgeText, { color: colors.text }]}>
              {latestTypeLabel}
            </Text>
          </View>
        </View>

        <View
          style={[
            styles.scanDetailCard,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <DetailRow
            label="Code"
            value={latestScan.code || "No scan yet"}
            colors={colors}
          />
          {/* <DetailRow
            label="Tracking"
            value={latestScan.trackingNumber || "Waiting for barcode"}
            colors={colors}
          /> */}
          <DetailRow
            label="Shipment"
            value={latestScan.shipmentId || "Not resolved"}
            colors={colors}
          />
          <DetailRow
            label="Customer"
            value={latestScan.customerName || "Pending scan"}
            colors={colors}
          />
          <DetailRow
            label="Package Status"
            value={latestScan.packageStatus || "Pending scan"}
            colors={colors}
          />
          <DetailRow
            label="Shipment Status"
            value={latestScan.shipmentStatus || "Pending scan"}
            colors={colors}
          />
        </View>

        {!!primaryScanActions.length && (
          <View
            style={[
              styles.offloadActionCard,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <View>
              <Text
                style={[styles.offloadActionLabel, { color: colors.textMuted }]}
              >
                {scanActionHeading}
              </Text>
              <Text style={[styles.offloadActionTitle, { color: colors.text }]}>
                {selectedScanAction?.label || primaryScanActions[0]?.label}
              </Text>
            </View>

            <View style={styles.offloadToggleRow}>
              {primaryScanActions.map((action) => {
                const isActive = scanActionStatus === action.status;

                return (
                  <TouchableOpacity
                    key={action.status || action.label}
                    style={[
                      styles.offloadToggleButton,
                      isActive && {
                        backgroundColor: action.color,
                        borderColor: action.color,
                      },
                    ]}
                    onPress={() => setScanActionStatus(action.status)}
                    disabled={processing}
                    activeOpacity={0.82}
                  >
                    <FontAwesome5
                      name={action.icon}
                      size={13}
                      color={isActive ? "#ffffff" : action.color}
                    />
                    <Text
                      style={[
                        styles.offloadToggleText,
                        isActive && styles.offloadToggleTextActive,
                      ]}
                    >
                      {action.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        <View
          style={[
            styles.progressCard,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <View style={styles.progressHeader}>
            <View>
              <Text style={[styles.progressLabel, { color: colors.textMuted }]}>
                Current Trip
              </Text>
              <Text style={[styles.progressTrip, { color: colors.text }]}>
                {tripSummary.tripId || latestScan.currentTripId || "No trip"}
              </Text>
              <Text
                style={[styles.progressStatus, { color: colors.textMuted }]}
              >
                {tripSummary.status || "Status unavailable"}
              </Text>
            </View>
            {summaryLoading ? (
              <ActivityIndicator color="#2563eb" />
            ) : (
              <Text style={styles.progressPercent}>
                {tripSummary.progress}%
              </Text>
            )}
          </View>

          <View
            style={[styles.progressTrack, { backgroundColor: colors.border }]}
          >
            <View
              style={[
                styles.progressFill,
                { width: `${tripSummary.progress}%` },
              ]}
            />
          </View>

          <View style={styles.statsRow}>
            <StatCell
              label="Shipments"
              value={tripSummary.shipmentCount}
              colors={colors}
            />
            <StatCell
              label="Packages"
              value={tripSummary.totalPackages}
              colors={colors}
            />
            <StatCell
              label={progressLabel}
              value={`${tripSummary.scannedPackages}/${tripSummary.totalPackages}`}
              colors={colors}
            />
          </View>
        </View>

        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={[styles.actionButton, styles.manualButton]}
            onPress={() => setShowManual(true)}
            disabled={processing}
            activeOpacity={0.8}
          >
            <FontAwesome5 name="keyboard" size={14} color="#ffffff" />
            <Text style={styles.actionButtonText}>Manual Entry</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.actionButton,
              styles.secondaryButton,
              !scanned && !processing && styles.disabledButton,
            ]}
            onPress={resetScanner}
            disabled={!scanned && !processing}
            activeOpacity={0.8}
          >
            <FontAwesome5 name="redo" size={14} color="#2563eb" />
            <Text style={styles.secondaryButtonText}>Scan Next</Text>
          </TouchableOpacity>
        </View>

        {canMarkTripOutForDelivery && (
          <TouchableOpacity
            style={[
              styles.releaseButton,
              (processing || tripStatusUpdating) && styles.disabledButton,
            ]}
            onPress={handleMarkOutForDelivery}
            disabled={processing || tripStatusUpdating}
            activeOpacity={0.82}
          >
            {tripStatusUpdating ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <FontAwesome5 name="route" size={14} color="#ffffff" />
            )}
            <Text style={styles.releaseButtonText}>
              {tripStatusUpdating
                ? "Updating Trip..."
                : "Mark Out for Delivery"}
            </Text>
          </TouchableOpacity>
        )}

        {canMarkTripCompleted && (
          <TouchableOpacity
            style={[
              styles.completeButton,
              (processing || tripStatusUpdating) && styles.disabledButton,
            ]}
            onPress={handleMarkCompleted}
            disabled={processing || tripStatusUpdating}
            activeOpacity={0.82}
          >
            {tripStatusUpdating ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <FontAwesome5 name="flag-checkered" size={14} color="#ffffff" />
            )}
            <Text style={styles.releaseButtonText}>
              {tripStatusUpdating ? "Updating Trip..." : "Mark Completed"}
            </Text>
          </TouchableOpacity>
        )}

        {!!primaryScanActions.length && (
          <View style={styles.issueActionsRow}>
            {ISSUE_SCAN_ACTIONS.map((action) => {
              const isActive = scanActionStatus === action.status;

              return (
                <TouchableOpacity
                  key={action.status}
                  style={[
                    styles.issueButton,
                    { borderColor: action.color },
                    isActive && { backgroundColor: action.color },
                  ]}
                  onPress={() => setScanActionStatus(action.status)}
                  disabled={processing}
                  activeOpacity={0.82}
                >
                  <FontAwesome5
                    name={action.icon}
                    size={13}
                    color={isActive ? "#ffffff" : action.color}
                  />
                  <Text
                    style={[
                      styles.issueButtonText,
                      { color: action.color },
                      isActive && styles.issueButtonTextActive,
                    ]}
                  >
                    {action.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {!!latestScan.shipmentId && (
          <TouchableOpacity
            style={[
              styles.detailsButton,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
            onPress={() =>
              router.push({
                pathname: "/(checker)/shipment-details",
                params: {
                  shipmentId: latestScan.shipmentId,
                  parentTripId:
                    latestScan.currentTripId ||
                    tripSummary.tripId ||
                    resolvedTripId,
                },
              })
            }
            activeOpacity={0.8}
          >
            <Text style={[styles.detailsButtonText, { color: colors.text }]}>
              View Shipment Details
            </Text>
            <FontAwesome5 name="chevron-right" size={12} color={colors.text} />
          </TouchableOpacity>
        )}
      </ScrollView>

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
            source: pendingActionSource,
            shipmentDocData: parentShipmentData,
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
        mode={resolvedMode}
        actionLabel={selectedScanAction?.label}
      />

      <ShipmentInfoModal
        visible={infoModalVisible}
        data={scannedData}
        onClose={resetScanner}
        onDetails={() => {
          setInfoModalVisible(false);
          router.push({
            pathname: "/(checker)/shipment-details",
            params: {
              shipmentId: scannedData.id,
              parentTripId: resolvedTripId,
            },
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

const DetailRow = ({ label, value, colors }) => (
  <View style={[styles.detailRow, { borderBottomColor: colors.border }]}>
    <Text style={[styles.detailLabel, { color: colors.textMuted }]}>
      {label}
    </Text>
    <Text
      style={[styles.detailValue, { color: colors.text }]}
      numberOfLines={1}
    >
      {value}
    </Text>
  </View>
);

const StatCell = ({ label, value, colors }) => (
  <View
    style={[
      styles.statCell,
      { backgroundColor: colors.cardMuted, borderColor: colors.border },
    ]}
  >
    <Text style={[styles.statValue, { color: colors.text }]}>{value}</Text>
    <Text style={[styles.statLabel, { color: colors.textMuted }]}>{label}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },
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
  detailsPane: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "#f8fafc",
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderTopWidth: 1,
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.14,
    shadowRadius: 14,
    elevation: 12,
  },
  detailsContent: {
    padding: 16,
    paddingBottom: 28,
    gap: 12,
  },
  sheetHandleArea: {
    alignItems: "center",
    paddingTop: 2,
    paddingBottom: 6,
  },
  sheetHandle: {
    width: 46,
    height: 5,
    borderRadius: 999,
    backgroundColor: "#94a3b8",
  },
  sheetHandleText: {
    marginTop: 6,
    color: "#64748b",
    fontSize: 10,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  panelHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  panelEyebrow: {
    fontSize: 11,
    fontWeight: "800",
    color: "#64748b",
    textTransform: "uppercase",
  },
  panelTitle: {
    marginTop: 2,
    fontSize: 20,
    fontWeight: "900",
    color: "#0f172a",
  },
  latestBadge: {
    backgroundColor: "#eff6ff",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  latestBadgeText: {
    color: "#2563eb",
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  scanDetailCard: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    padding: 14,
    gap: 10,
  },
  offloadActionCard: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    padding: 14,
    gap: 12,
  },
  offloadActionLabel: {
    color: "#64748b",
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  offloadActionTitle: {
    marginTop: 3,
    color: "#0f172a",
    fontSize: 16,
    fontWeight: "900",
  },
  offloadToggleRow: {
    flexDirection: "row",
    gap: 10,
  },
  offloadToggleButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    backgroundColor: "#f8fafc",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 10,
  },
  offloadToggleText: {
    color: "#334155",
    fontSize: 12,
    fontWeight: "800",
  },
  offloadToggleTextActive: {
    color: "#ffffff",
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  detailLabel: {
    color: "#64748b",
    fontSize: 12,
    fontWeight: "700",
  },
  detailValue: {
    flex: 1,
    textAlign: "right",
    color: "#0f172a",
    fontSize: 12,
    fontWeight: "800",
  },
  progressCard: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    padding: 14,
  },
  progressHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  progressLabel: {
    color: "#64748b",
    fontSize: 12,
    fontWeight: "700",
  },
  progressTrip: {
    marginTop: 2,
    color: "#0f172a",
    fontSize: 15,
    fontWeight: "900",
  },
  progressStatus: {
    marginTop: 2,
    color: "#64748b",
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  progressPercent: {
    color: "#2563eb",
    fontSize: 18,
    fontWeight: "900",
  },
  progressTrack: {
    height: 10,
    borderRadius: 999,
    backgroundColor: "#e2e8f0",
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: "#2563eb",
  },
  statsRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 12,
  },
  statCell: {
    flex: 1,
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 8,
    alignItems: "center",
  },
  statValue: {
    color: "#0f172a",
    fontSize: 15,
    fontWeight: "900",
  },
  statLabel: {
    marginTop: 3,
    color: "#64748b",
    fontSize: 10,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  actionsRow: {
    flexDirection: "row",
    gap: 10,
  },
  issueActionsRow: {
    flexDirection: "row",
    gap: 10,
  },
  actionButton: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  manualButton: {
    backgroundColor: "#2563eb",
  },
  actionButtonText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "800",
  },
  secondaryButton: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#bfdbfe",
  },
  disabledButton: {
    opacity: 0.55,
  },
  secondaryButtonText: {
    color: "#2563eb",
    fontSize: 13,
    fontWeight: "800",
  },
  releaseButton: {
    minHeight: 48,
    borderRadius: 14,
    backgroundColor: "#0f766e",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 14,
  },
  releaseButtonText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "800",
  },
  completeButton: {
    minHeight: 48,
    borderRadius: 14,
    backgroundColor: "#16a34a",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 14,
  },
  issueButton: {
    flex: 1,
    minHeight: 46,
    borderRadius: 14,
    borderWidth: 1,
    backgroundColor: "#ffffff",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 10,
  },
  issueButtonText: {
    fontSize: 12,
    fontWeight: "800",
  },
  issueButtonTextActive: {
    color: "#ffffff",
  },
  detailsButton: {
    height: 46,
    borderRadius: 14,
    backgroundColor: "#e2e8f0",
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  detailsButtonText: {
    color: "#0f172a",
    fontSize: 13,
    fontWeight: "800",
  },

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
