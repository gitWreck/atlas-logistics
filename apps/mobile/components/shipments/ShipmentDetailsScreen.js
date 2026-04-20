import React, { useEffect, useState } from "react";
import {
  View,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { doc, getDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import * as ImagePicker from "expo-image-picker";
import { StatusBar } from "expo-status-bar";

import { db, storage } from "../../firebase";
import { useAuth } from "../../contexts/AuthContext.js";
import { getCurrentLocationSafe } from "../utilities/helpers";
import {
  updateShipmentStatus,
  updateShipmentPackages,
  sendManualSMS,
} from "../utilities/FirebaseFunctions";

import ShipmentDetailHeader from "../driver/shipment/ShipmentDetailHeader";
import ShipmentHeaderCard from "../driver/shipment/ShipmentHeaderCard";
import ShipmentActionFooter from "../driver/shipment/ShipmentActionFooter";

import ReportIssueModal from "../driver/shipment/ReportIssueModal";

import PhotoUploadSection from "../driver/shipment/PhotoUploadSection";
import ExistingProofsViewer from "../tracking/ExistingProofsViewer";

import ShipmentPackagesPanel from "./details/ShipmentPackagesPanel";

export default function ShipmentDetailsScreen() {
  const { shipmentId, tripId, tripType, parentTripId } = useLocalSearchParams();
  const router = useRouter();
  const { isChecker, isDriver } = useAuth();

  const resolvedTripId = parentTripId || tripId;

  const [shipment, setShipment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const [photos, setPhotos] = useState([]);
  const [isIssueModalVisible, setIsIssueModalVisible] = useState(false);
  const [actionMessage, setActionMessage] = useState("");

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

  const handleAction = async () => {
    if (!shipment) return;

    setActionLoading(true);

    try {
      const location = await getCurrentLocationSafe();

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
        });

        Alert.alert("Success", "Package collected successfully.");
        router.back();
        return;
      }

      if (shipment.status === "ARRIVED") {
        await updateShipmentStatus({
          shipmentId,
          tripId: resolvedTripId,
          newStatus: "OUT_FOR_DELIVERY",
          location,
        });

        Alert.alert("Success", "Shipment is now Out for Delivery.");
        setShipment((prev) => ({ ...prev, status: "OUT_FOR_DELIVERY" }));
        setActionLoading(false);
        return;
      }

      if (shipment.status === "LOADED" || shipment.status === "IN_TRANSIT") {
        Alert.alert(
          "Action Blocked",
          "This shipment must be marked as ARRIVED at the warehouse before it can be taken out for delivery.",
        );
        setActionLoading(false);
        return;
      }

      if (shipment.status === "OUT_FOR_DELIVERY") {
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

            await updateShipmentStatus({
              shipmentId,
              tripId: resolvedTripId,
              newStatus: "DELIVERED",
              location,
              remarks: `Proof of Delivery: ${photoUrls.length} images uploaded.`,
              proofOfDelivery: photoUrls,
              paymentStatus: shipment.isCOD ? "COLLECTED_BY_DRIVER" : "PAID",
            });

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
      Alert.alert("Error", error.message || "Action failed.");
      setActionLoading(false);
    }
  };

  const handleReportIssue = async (reasonId, reasonText) => {
    setIsIssueModalVisible(false);
    setActionLoading(true);

    try {
      const location = await getCurrentLocationSafe();
      const newStatus =
        shipment.status === "PENDING_PICKUP"
          ? "FAILED_PICKUP"
          : "FAILED_DELIVERY";

      await updateShipmentStatus({
        shipmentId,
        tripId: resolvedTripId,
        newStatus,
        location,
        remarks: `Exception: ${reasonText} (${reasonId})`,
      });

      Alert.alert(
        "Issue Reported",
        `The shipment was marked as ${newStatus.replace(/_/g, " ")}.`,
      );
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
        reason: "driver_update",
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
      <View style={[styles.center, { backgroundColor: "#f1f5f9" }]}>
        <ActivityIndicator size="large" color="#042C83" />
      </View>
    );
  }

  if (!shipment) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar style="dark" />
        <ShipmentDetailHeader onBack={() => router.back()} />
      </SafeAreaView>
    );
  }

  const packages = shipment?.packages || [];
  const needsPhotoUpload =
    shipment?.status === "PENDING_PICKUP" ||
    shipment?.status === "OUT_FOR_DELIVERY";

  const showFooter = isDriver && tripType !== "HUB_TRANSFER";
  const packagePanelEditable = isChecker;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />

      <ShipmentDetailHeader onBack={() => router.back()} />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <ShipmentHeaderCard shipment={shipment} />

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
          onAction={handleAction}
          onReportIssue={() => setIsIssueModalVisible(true)}
          message={actionMessage}
          onMessageChange={setActionMessage}
          isPickup={shipment?.status === "PENDING_PICKUP"}
          photoCount={photos.length}
          tripType={tripType}
          onSendSMS={handleManualSMS}
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
  container: { flex: 1, backgroundColor: "#f1f5f9" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 120,
  },
});
