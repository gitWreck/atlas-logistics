import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  ActivityIndicator,
  Alert,
  TouchableOpacity,
  Image as RNImage, // Rename native Image to avoid conflict if using expo-image
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { doc, getDoc } from "firebase/firestore";
import { getFunctions, httpsCallable } from "firebase/functions";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import * as ImagePicker from "expo-image-picker";
import { FontAwesome5 } from "@expo/vector-icons";
import GetLocation from "react-native-get-location";

import { db, storage } from "../../firebase"; // Ensure 'storage' is exported from your firebase config
import { StatusBar } from "expo-status-bar";
import { Image } from "expo-image";

// IMPORTS
import ShipmentHeaderCard from "../../components/driver/shipment/ShipmentHeaderCard";
import PackageItemCard from "../../components/driver/shipment/PackageItemCard";
import GradientButton from "../../components/ui/figma/GradientButton";
import {
  updateShipmentPackages,
  updateShipmentStatus,
} from "../../components/utilities/FirebaseFunctions";

export default function ShipmentDetailsScreen() {
  const { shipmentId, tripId } = useLocalSearchParams();
  const router = useRouter();

  const [shipment, setShipment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // ✅ NEW STATE: Photos
  const [photos, setPhotos] = useState([]);

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

  // 3. Image Pickers
  const pickImage = async (useCamera) => {
    if (photos.length >= 3) {
      Alert.alert("Limit Reached", "You can only upload up to 3 photos.");
      return;
    }

    let result;
    const options = {
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.5, // Compress to save data
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

  // 5. Updated Handle Action
  const handleAction = async () => {
    if (!shipment) return;
    setActionLoading(true);

    try {
      // const functions = getFunctions(undefined, "asia-southeast1");
      // const updateFn = httpsCallable(functions, "updateShipmentStatus");
      const location = await getCurrentLocationSafe();

      // CASE A: Mark Out For Delivery
      if (shipment.status === "ARRIVED") {
        await updateShipmentStatus({
          shipmentId,
          tripId,
          newStatus: "OUT_FOR_DELIVERY",
          location,
        });

        Alert.alert("Success", "Shipment is now Out for Delivery.");
        setShipment((prev) => ({ ...prev, status: "OUT_FOR_DELIVERY" }));
      } else if (
        shipment.status === "LOADED" ||
        shipment.status === "IN_TRANSIT"
      ) {
        Alert.alert(
          "Action Blocked",
          "This shipment must be marked as ARRIVED at the warehouse before it can be taken out for delivery.",
        );
        return;
      }
      // CASE B: Complete Delivery (With Photos)
      else if (shipment.status === "OUT_FOR_DELIVERY") {
        // 1. Validation (Optional: Require at least 1 photo)
        if (photos.length === 0) {
          Alert.alert(
            "Proof Required",
            "Please take at least one photo of the delivery.",
          );
          setActionLoading(false);
          return;
        }

        // 2. Upload Photos
        const photoUrls = await uploadPhotos();

        // 3. Call Cloud Function
        await updateShipmentStatus({
          shipmentId,
          tripId,
          newStatus: "DELIVERED",
          location,
          // Pass the URLs in remarks or a specific field if your CF supports it
          remarks: `Proof of Delivery: ${photoUrls.length} images uploaded.`,
          proofOfDelivery: photoUrls,
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

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <FontAwesome5 name="arrow-left" size={20} color="#0f172a" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Shipment Details</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <ShipmentHeaderCard shipment={shipment} />

        {/* ✅ PROOF OF DELIVERY SECTION (Only Show when Out For Delivery) */}
        {isOutForDelivery && (
          <View style={styles.proofContainer}>
            <Text style={styles.sectionTitle}>Proof of Delivery</Text>
            <Text style={styles.helperText}>
              Take up to 3 photos of the delivered items.
            </Text>

            <View style={styles.photoRow}>
              {/* Photo Thumbnails */}
              {photos.map((uri, index) => (
                <View key={index} style={styles.photoWrapper}>
                  <Image source={{ uri }} style={styles.thumbnail} />
                  <TouchableOpacity
                    style={styles.removeBtn}
                    onPress={() => removePhoto(index)}
                  >
                    <FontAwesome5 name="times" size={10} color="#fff" />
                  </TouchableOpacity>
                </View>
              ))}

              {/* Add Button (Hide if 3 photos) */}
              {photos.length < 3 && (
                <TouchableOpacity
                  style={styles.addPhotoBtn}
                  onPress={() => {
                    Alert.alert("Add Photo", "Choose a source", [
                      { text: "Camera", onPress: () => pickImage(true) },
                      { text: "Gallery", onPress: () => pickImage(false) },
                      { text: "Cancel", style: "cancel" },
                    ]);
                  }}
                >
                  <FontAwesome5 name="camera" size={24} color="#3b82f6" />
                  <Text style={styles.addPhotoText}>Add</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}

        <Text style={styles.sectionTitle}>Packages ({packages.length})</Text>
        {packages.length > 0 ? (
          packages.map((pkg, i) => (
            <PackageItemCard key={i} pkg={pkg} index={i} />
          ))
        ) : (
          <Text style={styles.emptyText}>No package details available.</Text>
        )}
      </ScrollView>

      {/* Footer Action */}
      <View style={styles.footer}>
        <GradientButton
          title={
            shipment.status === "OUT_FOR_DELIVERY"
              ? "Complete Delivery"
              : shipment.status === "ARRIVED"
                ? "Mark Out for Delivery" // Only show this if Arrived
                : "Waiting for Arrival" // Show this if Loaded
          }
          disabled={shipment.status === "LOADED" || actionLoading} // Disable if Loaded
          onPress={handleAction}
          loading={actionLoading}
          // Optional: Change color based on status
          colors={isOutForDelivery ? ["#16a34a", "#15803d"] : undefined}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f1f5f9" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: {
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 15,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  headerTitle: {
    color: "#0f172a",
    fontSize: 16,
    fontWeight: "bold",
    marginLeft: 16,
  },
  scrollContent: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 120 },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0f172a",
    marginTop: 24,
    marginBottom: 8,
  },
  emptyText: { color: "#64748b", fontStyle: "italic", marginTop: 10 },
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 34,
    backgroundColor: "#ffffff",
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
  },

  // ✅ NEW STYLES FOR PHOTOS
  proofContainer: { marginTop: 20 },
  helperText: { fontSize: 13, color: "#64748b", marginBottom: 12 },
  photoRow: { flexDirection: "row", gap: 12 },
  photoWrapper: {
    width: 80,
    height: 80,
    borderRadius: 12,
    overflow: "hidden",
    position: "relative",
  },
  thumbnail: { width: "100%", height: "100%" },
  removeBtn: {
    position: "absolute",
    top: 4,
    right: 4,
    backgroundColor: "rgba(0,0,0,0.6)",
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  addPhotoBtn: {
    width: 80,
    height: 80,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#cbd5e1",
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
  },
  addPhotoText: {
    fontSize: 12,
    color: "#3b82f6",
    fontWeight: "600",
    marginTop: 4,
  },
});
