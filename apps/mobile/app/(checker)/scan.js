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
  query,
  where,
  getDocs,
  doc,
  getDoc,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "../../firebase";

import PermissionRequest from "../../components/scanner/PermissionRequest";
import ManualEntryModal from "../../components/scanner/ManualEntryModal";
import DeliveryProofModal from "../../components/scanner/DeliveryProofModal";
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
  assertAssignedToChecker,
  completeCheckerDelivery,
  getCallableErrorMessage,
  loadAssignedShipmentsToVehicle,
  markShipmentOutForDelivery,
} from "../../components/utilities/checkerDelivery";
import {
  getCurrentLocationSafe,
  updatedBy,
} from "../../components/utilities/helpers";
import {
  buildLatestScanDetails,
  canApplyOffloadCompletion,
  clampSheetHeight,
  DEFAULT_DETAILS_SHEET_HEIGHT,
  getDefaultScanStatus,
  getLatestTypeLabel,
  getModeLabel,
  getProgressLabel,
  getShipmentDeliveredCount,
  getShipmentLoadedCount,
  getShipmentPackageIds,
  getShipmentScannedCount,
  getShipmentTotal,
  isIssueStatus,
  normalizeProofImages,
} from "../../components/utilities/scanner";
import {
  DELIVERY_PROOF_MAX_IMAGES,
  DELIVERY_PROOF_MIN_IMAGES,
  EMPTY_SCAN_DETAILS,
  EMPTY_TRIP_SUMMARY,
  ISSUE_SCAN_ACTIONS,
  MODE_SCAN_ACTIONS,
  SUCCESS_MODAL_SECONDS,
} from "../../components/constants/scanner";
import { useAuth } from "../../contexts/AuthContext";
import { useTheme } from "../../contexts/ThemeContext";

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
  const [deliveryProofVisible, setDeliveryProofVisible] = useState(false);
  const [deliveryProofPhotos, setDeliveryProofPhotos] = useState([]);
  const [deliveryProofRemarks, setDeliveryProofRemarks] = useState("");
  const [deliveryProofUploading, setDeliveryProofUploading] = useState(false);
  const [pendingDelivery, setPendingDelivery] = useState(null);
  const [tripSummary, setTripSummary] = useState(EMPTY_TRIP_SUMMARY);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [tripStatusUpdating, setTripStatusUpdating] = useState(false);
  const [latestScan, setLatestScan] = useState(EMPTY_SCAN_DETAILS);
  const [scanActionStatus, setScanActionStatus] = useState(null);
  const successTimerRef = useRef(null);
  const countdownTimerRef = useRef(null);
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

  const { mode, tripId } = useLocalSearchParams();
  const resolvedMode = Array.isArray(mode) ? mode[0] : mode;
  const resolvedTripId = Array.isArray(tripId) ? tripId[0] : tripId;

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

  const resetDeliveryProof = () => {
    setDeliveryProofVisible(false);
    setDeliveryProofPhotos([]);
    setDeliveryProofRemarks("");
    setDeliveryProofUploading(false);
    setPendingDelivery(null);
  };

  const cancelDeliveryProof = () => {
    resetDeliveryProof();
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
      return scanActionStatus || "DELIVERED";
    }
    if (resolvedMode === "delivery") {
      return scanActionStatus || null;
    }
    if (resolvedMode === "info" && isIssueStatus(scanActionStatus)) {
      return scanActionStatus;
    }
    return null;
  };

  const isDeliveryScanMode = resolvedMode === "delivery";

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
  }) => {
    try {
      const location = await getCurrentLocationSafe();
      const effectiveTripId = getEffectiveTripId(shipmentDocData);

      if (status === "LOAD_TO_VEHICLE") {
        assertAssignedToChecker(shipmentDocData, profile?.uid);
        await loadAssignedShipmentsToVehicle({
          shipmentIds: [shipmentId],
          profile,
          remarks: remarks || "Loaded via delivery scan.",
        });

        showSuccessModal({
          barcode,
          shipmentId,
          shipmentStatus: "READY_FOR_DELIVERY",
          packageStatus: "LOAD_TO_VEHICLE",
          quantity: qty,
          message: "Shipment loaded onto your delivery vehicle.",
          source,
        });
        return;
      }

      if (isDeliveryScanMode && status === "OUT_FOR_DELIVERY") {
        assertAssignedToChecker(shipmentDocData, profile?.uid);
        await markShipmentOutForDelivery({
          shipmentId,
          profile,
          tripId: effectiveTripId || null,
          remarks: remarks || "Marked out for delivery via scan.",
        });

        showSuccessModal({
          barcode,
          shipmentId,
          shipmentStatus: "OUT_FOR_DELIVERY",
          packageStatus: status,
          quantity: qty,
          message: "Shipment marked out for delivery.",
          source,
        });
        return;
      }

      if (completeShipment) {
        await updateShipmentStatus({
          shipmentId,
          tripId: effectiveTripId,
          newStatus: "COMPLETED",
          location,
          remarks,
          proofOfDelivery: proofImages,
          sourceUI: "CHECKER_MOBILE",
          updatedBy: updatedBy(profile),
        });
      } else {
        const targetPackageIds =
          Array.isArray(packageIds) && packageIds.length > 0
            ? packageIds
            : [barcode];

        await updateShipmentPackages({
          shipmentId,
          packageIds: targetPackageIds,
          newStatus: status,
          location,
          tripId: effectiveTripId,
          manualQty: qty,
          remarks,
          scanAction: resolvedMode,
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

      await fetchTripScanSummary(effectiveTripId);

      showSuccessModal({
        barcode,
        shipmentId,
        shipmentStatus: completeShipment
          ? "COMPLETED"
          : shipmentDocData?.status || "",
        packageStatus: status,
        quantity: qty,
        message:
          completeShipment
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
        isDeliveryScanMode
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

      let shipmentDocData = pendingDelivery.shipmentDocData;
      let canonicalShipmentId = pendingDelivery.shipmentId;

      const directShipmentSnap = await getDoc(
        doc(db, "shipments", String(canonicalShipmentId)),
      );

      if (!directShipmentSnap.exists()) {
        const resolvedShipmentDoc = await getShipmentDocByCode(
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

      if (isDeliveryScanMode) {
        assertAssignedToChecker(shipmentDocData, profile?.uid);
        const location = await getCurrentLocationSafe();

        await completeCheckerDelivery({
          shipmentId: canonicalShipmentId,
          profile,
          tripId: pendingDelivery.tripId || null,
          location,
          photoUrls: proofImages,
          shipment: shipmentDocData,
        });

        showSuccessModal({
          barcode: pendingDelivery.barcode,
          shipmentId: canonicalShipmentId,
          shipmentStatus: "DELIVERED",
          packageStatus: "DELIVERED",
          quantity: pendingDelivery.qty,
          message: "Delivery completed with proof of delivery.",
          source: pendingDelivery.source,
        });
      } else {
        await executeStatusUpdate({
          shipmentId: canonicalShipmentId,
          barcode: pendingDelivery.barcode,
          status: "DELIVERED",
          qty: pendingDelivery.qty,
          remarks: proofRemarks,
          source: pendingDelivery.source,
          shipmentDocData,
          proofImages,
          completeShipment: true,
          throwOnError: false,
        });
      }

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
    setScannedData({
      id: shipmentDoc.id,
      ...shipmentDoc.data(),
      scannedPackageId: pkg?.packageId || barcode,
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

    if (statusToApply === "DELIVERED") {
      if (isDeliveryScanMode) {
        assertAssignedToChecker(shipmentData, profile?.uid);
      } else {
        await assertShipmentOnTrip(shipmentDoc.id, shipmentData);
      }
      openDeliveryProofModal({
        scanType: "package",
        shipmentId: shipmentDoc.id,
        tripId: getEffectiveTripId(shipmentData),
        barcode,
        qty: isBulk ? manualQtyOverride : null,
        source,
        shipmentDocData: shipmentData,
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

      if (isDeliveryScanMode) {
        assertAssignedToChecker(shipmentData, profile?.uid);
      }

      if (scanType === "shipment") {
        const statusToApply = getStatusToApply();
        const currentTripId = setLatestScanDetails({
          shipmentDoc,
          shipmentData,
          barcode,
          source,
          appliedStatus: statusToApply,
        });

        await fetchTripScanSummary(currentTripId);

        if (resolvedMode === "info") {
          openInfoPreview(shipmentDoc, null, barcode);
          return;
        }

        if (!statusToApply) {
          throw new Error("Unsupported scan mode.");
        }

        if (
          resolvedMode === "offloading" &&
          ["RECEIVED", "DELIVERED"].includes(statusToApply)
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

        if (statusToApply === "DELIVERED") {
          if (!isDeliveryScanMode) {
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
          await executeStatusUpdate({
            shipmentId: shipmentDoc.id,
            barcode,
            status: statusToApply,
            remarks: "",
            source,
            shipmentDocData: shipmentData,
          });
          return;
        }

        if (isDeliveryScanMode && statusToApply === "OUT_FOR_DELIVERY") {
          await executeStatusUpdate({
            shipmentId: shipmentDoc.id,
            barcode,
            status: statusToApply,
            remarks: "",
            source,
            shipmentDocData: shipmentData,
          });
          return;
        }

        const shipmentPackageIds = getShipmentPackageIds(shipmentData);

        if (!shipmentPackageIds.length) {
          throw new Error("No package labels found for this shipment.");
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
        });
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
      Alert.alert(
        "Error",
        getActionErrorMessage(error, "Failed to process package."),
        [{ text: "Retry", onPress: resetScanner }],
      );
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
  const latestTypeLabel = getLatestTypeLabel(latestScan.type);
  const progressLabel = getProgressLabel(resolvedMode);
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
        onToggleFlash={() => setFlashEnabled((current) => !current)}
        onBarcodeScanned={onCameraScan}
      />

      <ScanDetailsSheet
        colors={colors}
        height={detailsSheetHeight}
        panHandlers={detailsSheetPanResponder.panHandlers}
        scanned={scanned}
        latestScan={latestScan}
        latestTypeLabel={latestTypeLabel}
        primaryScanActions={primaryScanActions}
        issueScanActions={ISSUE_SCAN_ACTIONS}
        selectedScanAction={selectedScanAction}
        scanActionStatus={scanActionStatus}
        scanActionHeading={scanActionHeading}
        processing={processing}
        tripStatusUpdating={tripStatusUpdating}
        summaryLoading={summaryLoading}
        tripSummary={tripSummary}
        progressLabel={progressLabel}
        canMarkTripCompleted={canMarkTripCompleted}
        canMarkTripOutForDelivery={canMarkTripOutForDelivery}
        onSelectScanAction={setScanActionStatus}
        onManualEntry={() => setShowManual(true)}
        onResetScanner={resetScanner}
        onMarkCompleted={handleMarkCompleted}
        onMarkOutForDelivery={handleMarkOutForDelivery}
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
        count={1}
        maxQty={targetPackage?.quantity || 1}
        onAction={async (status, remarks, qty) => {
          if (status === "DELIVERED") {
            try {
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

      <DeliveryProofModal
        visible={deliveryProofVisible}
        uploading={deliveryProofUploading}
        photos={deliveryProofPhotos}
        remarks={deliveryProofRemarks}
        totalCount={deliveryProofTotalCount}
        minImages={DELIVERY_PROOF_MIN_IMAGES}
        maxImages={DELIVERY_PROOF_MAX_IMAGES}
        canSubmit={canCompletePendingDelivery}
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
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },
});
