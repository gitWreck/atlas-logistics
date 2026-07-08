import React, { useEffect, useState } from "react";
import {
  View,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
  Text,
  TouchableOpacity,
  StatusBar as RNStatusBar,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { doc, getDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import * as ImagePicker from "expo-image-picker";
import { StatusBar } from "expo-status-bar";
import { FontAwesome5 } from "@expo/vector-icons";

import { db, storage } from "../../firebase";
import { useAuth } from "../../contexts/AuthContext.js";
import { useTheme } from "../../contexts/ThemeContext";
import { getCurrentLocationSafe, updatedBy } from "../utilities/helpers";
import {
  updateShipmentStatus,
  updateShipmentPackages,
  sendManualSMS,
} from "../utilities/FirebaseFunctions";
import {
  assertAssignedToChecker,
  completeCheckerDelivery,
  getCallableErrorMessage,
  getCheckerDeliveryNextAction,
  canCheckerAccessShipment,
  reportCheckerFailedDelivery,
  returnCheckerShipmentsToWarehouse,
} from "../utilities/checkerDelivery";

import ShipmentDetailHeader from "./ShipmentDetailHeader";
import ShipmentHeaderCard from "./ShipmentHeaderCard";
import ShipmentActionFooter from "./ShipmentActionFooter";

import ReportIssueModal from "./modals/ReportIssueModal";

import PhotoUploadSection from "./PhotoUploadSection";
import ExistingProofsViewer from "../tracking/ExistingProofsViewer";

import ShipmentPackagesPanel from "./details/ShipmentPackagesPanel";
import CustodyTimeline from "../custody/CustodyTimeline";
import { useShipmentCustodyTimeline } from "../../hooks/useShipmentCustodyTimeline";

const DEFAULT_NOTIFICATION_CHANNELS = {
  sms: true,
  email: true,
  push: true,
};

const NOTIFICATION_CHANNEL_OPTIONS = [
  { key: "sms", label: "SMS", icon: "comment-dots" },
  { key: "email", label: "Email", icon: "envelope" },
  { key: "push", label: "Push", icon: "bell" },
];

const FINAL_SHIPMENT_STATUSES = new Set(["COMPLETED", "DELIVERED"]);

export default function ShipmentDetailsScreen() {
  const { shipmentId, tripId, tripType, parentTripId } = useLocalSearchParams();
  const router = useRouter();
  const { isChecker, isDriver, profile } = useAuth();
  const { colors, resolvedScheme } = useTheme();
  const isDark = resolvedScheme === "dark";

  const resolvedTripId = parentTripId || tripId;

  const [shipment, setShipment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const [photos, setPhotos] = useState([]);
  const [isIssueModalVisible, setIsIssueModalVisible] = useState(false);
  const [actionMessage, setActionMessage] = useState("");
  const [deliveryNotificationChannels, setDeliveryNotificationChannels] =
    useState(DEFAULT_NOTIFICATION_CHANNELS);
  const {
    events: custodyEvents,
    loading: custodyLoading,
    error: custodyError,
  } = useShipmentCustodyTimeline(shipmentId, !!shipmentId);

  useEffect(() => {
    if (!shipmentId) return;

    const fetchDetails = async () => {
      try {
        const snap = await getDoc(doc(db, "shipments", String(shipmentId)));
        if (snap.exists()) {
          setShipment({ id: snap.id, ...snap.data() });
        } else {
          Alert.alert("Error", "Shipment data not found");
          router.back();
        }
      } catch (error) {
        console.error("Shipment details fetch error:", error);
        Alert.alert("Error", "Failed to load shipment details.");
      } finally {
        setLoading(false);
      }
    };

    fetchDetails();
  }, [shipmentId, router]);

  const pickImage = async (useCamera) => {
    if (photos.length >= 3) {
      Alert.alert("Limit Reached", "You can only upload up to 3 photos.");
      return;
    }

    let result;
    const options = {
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.5,
    };

    if (useCamera) {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        Alert.alert("Permission Needed", "Camera access is required.");
        return;
      }
      result = await ImagePicker.launchCameraAsync(options);
    } else {
      result = await ImagePicker.launchImageLibraryAsync(options);
    }

    if (!result.canceled) {
      setPhotos((prev) => [...prev, result.assets[0].uri]);
    }
  };

  const removePhoto = (index) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  const toggleDeliveryNotificationChannel = (key) => {
    setDeliveryNotificationChannels((current) => ({
      ...current,
      [key]: current[key] !== true,
    }));
  };

  const uploadPhotos = async () => {
    const urls = [];

    for (let i = 0; i < photos.length; i += 1) {
      const uri = photos[i];
      const filename = `proof_${shipmentId}_${Date.now()}_${i}.jpg`;
      const storageRef = ref(storage, `shipments/${shipmentId}/${filename}`);

      const response = await fetch(uri);
      const blob = await response.blob();

      await uploadBytes(storageRef, blob);
      const url = await getDownloadURL(storageRef);
      urls.push(url);
    }

    return urls;
  };

  const refreshShipment = async () => {
    const snap = await getDoc(doc(db, "shipments", String(shipmentId)));
    if (snap.exists()) {
      setShipment({ id: snap.id, ...snap.data() });
    }
  };

  const handleFooterAction = () => {
    if (canCheckerCompleteDelivery) {
      router.push({
        pathname: "/(checker)/scan",
        params: {
          mode: "offloading",
          title: "Deliver Piece",
          focusShipmentId: String(shipmentId),
          presetScanStatus: "DELIVERED",
        },
      });
      return;
    }
    handleAction();
  };

  const handleAction = async () => {
    if (!shipment) return;

    setActionLoading(true);

    try {
      const location = await getCurrentLocationSafe();
      const isCheckerLastMile =
        isChecker &&
        tripType !== "HUB_TRANSFER" &&
        canCheckerAccessShipment(shipment, profile?.uid);

      const checkerNextAction = isCheckerLastMile
        ? getCheckerDeliveryNextAction(shipment, profile?.uid)
        : null;

      if (isCheckerLastMile && checkerNextAction === "return") {
        await returnCheckerShipmentsToWarehouse({
          shipmentIds: [String(shipmentId)],
          profile,
        });
        Alert.alert(
          "Returned",
          "Shipment returned to Odiongan warehouse. It is no longer on your deliveries.",
        );
        router.back();
        setActionLoading(false);
        return;
      }

      if (shipment.status === "PENDING_PICKUP") {
        if (photos.length === 0) {
          Alert.alert(
            "Proof Required",
            "Please take at least one photo of the collected package.",
          );
          setActionLoading(false);
          return;
        }

        const photoUrls = await uploadPhotos();

        await updateShipmentStatus({
          shipmentId,
          tripId: resolvedTripId,
          newStatus: "PICKED_UP",
          location,
          remarks: `Proof of Receipt: ${photoUrls.length} images uploaded.`,
          proofOfReceipt: photoUrls,
          sourceUI: isChecker ? "CHECKER_MOBILE" : "DRIVER_MOBILE",
          updatedBy: updatedBy(profile),
        });

        Alert.alert("Success", "Package collected successfully.");
        router.back();
        return;
      }

      if (
        !isCheckerLastMile &&
        (shipment.status === "LOADED" || shipment.status === "IN_TRANSIT")
      ) {
        Alert.alert(
          "Action Blocked",
          "This shipment must be marked as ARRIVED at the warehouse before it can be taken out for delivery.",
        );
        setActionLoading(false);
        return;
      }

      const checkerCompletingDelivery =
        isCheckerLastMile && checkerNextAction === "deliver";

      if (checkerCompletingDelivery) {
        assertAssignedToChecker(shipment, profile?.uid);
      }

      if (shipment.status === "OUT_FOR_DELIVERY" || checkerCompletingDelivery) {
        if (photos.length === 0) {
          Alert.alert(
            "Proof Required",
            "Please take at least one photo of the delivery.",
          );
          setActionLoading(false);
          return;
        }

        const executeDeliveryCompletion = async () => {
          setActionLoading(true);

          try {
            const photoUrls = await uploadPhotos();
            const notify = Object.values(deliveryNotificationChannels).some(
              Boolean,
            );

            if (isChecker && tripType !== "HUB_TRANSFER") {
              await completeCheckerDelivery({
                shipmentId: String(shipmentId),
                profile,
                tripId: resolvedTripId || null,
                location,
                photoUrls,
                shipment,
                notificationChannels: deliveryNotificationChannels,
              });
            } else {
              await updateShipmentStatus({
                shipmentId,
                tripId: resolvedTripId,
                newStatus: "DELIVERED",
                location,
                remarks: `Proof of Delivery: ${photoUrls.length} images uploaded.`,
                proofOfDelivery: photoUrls,
                paymentStatus: shipment.isCOD ? "COLLECTED_BY_CHECKER" : "PAID",
                sourceUI: isChecker ? "CHECKER_MOBILE" : "DRIVER_MOBILE",
                notify,
                notificationChannels: deliveryNotificationChannels,
                notifySms: deliveryNotificationChannels.sms,
                notifyEmail: deliveryNotificationChannels.email,
                notifyPush: deliveryNotificationChannels.push,
                updatedBy: updatedBy(profile),
              });
            }

            Alert.alert("Success", "Delivery completed.");
            router.back();
          } catch (error) {
            console.error("Complete delivery error:", error);
            Alert.alert(
              "Error",
              error.message || "Failed to complete delivery.",
            );
          } finally {
            setActionLoading(false);
          }
        };

        if (shipment.isCOD && shipment.paymentStatus !== "PAID") {
          setActionLoading(false);

          Alert.alert(
            "Cash Collection Required",
            `Do you have exactly ₱${shipment.codAmount?.toLocaleString()} from the customer?`,
            [
              { text: "No, Cancel", style: "cancel" },
              {
                text: "Yes, Cash Collected",
                style: "destructive",
                onPress: executeDeliveryCompletion,
              },
            ],
          );
        } else {
          await executeDeliveryCompletion();
        }
      }
    } catch (error) {
      console.error("Shipment action error:", error);
      Alert.alert(
        "Error",
        getCallableErrorMessage(error, error.message || "Action failed."),
      );
      setActionLoading(false);
    }
  };

  const handleReportIssue = async (reasonId, reasonText) => {
    setIsIssueModalVisible(false);
    setActionLoading(true);

    try {
      if (
        isChecker &&
        tripType !== "HUB_TRANSFER" &&
        !["PENDING_PICKUP"].includes(shipment?.status)
      ) {
        assertAssignedToChecker(shipment, profile?.uid);
      }

      const location = await getCurrentLocationSafe();
      const newStatus =
        shipment.status === "PENDING_PICKUP"
          ? "FAILED_PICKUP"
          : "FAILED_DELIVERY";

      if (
        isChecker &&
        tripType !== "HUB_TRANSFER" &&
        newStatus === "FAILED_DELIVERY"
      ) {
        await reportCheckerFailedDelivery({
          shipmentIds: [String(shipmentId)],
          profile,
          reasonCode: reasonId,
          remarks: `Exception: ${reasonText} (${reasonId})`,
        });
        Alert.alert(
          "Failed Delivery",
          "Your loaded pieces were marked failed. Return them to Odiongan warehouse.",
        );
      } else {
        await updateShipmentStatus({
          shipmentId,
          tripId: resolvedTripId,
          newStatus,
          location,
          remarks: `Exception: ${reasonText} (${reasonId})`,
          sourceUI: isChecker ? "CHECKER_MOBILE" : "DRIVER_MOBILE",
          updatedBy: updatedBy(profile),
        });
        Alert.alert(
          "Issue Reported",
          `The shipment was marked as ${newStatus.replace(/_/g, " ")}.`,
        );
      }

      router.back();
    } catch (error) {
      console.error("Report issue error:", error);
      Alert.alert("Error", error.message || "Failed to report issue.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleManualSMS = async () => {
    if (!actionMessage.trim()) {
      Alert.alert("Empty Message", "Please type a message before sending.");
      return;
    }

    try {
      await sendManualSMS({
        phoneNumber: shipment.consigneePhone || shipment.customerPhone,
        message: actionMessage,
        shipmentId,
        tripId: resolvedTripId,
        reason: isChecker ? "checker_update" : "driver_update",
      });

      Alert.alert("Success", "SMS sent to customer.");
      setActionMessage("");
    } catch (error) {
      console.error("Manual SMS error:", error);
      Alert.alert("SMS Failed", error.message || "Failed to send SMS.");
    }
  };

  const handlePackageAction = async ({
    packageIds,
    newStatus,
    remarks = "",
    manualQty = null,
  }) => {
    if (
      FINAL_SHIPMENT_STATUSES.has(String(shipment?.status || "").toUpperCase())
    ) {
      Alert.alert(
        "Shipment Completed",
        "Package actions are disabled for completed shipments.",
      );
      return;
    }

    try {
      setActionLoading(true);
      const location = await getCurrentLocationSafe();

      await updateShipmentPackages({
        shipmentId,
        packageIds,
        newStatus,
        tripId: resolvedTripId,
        remarks,
        location,
        manualQty,
        updatedBy: updatedBy(profile),
      });

      const snap = await getDoc(doc(db, "shipments", String(shipmentId)));
      if (snap.exists()) {
        setShipment({ id: snap.id, ...snap.data() });
      }
    } catch (error) {
      console.error("Package action error:", error);
      Alert.alert("Error", error.message || "Failed to update packages.");
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.bg }]}>
        <ActivityIndicator size="large" color="#042C83" />
      </View>
    );
  }

  if (!shipment) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}>
        <StatusBar style={isDark ? "light" : "dark"} />
        <ShipmentDetailHeader onBack={() => router.back()} />
      </SafeAreaView>
    );
  }

  const packages = shipment?.packages || [];
  const isShipmentFinal = FINAL_SHIPMENT_STATUSES.has(
    String(shipment?.status || "").toUpperCase(),
  );
  const canDriverHandlePickup =
    isDriver &&
    tripType !== "HUB_TRANSFER" &&
    shipment?.status === "PENDING_PICKUP";
  const isCheckerLastMile =
    isChecker &&
    tripType !== "HUB_TRANSFER" &&
    canCheckerAccessShipment(shipment, profile?.uid);
  const checkerNextAction = isCheckerLastMile
    ? getCheckerDeliveryNextAction(shipment, profile?.uid)
    : null;
  const canCheckerCompleteDelivery =
    isCheckerLastMile && checkerNextAction === "deliver";
  const canCheckerReturnToWarehouse =
    isCheckerLastMile && checkerNextAction === "return";
  const showFooter =
    canDriverHandlePickup ||
    canCheckerCompleteDelivery ||
    canCheckerReturnToWarehouse;
  const needsPhotoUpload = canDriverHandlePickup;

  const packagePanelEditable =
    isCheckerLastMile &&
    !isShipmentFinal &&
    ["OUT_FOR_DELIVERY", "READY_FOR_DELIVERY"].includes(shipment?.status);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}>
      <StatusBar style={isDark ? "light" : "dark"} />

      <ShipmentDetailHeader onBack={() => router.back()} />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <ShipmentHeaderCard shipment={shipment} />

        <View
          style={[
            styles.timelineCard,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
            },
          ]}
        >
          <Text style={[styles.timelineTitle, { color: colors.text }]}>
            Scanned Info
          </Text>
          <Text style={[styles.timelineSubtitle, { color: colors.textMuted }]}>
            Full custody timeline for this shipment
          </Text>
          <CustodyTimeline
            events={custodyEvents}
            loading={custodyLoading}
            error={custodyError}
            colors={colors}
            isDark={isDark}
          />
        </View>

        <ExistingProofsViewer
          proofOfReceipt={shipment.proofOfReceipt}
          proofOfDelivery={shipment.proofOfDelivery}
        />

        {showFooter && needsPhotoUpload && (
          <PhotoUploadSection
            title={
              shipment?.status === "PENDING_PICKUP"
                ? "Proof of Receipt"
                : "Proof of Delivery"
            }
            photos={photos}
            onPickImage={pickImage}
            onRemovePhoto={removePhoto}
          />
        )}

        {canCheckerCompleteDelivery && (
          <View
            style={[
              styles.notificationCard,
              {
                backgroundColor: colors.surface,
                borderColor: isDark ? "#065f46" : "#d1fae5",
              },
            ]}
          >
            <Text style={[styles.notificationTitle, { color: colors.text }]}>
              Customer notifications
            </Text>
            <Text
              style={[styles.notificationSubtitle, { color: colors.textMuted }]}
            >
              Send an update when this delivery is completed.
            </Text>

            <View style={styles.notificationGrid}>
              {NOTIFICATION_CHANNEL_OPTIONS.map((channel) => {
                const selected =
                  deliveryNotificationChannels[channel.key] === true;

                return (
                  <TouchableOpacity
                    key={channel.key}
                    style={[
                      styles.notificationOption,
                      {
                        backgroundColor: colors.cardMuted,
                        borderColor: colors.border,
                      },
                      selected && {
                        backgroundColor: isDark ? "#064e3b" : "#ecfdf5",
                        borderColor: "#34d399",
                      },
                    ]}
                    onPress={() =>
                      toggleDeliveryNotificationChannel(channel.key)
                    }
                    disabled={actionLoading}
                    activeOpacity={0.78}
                  >
                    <FontAwesome5
                      name={channel.icon}
                      size={13}
                      color={selected ? "#34d399" : colors.textMuted}
                    />
                    <Text
                      style={[
                        styles.notificationOptionText,
                        { color: colors.textMuted },
                        selected && { color: isDark ? "#a7f3d0" : "#047857" },
                      ]}
                    >
                      {channel.label}
                    </Text>
                    {selected && (
                      <FontAwesome5 name="check" size={11} color="#34d399" />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        <ShipmentPackagesPanel
          shipment={shipment}
          packages={packages}
          editable={packagePanelEditable}
          onSubmitAction={handlePackageAction}
          loading={actionLoading}
        />
      </ScrollView>

      {showFooter && (
        <ShipmentActionFooter
          status={shipment.status}
          actionLoading={actionLoading}
          onAction={handleFooterAction}
          onReportIssue={() => setIsIssueModalVisible(true)}
          message={actionMessage}
          onMessageChange={setActionMessage}
          isPickup={shipment?.status === "PENDING_PICKUP"}
          photoCount={photos.length}
          tripType={tripType}
          onSendSMS={handleManualSMS}
          checkerReturnMode={canCheckerReturnToWarehouse}
          checkerActionPhase={isCheckerLastMile ? checkerNextAction : null}
        />
      )}

      <ReportIssueModal
        visible={isIssueModalVisible}
        onClose={() => setIsIssueModalVisible(false)}
        onSubmit={handleReportIssue}
        isPickup={shipment?.status === "PENDING_PICKUP"}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f1f5f9",
  },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 120,
  },

  timelineCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    marginBottom: 16,
  },

  timelineTitle: {
    fontSize: 15,
    fontWeight: "800",
  },

  timelineSubtitle: {
    fontSize: 12,
    marginTop: 4,
    marginBottom: 12,
  },

  notificationCard: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#d1fae5",
    padding: 14,
    marginTop: 16,
  },

  notificationTitle: {
    color: "#0f172a",
    fontSize: 14,
    fontWeight: "800",
  },

  notificationSubtitle: {
    color: "#64748b",
    fontSize: 12,
    marginTop: 4,
    marginBottom: 12,
  },

  notificationGrid: {
    flexDirection: "row",
    gap: 8,
  },

  notificationOption: {
    flex: 1,
    minHeight: 42,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    backgroundColor: "#f8fafc",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: 8,
  },

  notificationOptionActive: {
    borderColor: "#34d399",
    backgroundColor: "#ecfdf5",
  },

  notificationOptionText: {
    color: "#64748b",
    fontSize: 12,
    fontWeight: "800",
  },

  notificationOptionTextActive: {
    color: "#047857",
  },
});
