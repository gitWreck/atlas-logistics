"use client";
import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Alert,
  Vibration,
  StyleSheet,
  PanResponder,
  Animated,
} from "react-native";
import { useCameraPermissions } from "expo-camera";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  collection,
  getDocs,
  doc,
  getDoc,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "../../firebase";

import PermissionRequest from "../../components/scanner/PermissionRequest";
import ManualEntryModal from "../../components/scanner/ManualEntryModal";
import DeliveryProofModal from "../../components/scanner/DeliveryProofModal";
import BatchDeliverySummaryModal from "../../components/scanner/BatchDeliverySummaryModal";
import FailedDeliveryReasonModal from "../../components/scanner/FailedDeliveryReasonModal";
import ScanSuccessModal from "../../components/scanner/ScanSuccessModal";
import ScannerCameraPane from "../../components/scanner/ScannerCameraPane";
import ScanDetailsSheet from "../../components/scanner/ScanDetailsSheet";
import PackageActionModal from "../../components/checker/shipment-details/PackageActionModal";
import ShipmentInfoModal from "../../components/checker/shipment-details/ShipmentInfoModal";
import {
  updateShipmentImages,
  updateShipmentPackages,
  updateTripStatus,
  updateShipmentStatus,
} from "../../components/utilities/FirebaseFunctions";
import {
  assertCheckerCanAccessShipment,
  completeCheckerDelivery,
  getCallableErrorMessage,
  loadAssignedShipmentsToVehicle,
  markShipmentOutForDelivery,
  reportCheckerFailedDelivery,
  returnCheckerShipmentsToWarehouse,
} from "../../components/utilities/checkerDelivery";
import {
  isCheckerCustodyPiece,
  isCheckerPieceAwaitingOutForDelivery,
  isCheckerPieceAvailableToLoad,
} from "../../components/utilities/checkerDeliveryPool";
import {
  getCurrentLocationSafe,
  updatedBy,
} from "../../components/utilities/helpers";
import {
  buildTripBarcodeIndex,
  createScanLookupCache,
  getShipmentDocByCode,
  lookupScannedShipment,
} from "../../components/utilities/scanLookup";
import {
  buildShipmentMapBarcodeIndex,
  lookupScannedShipmentOffline,
} from "../../components/utilities/offlineScanLookup";
import {
  appendBatchDeliveryPiece,
  assertPieceEligibleForBatchScan,
  getBatchPieceLabel,
  getBatchScanCompleteLabel,
  getBatchScanSummaryEyebrow,
  isBatchDeliveryScanMode,
  isBatchScanMode,
} from "../../components/utilities/batchDelivery";
import { getFailureReasonLabel } from "../../components/constants/failureReasons";
import {
  buildLatestScanDetails,
  canApplyOffloadCompletion,
  clampSheetHeight,
  DEFAULT_DETAILS_SHEET_HEIGHT,
  isIssueStatus,
  getLatestTypeLabel,
  getModeLabel,
  getProgressLabel,
  getShipmentDeliveredCount,
  getShipmentLoadedCount,
  findPackageInShipment,
  getDeliverPackageIdForScan,
  getPackageIdentity,
  getShipmentPackageIds,
  getShipmentScannedCount,
  getShipmentTotal,
  normalizeProofImages,
  normalizeScanCode,
  resolveDeliveryPackageIds,
  resolveOffloadDeliverPackageIds,
} from "../../components/utilities/scanner";
import {
  DELIVERY_PROOF_MAX_IMAGES,
  DELIVERY_PROOF_MIN_IMAGES,
  EMPTY_SCAN_DETAILS,
  EMPTY_SHIPMENT_SUMMARY,
  EMPTY_TRIP_SUMMARY,
  getDefaultScanStatus,
  getPrimaryScanActions,
  isCheckerLastMileScanMode,
  ISSUE_SCAN_ACTIONS,
  SUCCESS_MODAL_SECONDS,
} from "../../components/constants/scanner";
import { useAuth } from "../../contexts/AuthContext";
import { useCheckerLastMile } from "../../contexts/CheckerLastMileContext";
import { useOfflineSync } from "../../contexts/OfflineSyncContext";
import { useTheme } from "../../contexts/ThemeContext";

/** Off by default — SMS/email on every scan slows the backend noticeably. */
const DEFAULT_NOTIFICATION_CHANNELS = {
  sms: false,
  email: false,
  push: false,
};

const NOTIFICATION_CHANNEL_OPTIONS = [
  { key: "sms", label: "SMS", icon: "comment-dots" },
  { key: "email", label: "Email", icon: "envelope" },
  { key: "push", label: "Push", icon: "bell" },
];

export default function ScannerScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { profile } = useAuth();
  const { isOnline, enqueueOfflineOperation, effectiveShipmentsById, warmShipmentCache } =
    useOfflineSync();
  const { shipmentsById: routeShipments } = useCheckerLastMile();
  const [permission, requestPermission] = useCameraPermissions();

  const [scanned, setScanned] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [flashEnabled, setFlashEnabled] = useState(false);
  const [showManual, setShowManual] = useState(false);

  const [actionModalVisible, setActionModalVisible] = useState(false);
  const [targetPackage, setTargetPackage] = useState(null);
  const [parentShipmentId, setParentShipmentId] = useState(null);
  const [parentShipmentData, setParentShipmentData] = useState(null);
  const [pendingPackageIds, setPendingPackageIds] = useState([]);
  const [pendingActionStatus, setPendingActionStatus] = useState(null);
  const [pendingActionSource, setPendingActionSource] = useState("scan");
  const [pendingActionRemarks, setPendingActionRemarks] = useState("");

  const [infoModalVisible, setInfoModalVisible] = useState(false);
  const [scannedData, setScannedData] = useState(null);

  const [successModalVisible, setSuccessModalVisible] = useState(false);
  const [successPayload, setSuccessPayload] = useState(null);
  const [countdown, setCountdown] = useState(SUCCESS_MODAL_SECONDS);
  const [deliveryProofVisible, setDeliveryProofVisible] = useState(false);
  const [deliveryProofPhotos, setDeliveryProofPhotos] = useState([]);
  const [deliveryProofRemarks, setDeliveryProofRemarks] = useState("");
  const [deliveryProofUploading, setDeliveryProofUploading] = useState(false);
  const [pendingDelivery, setPendingDelivery] = useState(null);
  const [batchDeliverySession, setBatchDeliverySession] = useState(null);
  const [batchSummaryVisible, setBatchSummaryVisible] = useState(false);
  const [failedReasonVisible, setFailedReasonVisible] = useState(false);
  const [failedProofPhotos, setFailedProofPhotos] = useState([]);
  const [failedProofUploading, setFailedProofUploading] = useState(false);
  const autoOpenPodCameraRef = useRef(false);
  const pickDeliveryProofImageRef = useRef(async () => {});
  const [tripSummary, setTripSummary] = useState(EMPTY_TRIP_SUMMARY);
  const [shipmentSummary, setShipmentSummary] = useState(
    EMPTY_SHIPMENT_SUMMARY,
  );
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [tripStatusUpdating, setTripStatusUpdating] = useState(false);
  const [latestScan, setLatestScan] = useState(EMPTY_SCAN_DETAILS);
  const [scanActionStatus, setScanActionStatus] = useState(null);
  const [notificationChannels, setNotificationChannels] = useState(
    DEFAULT_NOTIFICATION_CHANNELS,
  );
  const successTimerRef = useRef(null);
  const countdownTimerRef = useRef(null);
  const scanLookupCacheRef = useRef(createScanLookupCache());
  const tripBarcodeIndexRef = useRef(new Map());
  const cachedLocationRef = useRef(null);
  const summaryRefreshTimerRef = useRef(null);
  const lastScanRef = useRef({ code: "", at: 0 });
  const detailsSheetHeight = useRef(
    new Animated.Value(DEFAULT_DETAILS_SHEET_HEIGHT),
  ).current;
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
        detailsSheetHeight.setValue(nextHeight);
      },
      onPanResponderRelease: (_, gestureState) => {
        const nextHeight = clampSheetHeight(
          dragStartHeightRef.current - gestureState.dy,
        );
        detailsSheetHeightRef.current = nextHeight;
        Animated.spring(detailsSheetHeight, {
          toValue: nextHeight,
          useNativeDriver: false,
          tension: 120,
          friction: 18,
        }).start();
      },
    }),
  ).current;

  const { mode, tripId, presetScanStatus, focusShipmentId } =
    useLocalSearchParams();
  const resolvedMode = Array.isArray(mode) ? mode[0] : mode;
  const resolvedTripId = Array.isArray(tripId) ? tripId[0] : tripId;

  const scheduleTripSummaryRefresh = (targetTripId = resolvedTripId) => {
    if (!targetTripId) return;
    if (summaryRefreshTimerRef.current) {
      clearTimeout(summaryRefreshTimerRef.current);
    }
    summaryRefreshTimerRef.current = setTimeout(() => {
      summaryRefreshTimerRef.current = null;
      void fetchTripScanSummary(targetTripId, { showLoading: false });
    }, 800);
  };

  const fetchTripScanSummary = async (
    targetTripId = resolvedTripId,
    { showLoading = true } = {},
  ) => {
    if (!targetTripId) {
      setTripSummary(EMPTY_TRIP_SUMMARY);
      tripBarcodeIndexRef.current = new Map();
      return EMPTY_TRIP_SUMMARY;
    }

    if (showLoading) {
      setSummaryLoading(true);
    }

    try {
      const [tripSnap, shipmentSnap] = await Promise.all([
        getDoc(doc(db, "truck_trips", String(targetTripId))),
        getDocs(
          collection(db, "truck_trips", String(targetTripId), "trip_shipments"),
        ),
      ]);

      const shipmentIds = shipmentSnap.docs.map((shipmentDoc) => shipmentDoc.id);
      const shipmentDocs = shipmentIds.length
        ? await Promise.all(
            shipmentIds.map((shipmentId) =>
              getDoc(doc(db, "shipments", String(shipmentId))),
            ),
          )
        : [];
      tripBarcodeIndexRef.current = buildTripBarcodeIndex(
        shipmentDocs.filter((shipmentDoc) => shipmentDoc.exists()),
      );

      const shipments = shipmentSnap.docs.map((shipmentDoc) => ({
        id: shipmentDoc.id,
        ...shipmentDoc.data(),
      }));

      const totalPackages = shipments.reduce(
        (sum, shipment) => sum + getShipmentTotal(shipment),
        0,
      );
      const scannedPackages = shipments.reduce(
        (sum, shipment) =>
          sum + getShipmentScannedCount(shipment, resolvedMode),
        0,
      );
      const loadedPackages = shipments.reduce(
        (sum, shipment) => sum + getShipmentLoadedCount(shipment),
        0,
      );
      const deliveredPackages = shipments.reduce(
        (sum, shipment) => sum + getShipmentDeliveredCount(shipment),
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
        deliveredPackages,
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

  const buildShipmentScanSummary = (shipmentDoc, shipmentData, modeValue) => {
    const totalPackages = getShipmentTotal(shipmentData);
    const loadedPackages = getShipmentLoadedCount(shipmentData);
    const deliveredPackages = getShipmentDeliveredCount(shipmentData);
    const baseScannedPackages = getShipmentScannedCount(
      shipmentData,
      modeValue,
    );
    const scannedPackages =
      modeValue === "offloading"
        ? Math.max(baseScannedPackages, loadedPackages)
        : baseScannedPackages;
    const progress =
      totalPackages > 0
        ? Math.round((scannedPackages / totalPackages) * 100)
        : 0;

    return {
      shipmentId:
        shipmentData?.shipmentId ||
        shipmentData?.trackingNumber ||
        shipmentDoc?.id ||
        "",
      status: shipmentData?.status || "",
      shipmentCount: 1,
      totalPackages,
      scannedPackages,
      loadedPackages,
      deliveredPackages,
      progress,
    };
  };

  const refreshShipmentScanSummary = async (shipmentId) => {
    if (!shipmentId) return EMPTY_SHIPMENT_SUMMARY;

    const shipmentSnap = await getDoc(doc(db, "shipments", String(shipmentId)));
    if (!shipmentSnap.exists()) return EMPTY_SHIPMENT_SUMMARY;

    const summary = buildShipmentScanSummary(
      { id: shipmentSnap.id },
      shipmentSnap.data(),
      resolvedMode,
    );
    setShipmentSummary(summary);
    return summary;
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

  const getEffectiveTripId = (shipmentData) => {
    if (resolvedTripId) return resolvedTripId;
    const data = shipmentData ?? {};
    return data.currentTripId || data.currentTruckTripId || data.tripId || "";
  };

  const getActionErrorMessage = (error, fallback) => {
    const code = String(error?.code || "");
    const message = String(error?.message || "").trim();
    const details = error?.details;

    if (code.includes("not-found")) {
      if (/trip shipment record/i.test(message)) {
        return "This shipment is not linked to the current trip manifest. Re-open the trip and scan again.";
      }
      if (/trip not found/i.test(message)) {
        return "The selected trip was not found. Go back and open the trip again.";
      }
      if (/shipment not found/i.test(message)) {
        return "Shipment not found. Check the QR code and try again.";
      }
      if (!message || message === "not-found") {
        return "The shipment or trip record could not be found. Re-open the trip from the trip list and try again.";
      }
      return message;
    }

    if (code.includes("failed-precondition") && message) {
      return message;
    }

    if (typeof details === "string" && details.trim()) {
      return details.trim();
    }

    return message || fallback;
  };

  const assertShipmentOnTrip = async (shipmentDocId, shipmentData) => {
    if (!resolvedTripId) return;

    const onCurrentTrip =
      String(shipmentData?.currentTripId || "") === String(resolvedTripId);

    if (onCurrentTrip) return;

    const tripShipmentSnap = await getDoc(
      doc(
        db,
        "truck_trips",
        String(resolvedTripId),
        "trip_shipments",
        shipmentDocId,
      ),
    );

    if (!tripShipmentSnap.exists()) {
      throw new Error(
        "This shipment is not on the current trip manifest. Open the correct trip before scanning.",
      );
    }
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

    setLatestScan(
      buildLatestScanDetails({
        shipmentDoc,
        shipmentData,
        pkg,
        barcode,
        currentTripId,
        source,
        appliedStatus,
      }),
    );
    setShipmentSummary(
      buildShipmentScanSummary(shipmentDoc, shipmentData, resolvedMode),
    );

    return currentTripId;
  };

  const getCheckerWarehouseName = () => {
    const warehouseName = String(profile?.warehouseName || "").trim();
    const warehouseCode = String(profile?.warehouseCode || "")
      .trim()
      .toUpperCase();

    if (warehouseName) return warehouseName;
    if (warehouseCode === "DIV") return "Divisoria";
    if (warehouseCode === "ODI") return "Odiongan";

    return "warehouse";
  };

  const getIssueDefaultRemarks = (status) => {
    const statusLabel =
      status === "DAMAGED"
        ? "Marked damaged"
        : status === "MISSING"
          ? "Marked missing"
          : "Issue noted";

    return `Returned to warehouse ${getCheckerWarehouseName()}. ${statusLabel}.`;
  };

  useEffect(() => {
    return () => {
      clearSuccessTimers();
      if (summaryRefreshTimerRef.current) {
        clearTimeout(summaryRefreshTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    void getCurrentLocationSafe().then((location) => {
      if (location) {
        cachedLocationRef.current = location;
      }
    });
  }, []);

  useEffect(() => {
    if (!isOnline || Object.keys(routeShipments).length === 0) return;
    void warmShipmentCache(routeShipments);
  }, [isOnline, routeShipments, warmShipmentCache]);

  useEffect(() => {
    fetchTripScanSummary(resolvedTripId);
  }, [resolvedTripId, resolvedMode]);

  useEffect(() => {
    if (presetScanStatus) {
      setScanActionStatus(String(presetScanStatus));
      return;
    }
    setScanActionStatus(
      getDefaultScanStatus(resolvedMode, { tripId: resolvedTripId }),
    );
  }, [resolvedMode, presetScanStatus, resolvedTripId]);

  const clearSuccessTimers = () => {
    if (successTimerRef.current) clearTimeout(successTimerRef.current);
    if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    successTimerRef.current = null;
    countdownTimerRef.current = null;
  };

  const clearBatchDeliverySession = () => {
    setBatchDeliverySession(null);
    setBatchSummaryVisible(false);
  };

  useEffect(() => {
    if (!isBatchScanMode(resolvedMode, scanActionStatus)) {
      clearBatchDeliverySession();
      setFailedReasonVisible(false);
      setFailedProofPhotos([]);
    }
  }, [resolvedMode, scanActionStatus]);

  useEffect(() => {
    if (
      !deliveryProofVisible ||
      !autoOpenPodCameraRef.current ||
      deliveryProofPhotos.length > 0
    ) {
      return;
    }

    autoOpenPodCameraRef.current = false;
    void pickDeliveryProofImageRef.current(true);
  }, [deliveryProofVisible, deliveryProofPhotos.length]);

  const resetScanner = () => {
    setScanned(false);
    setProcessing(false);
    setTargetPackage(null);
    setParentShipmentId(null);
    setParentShipmentData(null);
    setPendingPackageIds([]);
    setPendingActionStatus(null);
    setPendingActionSource("scan");
    setPendingActionRemarks("");
    setActionModalVisible(false);
    setInfoModalVisible(false);
    setScannedData(null);
    setShipmentSummary(EMPTY_SHIPMENT_SUMMARY);
    clearBatchDeliverySession();
  };

  const toggleNotificationChannel = (key) => {
    setNotificationChannels((current) => ({
      ...current,
      [key]: current[key] !== true,
    }));
  };

  const resetDeliveryProof = () => {
    setDeliveryProofVisible(false);
    setDeliveryProofPhotos([]);
    setDeliveryProofRemarks("");
    setDeliveryProofUploading(false);
    setPendingDelivery(null);
    clearBatchDeliverySession();
  };

  const cancelDeliveryProof = () => {
    const delivery = pendingDelivery;
    setDeliveryProofVisible(false);
    setDeliveryProofPhotos([]);
    setDeliveryProofRemarks("");
    setDeliveryProofUploading(false);
    setPendingDelivery(null);

    if (delivery?.batchPieces?.length) {
      const shipmentData = delivery.shipmentDocData || {};
      setBatchDeliverySession({
        shipmentId: delivery.shipmentId,
        shipmentDocData: shipmentData,
        tripId: delivery.tripId || null,
        customerName:
          shipmentData.recipient?.name ||
          shipmentData.customerName ||
          "Customer",
        shipmentLabel:
          shipmentData.shipmentId ||
          shipmentData.trackingNumber ||
          delivery.shipmentId,
        pieces: delivery.batchPieces,
      });
      setBatchSummaryVisible(true);
      setScanned(false);
      setProcessing(false);
      return;
    }

    resetScanner();
  };

  const closeSuccessModal = () => {
    clearSuccessTimers();
    setSuccessModalVisible(false);
    setSuccessPayload(null);
    resetDeliveryProof();
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
    pendingSync = false,
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
      pendingSync,
    });

    setCountdown(SUCCESS_MODAL_SECONDS);
    setSuccessModalVisible(true);
    setProcessing(false);
    setScanned(false);

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
      return scanActionStatus || "DELIVERED";
    }
    if (resolvedMode === "delivery") {
      return scanActionStatus || null;
    }
    return null;
  };

  const isCheckerLastMileScan = isCheckerLastMileScanMode(resolvedMode, {
    tripId: resolvedTripId,
  });
  const isBatchDeliveryScan = isBatchDeliveryScanMode(
    resolvedMode,
    scanActionStatus,
  );
  const isBatchScan = isBatchScanMode(resolvedMode, scanActionStatus);
  const batchScanAction = String(
    batchDeliverySession?.scanActionStatus || scanActionStatus || "",
  ).toUpperCase();

  const executeStatusUpdate = async ({
    shipmentId,
    barcode,
    status,
    qty = null,
    remarks = "",
    source = "scan",
    shipmentDocData = null,
    proofImages = null,
    completeShipment = false,
    throwOnError = false,
    packageIds = null,
    location: locationOverride = null,
  }) => {
    try {
      let location = locationOverride ?? cachedLocationRef.current;
      if (!location) {
        location = await getCurrentLocationSafe();
        if (location) {
          cachedLocationRef.current = location;
        }
      }
      const effectiveTripId = getEffectiveTripId(shipmentDocData);

      if (status === "LOAD_TO_VEHICLE") {
        assertCheckerCanAccessShipment(shipmentDocData, profile?.uid);

        const loadPackageIds =
          Array.isArray(packageIds) && packageIds.length > 0
            ? packageIds
            : [getDeliverPackageIdForScan(shipmentDocData, barcode)].filter(
                Boolean,
              );

        if (loadPackageIds.length === 0) {
          throw new Error(
            "Scan an individual piece label to load. Master tracking alone cannot load pieces.",
          );
        }

        const matchedPkg = findPackageInShipment(shipmentDocData, barcode);
        const pieceStatus = String(matchedPkg?.status || "").toUpperCase();

        if (
          matchedPkg &&
          pieceStatus === "OUT_FOR_DELIVERY" &&
          isCheckerCustodyPiece(matchedPkg, profile?.uid)
        ) {
          showSuccessModal({
            barcode,
            shipmentId,
            shipmentStatus: "OUT_FOR_DELIVERY",
            packageStatus: "OUT_FOR_DELIVERY",
            quantity: qty,
            message: "Piece is already out for delivery on your van.",
            source,
          });
          return;
        }

        if (
          matchedPkg &&
          isCheckerPieceAwaitingOutForDelivery(matchedPkg, profile?.uid)
        ) {
          await markShipmentOutForDelivery({
            shipmentId,
            profile,
            tripId: effectiveTripId || null,
            remarks:
              remarks ||
              "Marked out for delivery via scan (legacy loaded piece).",
          });

          showSuccessModal({
            barcode,
            shipmentId,
            shipmentStatus: "OUT_FOR_DELIVERY",
            packageStatus: "OUT_FOR_DELIVERY",
            quantity: qty,
            message: "Piece marked out for delivery.",
            source,
          });
          return;
        }

        if (
          matchedPkg &&
          !isCheckerPieceAvailableToLoad(matchedPkg, shipmentDocData)
        ) {
          throw new Error(
            "This piece is not released for delivery or is not available to load.",
          );
        }

        if (!isOnline && isCheckerLastMileScan) {
          await enqueueOfflineOperation({
            type: "LOAD_TO_VEHICLE",
            shipmentId,
            barcode,
            packageIds: loadPackageIds,
            remarks:
              remarks || "Loaded and marked out for delivery via checker scan.",
            location,
            shipmentSnapshot: shipmentDocData,
            notificationChannels,
          });
          showSuccessModal({
            barcode,
            shipmentId,
            shipmentStatus: "OUT_FOR_DELIVERY",
            packageStatus: "OUT_FOR_DELIVERY",
            quantity: qty,
            message:
              "Piece saved locally and marked out for delivery. Pending sync.",
            source,
            pendingSync: true,
          });
          return;
        }

        await loadAssignedShipmentsToVehicle({
          shipmentIds: [shipmentId],
          packageIds: loadPackageIds,
          profile,
          remarks:
            remarks || "Loaded and marked out for delivery via checker scan.",
        });

        showSuccessModal({
          barcode,
          shipmentId,
          shipmentStatus: "OUT_FOR_DELIVERY",
          packageStatus: "OUT_FOR_DELIVERY",
          quantity: qty,
          message:
            "Piece loaded to your van and marked out for delivery.",
          source,
        });
        return;
      }

      const deliveryPieceIds =
        Array.isArray(packageIds) && packageIds.length > 0
          ? packageIds
          : [getDeliverPackageIdForScan(shipmentDocData, barcode)].filter(Boolean);

      if (isCheckerLastMileScan && status === "FAILED_DELIVERY") {
        assertCheckerCanAccessShipment(shipmentDocData, profile?.uid);
        if (deliveryPieceIds.length === 0) {
          throw new Error("Scan an individual piece label to report failed delivery.");
        }
        if (!isOnline && isCheckerLastMileScan) {
          await enqueueOfflineOperation({
            type: "FAILED_DELIVERY",
            shipmentId,
            barcode,
            packageIds: deliveryPieceIds,
            remarks: remarks || "Failed delivery reported via scan.",
            location,
            reasonCode: "DELIVERY_FAILED",
            shipmentSnapshot: shipmentDocData,
            notificationChannels,
          });
          showSuccessModal({
            barcode,
            shipmentId,
            shipmentStatus: shipmentDocData?.status || "FAILED_DELIVERY",
            packageStatus: status,
            quantity: qty,
            message: "Failed delivery saved locally. Pending sync.",
            source,
            pendingSync: true,
          });
          return;
        }
        await reportCheckerFailedDelivery({
          shipmentIds: [shipmentId],
          packageIds: deliveryPieceIds,
          profile,
          reasonCode: "DELIVERY_FAILED",
          remarks: remarks || "Failed delivery reported via scan.",
        });
        showSuccessModal({
          barcode,
          shipmentId,
          shipmentStatus: shipmentDocData?.status || "FAILED_DELIVERY",
          packageStatus: status,
          quantity: qty,
          message: "Piece marked as failed delivery.",
          source,
        });
        return;
      }

      if (resolvedMode === "offloading" && status === "RETURNED_TO_WAREHOUSE") {
        assertCheckerCanAccessShipment(shipmentDocData, profile?.uid);
        if (deliveryPieceIds.length === 0) {
          throw new Error("Scan an individual piece label to return to warehouse.");
        }
        if (!isOnline && isCheckerLastMileScan) {
          await enqueueOfflineOperation({
            type: "RETURNED_TO_WAREHOUSE",
            shipmentId,
            barcode,
            packageIds: deliveryPieceIds,
            remarks: remarks || "Returned to Odiongan warehouse via scan.",
            location,
            shipmentSnapshot: shipmentDocData,
            notificationChannels,
          });
          showSuccessModal({
            barcode,
            shipmentId,
            shipmentStatus: "RETURNED_TO_WAREHOUSE",
            packageStatus: status,
            quantity: qty,
            message: "Return saved locally. Pending sync.",
            source,
            pendingSync: true,
          });
          return;
        }
        await returnCheckerShipmentsToWarehouse({
          shipmentIds: [shipmentId],
          packageIds: deliveryPieceIds,
          profile,
          remarks: remarks || "Returned to Odiongan warehouse via scan.",
        });
        showSuccessModal({
          barcode,
          shipmentId,
          shipmentStatus: "RETURNED_TO_WAREHOUSE",
          packageStatus: status,
          quantity: qty,
          message: "Piece returned to Odiongan warehouse.",
          source,
        });
        return;
      }

      let shouldCompleteShipment = completeShipment;
      let effectivePackageIds = packageIds;

      if (resolvedMode === "offloading" && status === "DELIVERED") {
        shouldCompleteShipment = false;
        const offloadScope = resolveOffloadDeliverPackageIds(
          shipmentDocData,
          barcode,
          "package",
        );
        effectivePackageIds = offloadScope.packageIds;
      } else if (shouldCompleteShipment) {
        const scopedDelivery = resolveDeliveryPackageIds({
          barcode,
          scanType: "package",
          shipmentData: shipmentDocData,
        });
        if (scopedDelivery.isPackageLevel) {
          shouldCompleteShipment = false;
          effectivePackageIds = scopedDelivery.packageIds;
        }
      }

      if (shouldCompleteShipment) {
        await updateShipmentStatus({
          shipmentId,
          tripId: effectiveTripId,
          newStatus: "COMPLETED",
          location,
          remarks,
          proofOfDelivery: proofImages,
          sourceUI: "CHECKER_MOBILE",
          notify: Object.values(notificationChannels).some(Boolean),
          notificationChannels,
          notifySms: notificationChannels.sms,
          notifyEmail: notificationChannels.email,
          notifyPush: notificationChannels.push,
          updatedBy: updatedBy(profile),
        });
      } else {
        const targetPackageIds =
          Array.isArray(effectivePackageIds) && effectivePackageIds.length > 0
            ? effectivePackageIds
            : [getDeliverPackageIdForScan(shipmentDocData, barcode)];

        await updateShipmentPackages({
          shipmentId,
          packageIds: targetPackageIds,
          newStatus: status,
          location,
          tripId: effectiveTripId,
          manualQty: qty,
          remarks,
          scanAction: resolvedMode,
          notify: Object.values(notificationChannels).some(Boolean),
          notificationChannels,
          notifySms: notificationChannels.sms,
          notifyEmail: notificationChannels.email,
          notifyPush: notificationChannels.push,
          updatedBy: updatedBy(profile),
        });

        if (Array.isArray(proofImages) && proofImages.length > 0) {
          await updateShipmentImages({
            shipmentId,
            type: "delivery",
            images: proofImages,
            updatedBy: updatedBy(profile),
          });
        }
      }

      if (effectiveTripId) {
        scheduleTripSummaryRefresh(effectiveTripId);
      } else if (shipmentDocData) {
        void refreshShipmentScanSummary(shipmentId);
      }

      showSuccessModal({
        barcode,
        shipmentId,
        shipmentStatus: shouldCompleteShipment
          ? "COMPLETED"
          : shipmentDocData?.status || "",
        packageStatus: status,
        quantity: qty,
        message:
          shouldCompleteShipment
            ? "Shipment completed with proof of delivery."
            : source === "manual"
              ? "Manual entry processed successfully."
              : "Scan processed successfully.",
        source,
      });
    } catch (error) {
      console.error("Package update failed:", error?.code, error?.message, error);
      Alert.alert(
        "Action Failed",
        isCheckerLastMileScan
          ? getCallableErrorMessage(error, "Failed to update package.")
          : getActionErrorMessage(error, "Failed to update package."),
        [{ text: "Retry", onPress: resetScanner }],
      );
      setProcessing(false);
      if (throwOnError) throw error;
    }
  };

  const uploadDeliveryProofPhotos = async (shipmentId, photos) => {
    const urls = [];

    for (let i = 0; i < photos.length; i += 1) {
      const uri = photos[i];
      const filename = `proof_${shipmentId}_${Date.now()}_${i}.jpg`;
      const storageRef = ref(storage, `shipments/${shipmentId}/${filename}`);
      const response = await fetch(uri);
      const blob = await response.blob();

      await uploadBytes(storageRef, blob);
      urls.push(await getDownloadURL(storageRef));
    }

    return urls;
  };

  const openDeliveryProofModal = (delivery) => {
    clearSuccessTimers();
    setSuccessModalVisible(false);
    setSuccessPayload(null);
    setPendingDelivery({
      ...delivery,
      existingProofs: normalizeProofImages(
        delivery.shipmentDocData?.proofOfDelivery,
      ),
    });
    setDeliveryProofPhotos([]);
    setDeliveryProofRemarks(delivery.remarks || "");
    setDeliveryProofVisible(true);
    setProcessing(false);
  };

  const openBatchDeliveryProof = (session) => {
    const pieces = Array.isArray(session?.pieces) ? session.pieces : [];
    if (pieces.length === 0) return;

    autoOpenPodCameraRef.current = true;
    openDeliveryProofModal({
      scanType: "package",
      shipmentId: session.shipmentId,
      tripId: session.tripId || null,
      barcode: pieces[0]?.barcode || pieces[0]?.packageId,
      source: "scan",
      shipmentDocData: session.shipmentDocData,
      packageIds: pieces.map((piece) => piece.packageId),
      batchPieces: pieces,
      isBatchDelivery: pieces.length > 1,
    });
    setBatchSummaryVisible(false);
  };

  const addPieceToBatchDelivery = ({
    shipmentDoc,
    pkg,
    barcode,
    source = "scan",
    actionStatus = scanActionStatus,
  }) => {
    const shipmentData = shipmentDoc.data();
    const packageId = assertPieceEligibleForBatchScan(pkg, shipmentData, {
      mode: resolvedMode,
      scanActionStatus: actionStatus,
      checkerUid: profile?.uid,
    });

    assertCheckerCanAccessShipment(shipmentData, profile?.uid);

    const normalizedAction = String(actionStatus || "").toUpperCase();

    if (
      batchDeliverySession &&
      batchDeliverySession.shipmentId !== shipmentDoc.id
    ) {
      throw new Error(
        "Complete the current batch before scanning another shipment.",
      );
    }

    if (
      batchDeliverySession &&
      batchDeliverySession.scanActionStatus &&
      batchDeliverySession.scanActionStatus !== normalizedAction
    ) {
      throw new Error(
        "Complete or cancel the current batch before switching actions.",
      );
    }

    const piece = {
      packageId,
      barcode: String(barcode || packageId).trim(),
      label: getBatchPieceLabel(pkg, barcode),
    };

    const baseSession =
      batchDeliverySession?.shipmentId === shipmentDoc.id
        ? batchDeliverySession
        : {
            shipmentId: shipmentDoc.id,
            shipmentDocData: shipmentData,
            scanActionStatus: String(actionStatus || "").toUpperCase(),
            tripId: getEffectiveTripId(shipmentData),
            customerName:
              shipmentData.recipient?.name ||
              shipmentData.customerName ||
              "Customer",
            shipmentLabel:
              shipmentData.shipmentId ||
              shipmentData.trackingNumber ||
              shipmentDoc.id,
            pieces: [],
          };

    const { session, added, duplicate } = appendBatchDeliveryPiece(
      baseSession,
      piece,
    );

    setBatchDeliverySession(session);
    setBatchSummaryVisible(true);
    setScanned(false);
    setProcessing(false);

    if (duplicate) {
      Vibration.vibrate();
      Alert.alert(
        "Already scanned",
        `${piece.label} is already in this delivery batch.`,
      );
      return;
    }

    if (added) {
      Vibration.vibrate();
    }
  };

  const handleCompleteBatchScan = () => {
    if (!batchDeliverySession?.pieces?.length) return;

    const action = String(
      batchDeliverySession.scanActionStatus || scanActionStatus || "",
    ).toUpperCase();

    if (action === "DELIVERED") {
      openBatchDeliveryProof(batchDeliverySession);
      return;
    }

    if (action === "FAILED_DELIVERY") {
      setBatchSummaryVisible(false);
      setFailedReasonVisible(true);
      return;
    }

    if (action === "RETURNED_TO_WAREHOUSE") {
      const pieceCount = batchDeliverySession.pieces.length;
      Alert.alert(
        "Confirm return to warehouse",
        `Return ${pieceCount} scanned piece${
          pieceCount === 1 ? "" : "s"
        } to Odiongan warehouse custody?`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Confirm return",
            onPress: () => completeReturnBatch(batchDeliverySession),
          },
        ],
      );
    }
  };

  const uploadFailureProofPhotos = async (shipmentId, photos) => {
    if (!photos.length) return [];
    const uploaded = [];
    for (let index = 0; index < photos.length; index += 1) {
      const uri = photos[index];
      const response = await fetch(uri);
      const blob = await response.blob();
      const fileRef = ref(
        storage,
        `shipments/${shipmentId}/failure-proof/${Date.now()}_${index}.jpg`,
      );
      await uploadBytes(fileRef, blob);
      uploaded.push(await getDownloadURL(fileRef));
    }
    return uploaded;
  };

  const pickFailedProofImage = async (useCamera) => {
    if (failedProofPhotos.length >= 3) {
      Alert.alert("Limit reached", "You can attach up to 3 photos.");
      return;
    }

    const options = {
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.5,
    };

    let result;
    if (useCamera) {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        Alert.alert("Permission Needed", "Camera access is required.");
        return;
      }
      result = await ImagePicker.launchCameraAsync(options);
    } else {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert("Permission Needed", "Photo library access is required.");
        return;
      }
      result = await ImagePicker.launchImageLibraryAsync(options);
    }

    if (!result.canceled && result.assets?.[0]?.uri) {
      setFailedProofPhotos((current) => [...current, result.assets[0].uri]);
    }
  };

  const completeFailedBatch = async ({ reasonCode, remarks }) => {
    const session = batchDeliverySession;
    if (!session?.pieces?.length || failedProofUploading) return;

    setFailedProofUploading(true);
    setProcessing(true);

    try {
      const packageIds = session.pieces.map((piece) => piece.packageId);
      const reasonLabel = getFailureReasonLabel(reasonCode);
      const note =
        String(remarks || "").trim() ||
        `Failed delivery: ${reasonLabel} (${packageIds.length} piece${
          packageIds.length === 1 ? "" : "s"
        }).`;

      const photoUrls = await uploadFailureProofPhotos(
        session.shipmentId,
        failedProofPhotos,
      );

      await reportCheckerFailedDelivery({
        shipmentIds: [session.shipmentId],
        packageIds,
        profile,
        reasonCode,
        remarks: note,
        failurePhotoUrls: photoUrls,
      });

      setFailedReasonVisible(false);
      setFailedProofPhotos([]);
      clearBatchDeliverySession();

      showSuccessModal({
        barcode: packageIds[0],
        shipmentId: session.shipmentId,
        shipmentStatus: "FAILED_DELIVERY",
        packageStatus: "FAILED_DELIVERY",
        quantity: packageIds.length,
        message: `${packageIds.length} piece${
          packageIds.length === 1 ? "" : "s"
        } marked failed. Custody remains with you until returned at Odiongan.`,
        source: "scan",
      });
    } catch (error) {
      Alert.alert(
        "Failed delivery error",
        getActionErrorMessage(error, "Could not mark pieces as failed."),
      );
      setProcessing(false);
    } finally {
      setFailedProofUploading(false);
    }
  };

  const completeReturnBatch = async (session) => {
    if (!session?.pieces?.length || processing) return;

    setProcessing(true);

    try {
      const packageIds = session.pieces.map((piece) => piece.packageId);

      await returnCheckerShipmentsToWarehouse({
        shipmentIds: [session.shipmentId],
        packageIds,
        profile,
        remarks: `Returned ${packageIds.length} piece${
          packageIds.length === 1 ? "" : "s"
        } to Odiongan warehouse.`,
      });

      clearBatchDeliverySession();
      setBatchSummaryVisible(false);

      showSuccessModal({
        barcode: packageIds[0],
        shipmentId: session.shipmentId,
        shipmentStatus: "RETURNED_TO_WAREHOUSE",
        packageStatus: "RETURNED_TO_WAREHOUSE",
        quantity: packageIds.length,
        message: `${packageIds.length} piece${
          packageIds.length === 1 ? "" : "s"
        } returned to Odiongan warehouse.`,
        source: "scan",
      });
    } catch (error) {
      Alert.alert(
        "Return error",
        getActionErrorMessage(error, "Could not return pieces to warehouse."),
      );
      setProcessing(false);
    }
  };

  const handleRemoveBatchPiece = (packageId) => {
    setBatchDeliverySession((current) => {
      if (!current) return null;
      const pieces = current.pieces.filter((piece) => piece.packageId !== packageId);
      if (pieces.length === 0) {
        setBatchSummaryVisible(false);
        return null;
      }
      return { ...current, pieces };
    });
  };

  const pickDeliveryProofImage = async (useCamera) => {
    const existingCount = pendingDelivery?.existingProofs?.length || 0;
    if (
      existingCount + deliveryProofPhotos.length >=
      DELIVERY_PROOF_MAX_IMAGES
    ) {
      Alert.alert(
        "Limit Reached",
        `This delivery already has ${DELIVERY_PROOF_MAX_IMAGES} proof images.`,
      );
      return;
    }

    const options = {
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.5,
    };

    let result;

    if (useCamera) {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        Alert.alert("Permission Needed", "Camera access is required.");
        return;
      }
      result = await ImagePicker.launchCameraAsync(options);
    } else {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert("Permission Needed", "Photo library access is required.");
        return;
      }
      result = await ImagePicker.launchImageLibraryAsync(options);
    }

    if (!result.canceled) {
      setDeliveryProofPhotos((current) => [...current, result.assets[0].uri]);
    }
  };
  pickDeliveryProofImageRef.current = pickDeliveryProofImage;

  const removeDeliveryProofPhoto = (index) => {
    setDeliveryProofPhotos((current) =>
      current.filter((_, photoIndex) => photoIndex !== index),
    );
  };

  const completePendingDelivery = async () => {
    if (!pendingDelivery || deliveryProofUploading) return;

    const existingProofs = pendingDelivery.existingProofs || [];
    const totalProofCount = existingProofs.length + deliveryProofPhotos.length;

    if (totalProofCount < DELIVERY_PROOF_MIN_IMAGES) {
      Alert.alert(
        "Proof Required",
        "Add at least 1 delivery photo before marking this shipment completed.",
      );
      return;
    }

    setDeliveryProofUploading(true);
    setProcessing(true);

    try {
      let shipmentDocData = pendingDelivery.shipmentDocData;
      let canonicalShipmentId = pendingDelivery.shipmentId;

      const batchPackageIds = Array.isArray(pendingDelivery.packageIds)
        ? pendingDelivery.packageIds.filter(Boolean)
        : [];

      if (
        !isOnline &&
        isCheckerLastMileScan &&
        pendingDelivery.blindQueue
      ) {
        const packageIds =
          batchPackageIds.length > 0
            ? batchPackageIds
            : [pendingDelivery.barcode].filter(Boolean);
        const location = await getCurrentLocationSafe();
        const proofRemarks =
          deliveryProofRemarks.trim() ||
          `Proof of Delivery: ${deliveryProofPhotos.length} image${
            deliveryProofPhotos.length === 1 ? "" : "s"
          } captured offline.`;

        await enqueueOfflineOperation({
          type: "DELIVERED",
          shipmentId: null,
          barcode: pendingDelivery.barcode,
          packageIds,
          blindQueue: true,
          remarks: proofRemarks,
          photoUris: deliveryProofPhotos,
          location,
          tripId: pendingDelivery.tripId || null,
          shipmentSnapshot: null,
          notificationChannels,
        });

        const pieceCount = packageIds.length;
        showSuccessModal({
          barcode: pendingDelivery.barcode,
          shipmentId: pendingDelivery.barcode,
          shipmentStatus: "DELIVERED",
          packageStatus: "DELIVERED",
          quantity: pendingDelivery.qty,
          message:
            pieceCount > 1
              ? `${pieceCount} pieces queued with proof. Will verify when online.`
              : "Delivery queued with proof. Will be verified when you are back online.",
          source: pendingDelivery.source,
          pendingSync: true,
        });
        setProcessing(false);
        resetDeliveryProof();
        return;
      }

      const deliveryScope =
        batchPackageIds.length > 0
          ? { isPackageLevel: true, packageIds: batchPackageIds }
          : resolvedMode === "offloading"
            ? resolveOffloadDeliverPackageIds(
                shipmentDocData,
                pendingDelivery.barcode,
                pendingDelivery.scanType,
              )
            : resolveDeliveryPackageIds({
                barcode: pendingDelivery.barcode,
                scanType: pendingDelivery.scanType,
                shipmentData: shipmentDocData,
              });
      const isPackageLevelDelivery =
        batchPackageIds.length > 0 ||
        resolvedMode === "offloading" ||
        deliveryScope.isPackageLevel;

      if (
        !isOnline &&
        isCheckerLastMileScan &&
        isPackageLevelDelivery &&
        Array.isArray(deliveryScope.packageIds) &&
        deliveryScope.packageIds.length > 0
      ) {
        assertCheckerCanAccessShipment(shipmentDocData, profile?.uid);
        const location = await getCurrentLocationSafe();
        const proofRemarks =
          deliveryProofRemarks.trim() ||
          `Proof of Delivery: ${deliveryProofPhotos.length} image${
            deliveryProofPhotos.length === 1 ? "" : "s"
          } captured offline.`;

        await enqueueOfflineOperation({
          type: "DELIVERED",
          shipmentId: canonicalShipmentId,
          barcode: pendingDelivery.barcode,
          packageIds: deliveryScope.packageIds,
          remarks: proofRemarks,
          photoUris: deliveryProofPhotos,
          location,
          tripId: pendingDelivery.tripId || null,
          shipmentSnapshot: shipmentDocData,
          notificationChannels,
        });

        const pieceCount = deliveryScope.packageIds.length;
        showSuccessModal({
          barcode: pendingDelivery.barcode,
          shipmentId: canonicalShipmentId,
          shipmentStatus: "DELIVERED",
          packageStatus: "DELIVERED",
          quantity: pendingDelivery.qty,
          message:
            pieceCount > 1
              ? `${pieceCount} pieces saved locally with proof. Pending sync.`
              : "Piece saved locally with proof. Pending sync.",
          source: pendingDelivery.source,
          pendingSync: true,
        });
        setProcessing(false);
        resetDeliveryProof();
        return;
      }

      const uploadedUrls = await uploadDeliveryProofPhotos(
        pendingDelivery.shipmentId,
        deliveryProofPhotos,
      );
      const proofImages = [...existingProofs, ...uploadedUrls];
      const proofRemarks =
        deliveryProofRemarks.trim() ||
        `Proof of Delivery: ${proofImages.length} image${
          proofImages.length === 1 ? "" : "s"
        } uploaded.`;

      const directShipmentSnap = await getDoc(
        doc(db, "shipments", String(canonicalShipmentId)),
      );

      if (!directShipmentSnap.exists()) {
        const resolvedShipmentDoc = await getShipmentDocByCode(
          db,
          pendingDelivery.barcode,
        );

        if (!resolvedShipmentDoc) {
          throw new Error(
            "Shipment not found. Scan the label again from the trip offload screen.",
          );
        }

        canonicalShipmentId = resolvedShipmentDoc.id;
        shipmentDocData = resolvedShipmentDoc.data();
      } else if (!shipmentDocData) {
        shipmentDocData = directShipmentSnap.data();
      }

      if (isCheckerLastMileScan && isPackageLevelDelivery) {
        assertCheckerCanAccessShipment(shipmentDocData, profile?.uid);
        const location = await getCurrentLocationSafe();
        const pieceIds =
          Array.isArray(deliveryScope.packageIds) &&
          deliveryScope.packageIds.length > 0
            ? deliveryScope.packageIds
            : null;

        if (pieceIds) {
          await completeCheckerDelivery({
            shipmentId: canonicalShipmentId,
            packageIds: pieceIds,
            profile,
            tripId: pendingDelivery.tripId || null,
            location,
            photoUrls: proofImages,
            shipment: shipmentDocData,
            notificationChannels,
          });

          const pieceCount = pieceIds.length;
          showSuccessModal({
            barcode: pendingDelivery.barcode,
            shipmentId: canonicalShipmentId,
            shipmentStatus: "DELIVERED",
            packageStatus: "DELIVERED",
            quantity: pendingDelivery.qty,
            message:
              pieceCount > 1
                ? `${pieceCount} pieces delivered with shared proof of delivery.`
                : "Piece delivered with proof of delivery.",
            source: pendingDelivery.source,
          });
          return;
        }
      }

      if (
        resolvedMode === "offloading" &&
        isPackageLevelDelivery &&
        batchPackageIds.length > 0
      ) {
        const location = await getCurrentLocationSafe();
        await executeStatusUpdate({
          shipmentId: canonicalShipmentId,
          barcode: pendingDelivery.barcode,
          status: "DELIVERED",
          qty: pendingDelivery.qty,
          remarks: proofRemarks,
          source: pendingDelivery.source,
          shipmentDocData,
          proofImages,
          packageIds: batchPackageIds,
          location,
          throwOnError: true,
        });

        const pieceCount = batchPackageIds.length;
        showSuccessModal({
          barcode: pendingDelivery.barcode,
          shipmentId: canonicalShipmentId,
          shipmentStatus: "DELIVERED",
          packageStatus: "DELIVERED",
          quantity: pendingDelivery.qty,
          message:
            pieceCount > 1
              ? `${pieceCount} pieces delivered with shared proof of delivery.`
              : "Piece delivered with proof of delivery.",
          source: pendingDelivery.source,
        });
        return;
      }

      if (isCheckerLastMileScan && !isPackageLevelDelivery) {
        setDeliveryProofUploading(false);
        Alert.alert(
          "Scan piece label",
          "Scan an individual piece label to deliver. Master tracking alone cannot complete delivery.",
        );
        return;
      }

      await executeStatusUpdate({
        shipmentId: canonicalShipmentId,
        barcode: pendingDelivery.barcode,
        status: "DELIVERED",
        qty: pendingDelivery.qty,
        remarks: proofRemarks,
        source: pendingDelivery.source,
        shipmentDocData,
        proofImages,
        completeShipment:
          resolvedMode === "offloading" ? false : !isPackageLevelDelivery,
        packageIds: deliveryScope.packageIds,
        throwOnError: false,
      });

      setProcessing(false);
      resetDeliveryProof();
    } catch (error) {
      console.error(
        "Delivery proof completion failed:",
        error?.code,
        error?.message,
        error,
      );
      Alert.alert(
        "Action Failed",
        getActionErrorMessage(error, "Failed to complete delivery proof."),
      );
      setProcessing(false);
      setDeliveryProofUploading(false);
    }
  };

  const openInfoPreview = (shipmentDoc, pkg, barcode) => {
    const pieceCode =
      pkg?.packageId || pkg?.trackingNumber || String(barcode || "").trim();
    setScannedData({
      id: shipmentDoc.id,
      ...shipmentDoc.data(),
      scannedPackageId: pieceCode,
      scannedCode: pieceCode,
    });
    setInfoModalVisible(true);
    setScanned(false);
    setProcessing(false);
  };

  const handleResolvedPackage = async ({
    shipmentDoc,
    pkg,
    barcode,
    manualQtyOverride = null,
    source = "scan",
    location = null,
  }) => {
    const shipmentData = shipmentDoc.data();
    const statusToApply = getStatusToApply();
    setLatestScanDetails({
      shipmentDoc,
      shipmentData,
      pkg,
      barcode,
      source,
      appliedStatus: statusToApply,
    });

    if (resolvedMode === "info" && !statusToApply) {
      openInfoPreview(shipmentDoc, pkg, barcode);
      return;
    }

    if (!statusToApply) {
      throw new Error("Unsupported scan mode.");
    }

    if (
      resolvedMode === "offloading" &&
      ["OUT_FOR_DELIVERY", "RECEIVED", "DELIVERED"].includes(statusToApply)
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

    const packagingGroup = String(pkg?.packagingGroup || "").toUpperCase();
    const isBulk = packagingGroup === "BULK";

    if (
      (isBulk || isIssueStatus(statusToApply)) &&
      manualQtyOverride == null
    ) {
      setTargetPackage(pkg);
      setParentShipmentId(shipmentDoc.id);
      setParentShipmentData(shipmentData);
      setPendingPackageIds([barcode]);
      setPendingActionStatus(statusToApply);
      setPendingActionSource(source);
      setPendingActionRemarks(
        isIssueStatus(statusToApply) ? getIssueDefaultRemarks(statusToApply) : "",
      );
      setActionModalVisible(true);
      setProcessing(false);
      return;
    }

    if (
      isBatchScan &&
      ["DELIVERED", "FAILED_DELIVERY", "RETURNED_TO_WAREHOUSE"].includes(
        statusToApply,
      )
    ) {
      if (statusToApply === "DELIVERED" && !isCheckerLastMileScan) {
        await assertShipmentOnTrip(shipmentDoc.id, shipmentData);
      }
      addPieceToBatchDelivery({
        shipmentDoc,
        pkg,
        barcode,
        source,
        actionStatus: statusToApply,
      });
      return;
    }

    if (statusToApply === "DELIVERED") {
      if (isCheckerLastMileScan) {
        assertCheckerCanAccessShipment(shipmentData, profile?.uid);
      } else {
        await assertShipmentOnTrip(shipmentDoc.id, shipmentData);
      }
      openDeliveryProofModal({
        scanType: "package",
        shipmentId: shipmentDoc.id,
        tripId: getEffectiveTripId(shipmentData),
        barcode:
          String(pkg?.packageId || "").trim() || normalizeScanCode(barcode),
        qty: isBulk ? manualQtyOverride : null,
        source,
        shipmentDocData: shipmentData,
        packageIds: [
          getDeliverPackageIdForScan(shipmentData, barcode),
        ].filter(Boolean),
      });
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
      location,
    });
  };

  const handleProcessPackage = async (
    barcode,
    manualQtyOverride = null,
    source = "scan",
  ) => {
    if (processing) return;

    setProcessing(true);
    Vibration.vibrate();

    const locationPromise = cachedLocationRef.current
      ? Promise.resolve(cachedLocationRef.current)
      : getCurrentLocationSafe().then((location) => {
          if (location) {
            cachedLocationRef.current = location;
          }
          return location;
        });

    try {
      const checkerLastMile = isCheckerLastMileScanMode(resolvedMode, {
        tripId: resolvedTripId,
      });
      let lookupResult;

      if (!isOnline && checkerLastMile) {
        if (Object.keys(effectiveShipmentsById).length > 0) {
          const offlineIndex = buildShipmentMapBarcodeIndex(
            effectiveShipmentsById,
          );
          lookupResult = lookupScannedShipmentOffline(
            barcode,
            effectiveShipmentsById,
            offlineIndex,
          );
        }

        if (!lookupResult) {
          const isLoadScanContext =
            resolvedMode === "delivery" ||
            String(
              scanActionStatus ||
                (Array.isArray(presetScanStatus)
                  ? presetScanStatus[0]
                  : presetScanStatus) ||
                getDefaultScanStatus(resolvedMode, { tripId: resolvedTripId }) ||
                "",
            ).toUpperCase() === "LOAD_TO_VEHICLE";

          if (isLoadScanContext) {
            const resolvedLocation = await locationPromise;
            await enqueueOfflineOperation({
              type: "LOAD_TO_VEHICLE",
              shipmentId: null,
              barcode,
              packageIds: [barcode],
              blindQueue: true,
              remarks:
                "Blind offline load — package not in local cache; verify on sync.",
              location: resolvedLocation,
              notificationChannels,
            });
            showSuccessModal({
              barcode,
              shipmentId: barcode,
              shipmentStatus: "PENDING_SYNC",
              packageStatus: "LOAD_TO_VEHICLE",
              message:
                "Load queued. This package was not in your local list — it will be verified when you are back online.",
              source,
              pendingSync: true,
            });
            return;
          }

          const isOffloadScanContext =
            checkerLastMile && resolvedMode === "offloading" && !resolvedTripId;

          if (isOffloadScanContext) {
            const actionStatus = String(
              getStatusToApply() ||
                getDefaultScanStatus(resolvedMode, { tripId: resolvedTripId }) ||
                "DELIVERED",
            ).toUpperCase();
            const resolvedLocation = await locationPromise;

            if (actionStatus === "DELIVERED") {
              openDeliveryProofModal({
                scanType: "package",
                shipmentId: null,
                tripId: null,
                barcode,
                qty: null,
                source,
                shipmentDocData: null,
                packageIds: [barcode],
                blindQueue: true,
              });
              return;
            }

            if (actionStatus === "FAILED_DELIVERY") {
              await enqueueOfflineOperation({
                type: "FAILED_DELIVERY",
                shipmentId: null,
                barcode,
                packageIds: [barcode],
                blindQueue: true,
                reasonCode: "DELIVERY_FAILED",
                remarks:
                  "Blind offline failed delivery — verify on sync.",
                location: resolvedLocation,
                notificationChannels,
              });
              showSuccessModal({
                barcode,
                shipmentId: barcode,
                shipmentStatus: "PENDING_SYNC",
                packageStatus: "FAILED_DELIVERY",
                message:
                  "Failed delivery queued. Will be verified when you are back online.",
                source,
                pendingSync: true,
              });
              return;
            }

            if (actionStatus === "RETURNED_TO_WAREHOUSE") {
              await enqueueOfflineOperation({
                type: "RETURNED_TO_WAREHOUSE",
                shipmentId: null,
                barcode,
                packageIds: [barcode],
                blindQueue: true,
                remarks: "Blind offline return — verify on sync.",
                location: resolvedLocation,
                notificationChannels,
              });
              showSuccessModal({
                barcode,
                shipmentId: barcode,
                shipmentStatus: "PENDING_SYNC",
                packageStatus: "RETURNED_TO_WAREHOUSE",
                message:
                  "Return queued. Will be verified when you are back online.",
                source,
                pendingSync: true,
              });
              return;
            }
          }

          throw new Error(
            `Package ${barcode} is not in your offline cache. Open Available while online to refresh, or use Load/Deliver scan — those queue automatically.`,
          );
        }
      } else {
        lookupResult = await lookupScannedShipment(db, barcode, {
          tripIndex: tripBarcodeIndexRef.current,
          cache: scanLookupCacheRef.current,
        });
        if (checkerLastMile && lookupResult?.shipmentDoc?.id) {
          const shipmentId = lookupResult.shipmentDoc.id;
          const shipmentData = lookupResult.shipmentData;
          void warmShipmentCache({
            [shipmentId]: { id: shipmentId, ...shipmentData },
          });
        }
      }

      const [{ shipmentDoc, shipmentData, pkg, scanType }, resolvedLocation] =
        await Promise.all([Promise.resolve(lookupResult), locationPromise]);

      if (resolvedMode === "info") {
        openInfoPreview(shipmentDoc, pkg, barcode);
        return;
      }

      if (isCheckerLastMileScan) {
        assertCheckerCanAccessShipment(shipmentData, profile?.uid);
      }

      if (scanType === "shipment") {
        const statusToApply = getStatusToApply();
        setLatestScanDetails({
          shipmentDoc,
          shipmentData,
          barcode,
          source,
          appliedStatus: statusToApply,
        });

        if (resolvedMode === "info") {
          openInfoPreview(shipmentDoc, null, barcode);
          return;
        }

        if (!statusToApply) {
          throw new Error("Unsupported scan mode.");
        }

        if (
          resolvedMode === "offloading" &&
          ["OUT_FOR_DELIVERY", "RECEIVED", "DELIVERED"].includes(statusToApply)
        ) {
          const shipmentStatus = String(
            shipmentData?.status || "",
          ).toUpperCase();

          if (!canApplyOffloadCompletion(shipmentStatus)) {
            throw new Error(
              "This shipment must be Loaded, Ready for Delivery, or Out for Delivery before it can be received or delivered.",
            );
          }
        }

        if (
          isBatchScan &&
          ["DELIVERED", "FAILED_DELIVERY", "RETURNED_TO_WAREHOUSE"].includes(
            statusToApply,
          )
        ) {
          throw new Error(
            "Scan each piece label. Master tracking alone cannot complete this action.",
          );
        }

        if (statusToApply === "DELIVERED") {

          if (!isCheckerLastMileScan) {
            await assertShipmentOnTrip(shipmentDoc.id, shipmentData);
          }
          openDeliveryProofModal({
            scanType: "shipment",
            shipmentId: shipmentDoc.id,
            tripId: getEffectiveTripId(shipmentData),
            barcode,
            qty: getShipmentTotal(shipmentData),
            source,
            shipmentDocData: shipmentData,
          });
          return;
        }

        if (statusToApply === "LOAD_TO_VEHICLE") {
          throw new Error(
            "Scan an individual piece label to load. Master tracking alone cannot load pieces.",
          );
        }

        const shipmentPackageIds = getShipmentPackageIds(shipmentData);

        if (!shipmentPackageIds.length) {
          throw new Error("No package labels found for this shipment.");
        }

        if (isIssueStatus(statusToApply)) {
          setTargetPackage(null);
          setParentShipmentId(shipmentDoc.id);
          setParentShipmentData(shipmentData);
          setPendingPackageIds(shipmentPackageIds);
          setPendingActionStatus(statusToApply);
          setPendingActionSource(source);
          setPendingActionRemarks(getIssueDefaultRemarks(statusToApply));
          setActionModalVisible(true);
          setProcessing(false);
          return;
        }

        await executeStatusUpdate({
          shipmentId: shipmentDoc.id,
          barcode,
          packageIds: shipmentPackageIds,
          status: statusToApply,
          qty: null,
          remarks: "",
          source,
          shipmentDocData: shipmentData,
          location: resolvedLocation,
        });
        return;
      }

      await handleResolvedPackage({
        shipmentDoc,
        pkg,
        barcode,
        manualQtyOverride,
        source,
        location: resolvedLocation,
      });
    } catch (error) {
      console.error("Process package error:", error);
      Alert.alert(
        "Error",
        getActionErrorMessage(error, "Failed to process package."),
        [{ text: "Retry", onPress: resetScanner }],
      );
      setProcessing(false);
    }
  };

  const onCameraScan = ({ data }) => {
    if (scanned || processing) return;

    const code = String(data || "").trim();
    if (!code) return;

    const now = Date.now();
    const lastScan = lastScanRef.current;
    if (lastScan.code === code && now - lastScan.at < 1200) {
      return;
    }
    lastScanRef.current = { code, at: now };

    setScanned(true);
    handleProcessPackage(code, null, "scan");
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
                getActionErrorMessage(
                  error,
                  "Failed to update trip status.",
                ),
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
      "All packages are delivered. Mark this trip as completed?",
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
                getActionErrorMessage(
                  error,
                  "Failed to update trip status.",
                ),
              );
            } finally {
              setTripStatusUpdating(false);
            }
          },
        },
      ],
    );
  };

  const modeLabel = getModeLabel(resolvedMode);
  const scanAccentColor = (() => {
    const status = String(scanActionStatus || "").toUpperCase();
    if (resolvedMode === "info") return "#7c3aed";
    if (status === "DELIVERED") return "#16a34a";
    if (status === "FAILED_DELIVERY") return "#dc2626";
    if (status === "RETURNED_TO_WAREHOUSE") return "#f97316";
    return "#2563eb"; // load / default
  })();
  const latestTypeLabel = getLatestTypeLabel(latestScan.type);
  const progressLabel = getProgressLabel(resolvedMode);
  const hasTripContext = !!(tripSummary.tripId || resolvedTripId);
  const progressSummary = hasTripContext ? tripSummary : shipmentSummary;
  const primaryScanActions = getPrimaryScanActions(resolvedMode, {
    tripId: resolvedTripId,
  });
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
    tripSummary.deliveredPackages >= tripSummary.totalPackages &&
    !["COMPLETED", "CANCELLED"].includes(tripStatus);
  const deliveryProofExistingCount =
    pendingDelivery?.existingProofs?.length || 0;
  const deliveryProofTotalCount =
    deliveryProofExistingCount + deliveryProofPhotos.length;
  const canCompletePendingDelivery =
    !!pendingDelivery &&
    deliveryProofTotalCount >= DELIVERY_PROOF_MIN_IMAGES &&
    !deliveryProofUploading;

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <ScannerCameraPane
        scanned={scanned}
        processing={processing}
        flashEnabled={flashEnabled}
        modeLabel={modeLabel}
        detailsSheetHeight={detailsSheetHeight}
        onBack={() => router.back()}
        onToggleFlash={() => setFlashEnabled((current) => !current)}
        onBarcodeScanned={onCameraScan}
        accentColor={scanAccentColor}
      />

      <ScanDetailsSheet
        colors={colors}
        height={detailsSheetHeight}
        panHandlers={detailsSheetPanResponder.panHandlers}
        scanned={scanned}
        latestScan={latestScan}
        latestTypeLabel={latestTypeLabel}
        primaryScanActions={primaryScanActions}
        issueScanActions={resolvedMode === "info" ? [] : ISSUE_SCAN_ACTIONS}
        selectedScanAction={selectedScanAction}
        scanActionStatus={scanActionStatus}
        scanActionHeading={scanActionHeading}
        processing={processing}
        tripStatusUpdating={tripStatusUpdating}
        summaryLoading={summaryLoading}
        progressSummary={progressSummary}
        hasTripContext={hasTripContext}
        progressLabel={progressLabel}
        canMarkTripCompleted={canMarkTripCompleted}
        canMarkTripOutForDelivery={canMarkTripOutForDelivery}
        onSelectScanAction={setScanActionStatus}
        onManualEntry={() => setShowManual(true)}
        onResetScanner={resetScanner}
        onMarkCompleted={handleMarkCompleted}
        onMarkOutForDelivery={handleMarkOutForDelivery}
        notificationChannels={notificationChannels}
        notificationOptions={NOTIFICATION_CHANNEL_OPTIONS}
        onToggleNotificationChannel={toggleNotificationChannel}
        onViewShipmentDetails={() =>
          router.push({
            pathname: "/(checker)/shipment-details",
            params: {
              shipmentId: latestScan.shipmentId,
              parentTripId:
                latestScan.currentTripId || tripSummary.tripId || resolvedTripId,
            },
          })
        }
      />

      <PackageActionModal
        visible={actionModalVisible}
        onClose={resetScanner}
        count={pendingPackageIds.length || 1}
        maxQty={
          targetPackage?.quantity || getShipmentTotal(parentShipmentData || {}) || 1
        }
        onAction={async (status, remarks, qty) => {
          if (status === "DELIVERED") {
            try {
              if (isBatchDeliveryScan) {
                addPieceToBatchDelivery({
                  shipmentDoc: {
                    id: parentShipmentId,
                    data: () => parentShipmentData,
                  },
                  pkg: targetPackage,
                  barcode: targetPackage?.packageId,
                  source: pendingActionSource,
                });
                setActionModalVisible(false);
                return;
              }

              await assertShipmentOnTrip(parentShipmentId, parentShipmentData);
              openDeliveryProofModal({
                scanType: "package",
                shipmentId: parentShipmentId,
                tripId: getEffectiveTripId(parentShipmentData),
                barcode: targetPackage?.packageId,
                qty,
                source: pendingActionSource,
                shipmentDocData: parentShipmentData,
                remarks,
                packageIds: targetPackage?.packageId
                  ? [targetPackage.packageId]
                  : null,
              });
              setActionModalVisible(false);
            } catch (error) {
              Alert.alert(
                "Error",
                getActionErrorMessage(error, "Failed to open delivery proof."),
              );
              setProcessing(false);
            }
            return;
          }

          executeStatusUpdate({
            shipmentId: parentShipmentId,
            barcode:
              targetPackage?.packageId ||
              targetPackage?.trackingNumber ||
              pendingPackageIds[0],
            packageIds:
              pendingPackageIds.length > 0
                ? pendingPackageIds
                : targetPackage?.packageId
                  ? [targetPackage.packageId]
                  : null,
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
        initialRemarks={pendingActionRemarks}
      />

      <ManualEntryModal
        visible={showManual}
        onClose={() => setShowManual(false)}
        onSubmit={onManualSubmit}
        loading={processing}
        mode={resolvedMode}
        actionLabel={selectedScanAction?.label}
        accentColor={scanAccentColor}
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

      <BatchDeliverySummaryModal
        visible={batchSummaryVisible && (batchDeliverySession?.pieces?.length || 0) > 0}
        customerName={batchDeliverySession?.customerName}
        shipmentLabel={batchDeliverySession?.shipmentLabel}
        pieces={batchDeliverySession?.pieces || []}
        eyebrow={getBatchScanSummaryEyebrow(batchScanAction)}
        completeLabel={getBatchScanCompleteLabel(batchScanAction)}
        accentColor={
          batchScanAction === "FAILED_DELIVERY"
            ? "#dc2626"
            : batchScanAction === "RETURNED_TO_WAREHOUSE"
              ? "#b45309"
              : "#2563eb"
        }
        iconName={
          batchScanAction === "FAILED_DELIVERY"
            ? "exclamation-triangle"
            : batchScanAction === "RETURNED_TO_WAREHOUSE"
              ? "warehouse"
              : "check-circle"
        }
        onRemovePiece={handleRemoveBatchPiece}
        onCompleteScan={handleCompleteBatchScan}
        onCancel={() => setBatchSummaryVisible(false)}
      />

      <FailedDeliveryReasonModal
        visible={failedReasonVisible && (batchDeliverySession?.pieces?.length || 0) > 0}
        uploading={failedProofUploading}
        customerName={batchDeliverySession?.customerName}
        pieceCount={batchDeliverySession?.pieces?.length || 0}
        pieces={batchDeliverySession?.pieces || []}
        photos={failedProofPhotos}
        onClose={() => {
          if (failedProofUploading) return;
          setFailedReasonVisible(false);
        }}
        onPickImage={() => pickFailedProofImage(false)}
        onTakePhoto={() => pickFailedProofImage(true)}
        onRemovePhoto={(index) =>
          setFailedProofPhotos((current) =>
            current.filter((_, photoIndex) => photoIndex !== index),
          )
        }
        onConfirm={completeFailedBatch}
      />

      <DeliveryProofModal
        visible={deliveryProofVisible}
        uploading={deliveryProofUploading}
        photos={deliveryProofPhotos}
        remarks={deliveryProofRemarks}
        totalCount={deliveryProofTotalCount}
        minImages={DELIVERY_PROOF_MIN_IMAGES}
        maxImages={DELIVERY_PROOF_MAX_IMAGES}
        canSubmit={canCompletePendingDelivery}
        batchPieceCount={
          pendingDelivery?.packageIds?.length ||
          pendingDelivery?.batchPieces?.length ||
          0
        }
        batchPieces={pendingDelivery?.batchPieces || []}
        onClose={cancelDeliveryProof}
        onPickImage={() => pickDeliveryProofImage(false)}
        onTakePhoto={() => pickDeliveryProofImage(true)}
        onRemovePhoto={removeDeliveryProofPhoto}
        onRemarksChange={setDeliveryProofRemarks}
        onSubmit={completePendingDelivery}
      />

      <ScanSuccessModal
        visible={successModalVisible}
        payload={successPayload}
        countdown={countdown}
        onClose={closeSuccessModal}
        accentColor={scanAccentColor}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },
});
