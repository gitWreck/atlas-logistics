import React, { useState, useEffect } from "react";
import {
  View,
  Text,
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
import GetLocation from "react-native-get-location";
import { StatusBar } from "expo-status-bar";

import { db, storage } from "../../firebase";
import { updateShipmentStatus } from "../../components/utilities/FirebaseFunctions";

// COMPONENTS
import ShipmentDetailHeader from "../../components/driver/shipment/ShipmentDetailHeader";
import ShipmentHeaderCard from "../../components/driver/shipment/ShipmentHeaderCard";
import PhotoUploadSection from "../../components/driver/shipment/PhotoUploadSection";
import PackageTable from "../../components/driver/shipment/PackageTable";
import ShipmentActionFooter from "../../components/driver/shipment/ShipmentActionFooter";
import ExistingProofsViewer from "../../components/driver/shipment/ExistingProofsViewer";
import ReportIssueModal from "../../components/driver/shipment/ReportIssueModal";

export default function ShipmentDetailsScreen() {
  const { shipmentId, tripId, tripType } = useLocalSearchParams();
  const router = useRouter();

  const [shipment, setShipment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [photos, setPhotos] = useState([]);
  const [isIssueModalVisible, setIsIssueModalVisible] = useState(false);

  // 1. Fetch Shipment
  useEffect(() => {
    if (!shipmentId) return;
    const fetchDetails = async () => {
      try {
        const docRef = doc(db, "shipments", shipmentId);
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          setShipment({ id: snap.id, ...snap.data() });
        } else {
          Alert.alert("Error", "Shipment data not found");
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchDetails();
  }, [shipmentId]);

  // 2. Location Helper
  const getCurrentLocationSafe = async () => {
    try {
      const loc = await GetLocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 15000,
      });
      return { lat: loc.latitude, lng: loc.longitude };
    } catch (error) {
      console.log("Location error:", error);
      return null;
    }
  };

  // 3. Image Picker Logic
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
      setPhotos([...photos, result.assets[0].uri]);
    }
  };

  const removePhoto = (index) => {
    const newPhotos = [...photos];
    newPhotos.splice(index, 1);
    setPhotos(newPhotos);
  };

  // 4. Upload Logic
  const uploadPhotos = async () => {
    const urls = [];
    for (let i = 0; i < photos.length; i++) {
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

  // 5. Handle Action (Happy Path & COD)
  const handleAction = async () => {
    if (!shipment) return;
    setActionLoading(true);

    try {
      const location = await getCurrentLocationSafe();

      // CASE A: Local Pickup Collection
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
          tripId,
          newStatus: "PICKED_UP",
          location,
          remarks: `Proof of Receipt: ${photoUrls.length} images uploaded.`,
          proofOfReceipt: photoUrls,
        });
        Alert.alert("Success", "Package collected successfully!");
        router.back();
      }

      // CASE B: Hub-to-Hub Marking Out For Delivery
      else if (shipment.status === "ARRIVED") {
        await updateShipmentStatus({
          shipmentId,
          tripId,
          newStatus: "OUT_FOR_DELIVERY",
          location,
        });
        Alert.alert("Success", "Shipment is now Out for Delivery.");
        setShipment((prev) => ({ ...prev, status: "OUT_FOR_DELIVERY" }));
        setActionLoading(false);
      }

      // Prevent Invalid Hub Actions
      else if (
        shipment.status === "LOADED" ||
        shipment.status === "IN_TRANSIT"
      ) {
        Alert.alert(
          "Action Blocked",
          "This shipment must be marked as ARRIVED at the warehouse before it can be taken out for delivery.",
        );
        setActionLoading(false);
        return;
      }

      // CASE C: Complete Final Delivery
      else if (shipment.status === "OUT_FOR_DELIVERY") {
        if (photos.length === 0) {
          Alert.alert(
            "Proof Required",
            "Please take at least one photo of the delivery.",
          );
          setActionLoading(false);
          return;
        }

        // The core completion logic wrapped in a reusable function
        const executeDeliveryCompletion = async () => {
          setActionLoading(true);
          try {
            const photoUrls = await uploadPhotos();

            await updateShipmentStatus({
              shipmentId,
              tripId,
              newStatus: "DELIVERED",
              location,
              remarks: `Proof of Delivery: ${photoUrls.length} images uploaded.`,
              proofOfDelivery: photoUrls,
              paymentStatus: shipment.isCOD ? "COLLECTED_BY_DRIVER" : "PAID",
            });

            Alert.alert("Success", "Delivery Completed!");
            router.back();
          } catch (err) {
            console.error(err);
            Alert.alert("Error", err.message || "Failed to complete delivery.");
          } finally {
            setActionLoading(false);
          }
        };

        // Intercept COD Deliveries
        if (shipment.isCOD && shipment.paymentStatus !== "PAID") {
          setActionLoading(false); // Stop the spinner while waiting for user input
          Alert.alert(
            "⚠️ CASH COLLECTION REQUIRED",
            `Do you have exactly ₱${shipment.codAmount?.toLocaleString()} in your hand from the customer?`,
            [
              { text: "No, cancel", style: "cancel" },
              {
                text: "Yes, Cash Collected",
                style: "destructive",
                onPress: executeDeliveryCompletion,
              },
            ],
          );
        } else {
          // If not COD, just proceed normally
          await executeDeliveryCompletion();
        }
      }
    } catch (error) {
      console.error(error);
      Alert.alert("Error", error.message || "Action failed.");
      setActionLoading(false);
    }
  };

  // 6. Handle Issue Reporting (Unhappy Path)
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
        tripId,
        newStatus,
        location,
        remarks: `Exception: ${reasonText} (${reasonId})`,
      });

      Alert.alert(
        "Issue Reported",
        `The shipment was marked as ${newStatus.replace("_", " ")}.`,
      );
      router.back();
    } catch (error) {
      console.error(error);
      Alert.alert("Error", error.message || "Failed to report issue.");
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

  const packages = shipment?.packages || [];
  const needsPhotoUpload =
    shipment?.status === "PENDING_PICKUP" ||
    shipment?.status === "OUT_FOR_DELIVERY";

  console.log("tripType", tripType);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />

      {/* Header Component */}
      <ShipmentDetailHeader onBack={() => router.back()} />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Main Shipment Details (Contains the new COD Banner) */}
        <ShipmentHeaderCard shipment={shipment} />

        {/* Existing Proofs */}
        <ExistingProofsViewer
          proofOfReceipt={shipment.proofOfReceipt}
          proofOfDelivery={shipment.proofOfDelivery}
        />

        {/* Photo Upload (Dynamic Title) */}
        {needsPhotoUpload && (
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

        {/* --- DYNAMIC UI: ONLY SHOW ACTIONS FOR LOCAL ROUTES --- */}
        {tripType !== "HUB_TRANSFER" && (
          <>
            {/* 4. Photo Upload (Dynamic Title) */}
            {needsPhotoUpload && (
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
          </>
        )}

        {/* Paginated Packages Table */}
        <Text style={styles.sectionTitle}>Packages ({packages.length})</Text>
        <PackageTable packages={packages} itemsPerPage={5} />
      </ScrollView>

      {/* --- ACTION FOOTER: HIDDEN FOR HUB-TO-HUB --- */}
      {tripType !== "HUB_TRANSFER" && (
        <ShipmentActionFooter
          status={shipment.status}
          actionLoading={actionLoading}
          onAction={handleAction}
          onReportIssue={() => setIsIssueModalVisible(true)}
        />
      )}
      {/* Report Issue Modal */}
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
  scrollContent: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 120 },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0f172a",
    marginTop: 24,
    marginBottom: 8,
  },
});
