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
import { FontAwesome5 } from "@expo/vector-icons"; // ✅ ADD THIS
import { Image } from "expo-image"; // ✅ ADD THIS (or from 'react-native')

// IMPORT NEW MODULAR COMPONENTS
import ShipmentDetailHeader from "../../components/driver/shipment/ShipmentDetailHeader";
import ShipmentHeaderCard from "../../components/driver/shipment/ShipmentHeaderCard";
import ProofOfDeliverySection from "../../components/driver/shipment/ProofOfDeliverySection";
import PackageItemCard from "../../components/driver/shipment/PackageItemCard";
import ShipmentActionFooter from "../../components/driver/shipment/ShipmentActionFooter";

export default function ShipmentDetailsScreen() {
  const { shipmentId, tripId } = useLocalSearchParams();
  const router = useRouter();

  const [shipment, setShipment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [photos, setPhotos] = useState([]);

  const [selectedImage, setSelectedImage] = useState(null); // ✅ NEW
  const [isImageModalVisible, setIsImageModalVisible] = useState(false); // ✅ NEW

  const openImage = (url) => {
    setSelectedImage(url);
    setIsImageModalVisible(true);
  };

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
      const filename = `proof_of_delivery_${shipmentId}_${Date.now()}_${i}.jpg`;
      const storageRef = ref(storage, `shipments/${shipmentId}/${filename}`);

      const response = await fetch(uri);
      const blob = await response.blob();

      await uploadBytes(storageRef, blob);
      const url = await getDownloadURL(storageRef);
      urls.push(url);
    }
    return urls;
  };

  // 5. Handle Action
  // 5. Handle Action
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
          proofOfReceipt: photoUrls, // Sent to receipt array
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
        const photoUrls = await uploadPhotos();
        await updateShipmentStatus({
          shipmentId,
          tripId,
          newStatus: "DELIVERED",
          location,
          remarks: `Proof of Delivery: ${photoUrls.length} images uploaded.`,
          proofOfDelivery: photoUrls, // Sent to delivery array
        });
        Alert.alert("Success", "Delivery Completed!");
        router.back();
      }
    } catch (error) {
      console.error(error);
      Alert.alert("Error", error.message || "Action failed.");
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
  const isOutForDelivery = shipment?.status === "OUT_FOR_DELIVERY";

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />

      {/* 1. Header Component */}
      <ShipmentDetailHeader onBack={() => router.back()} />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* 2. Main Shipment Details */}
        <ShipmentHeaderCard shipment={shipment} />

        {/* --- NEW: DISPLAY EXISTING PROOFS --- */}
        {(shipment?.proofOfReceipt?.length > 0 ||
          shipment?.proofOfDelivery?.length > 0) && (
          <View style={{ marginTop: 16 }}>
            <Text style={[styles.sectionTitle, { marginTop: 0 }]}>
              Uploaded Proofs
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {/* Show Proof of Receipt (Pickup) */}
              {shipment?.proofOfReceipt?.map((url, index) => (
                <View key={`receipt-${index}`} style={{ marginRight: 12 }}>
                  <Image
                    source={{ uri: url }}
                    style={{
                      width: 120,
                      height: 120,
                      borderRadius: 12,
                      backgroundColor: "#e2e8f0",
                    }}
                    contentFit="cover"
                  />
                  <Text
                    style={{
                      fontSize: 10,
                      color: "#64748b",
                      marginTop: 4,
                      textAlign: "center",
                    }}
                  >
                    Receipt
                  </Text>
                </View>
              ))}

              {/* Show Proof of Delivery (Dropoff) */}
              {shipment?.proofOfDelivery?.map((url, index) => (
                <View key={`delivery-${index}`} style={{ marginRight: 12 }}>
                  <Image
                    source={{ uri: url }}
                    style={{
                      width: 120,
                      height: 120,
                      borderRadius: 12,
                      backgroundColor: "#e2e8f0",
                    }}
                    contentFit="cover"
                  />
                  <Text
                    style={{
                      fontSize: 10,
                      color: "#64748b",
                      marginTop: 4,
                      textAlign: "center",
                    }}
                  >
                    Delivery
                  </Text>
                </View>
              ))}
            </ScrollView>
          </View>
        )}

        {/* 3. Proof of Delivery Component (Conditional) */}
        {isOutForDelivery && (
          <ProofOfDeliverySection
            photos={photos}
            onPickImage={pickImage}
            onRemovePhoto={removePhoto}
          />
        )}

        {/* 4. Packages List */}
        <Text style={styles.sectionTitle}>Packages ({packages.length})</Text>
        {packages.length > 0 ? (
          packages.map((pkg, i) => (
            <PackageItemCard key={i} pkg={pkg} index={i} />
          ))
        ) : (
          <Text style={styles.emptyText}>No package details available.</Text>
        )}
      </ScrollView>

      {/* 5. Footer Action Component */}
      <ShipmentActionFooter
        status={shipment.status}
        actionLoading={actionLoading}
        onAction={handleAction}
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
  emptyText: { color: "#64748b", fontStyle: "italic", marginTop: 10 },
});
