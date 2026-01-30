import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Alert,
  ActivityIndicator,
  SafeAreaView,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { getFunctions, httpsCallable } from "firebase/functions";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../../firebase";

// ✅ IMPORT NEW COMPONENTS
import ShipmentHeader from "../../components/checker/shipment-details/ShipmentHeader";
import ShipmentSearch from "../../components/checker/shipment-details/ShipmentSearch";
import PackageListItem from "../../components/checker/shipment-details/PackageListItem";

export default function ShipmentDetailsScreen() {
  const { shipmentId, parentTripId, parentPlate } = useLocalSearchParams();
  const router = useRouter();

  const [search, setSearch] = useState("");
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // 1. FETCH PACKAGES
  useEffect(() => {
    if (!shipmentId) return;
    const shipmentRef = doc(db, "shipments", shipmentId);

    const unsubscribe = onSnapshot(
      shipmentRef,
      (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          setPackages(data.packages || []);
        } else {
          Alert.alert("Error", "Shipment not found!");
          router.back();
        }
        setLoading(false);
      },
      (error) => {
        console.error("Error fetching shipment:", error);
        setLoading(false);
      },
    );
    return () => unsubscribe();
  }, [shipmentId]);

  // 2. FILTER
  const filtered = packages.filter((p) =>
    (p.trackingNumber || "").toLowerCase().includes(search.toLowerCase()),
  );

  // 3. ACTIONS
  const updateStatus = async (pkg, newMode) => {
    setActionLoading(true);
    try {
      const functions = getFunctions(undefined, "asia-southeast1");
      const scanPackages = httpsCallable(functions, "scanPackages");

      const result = await scanPackages({
        barcode: pkg.trackingNumber,
        mode: newMode,
      });

      Alert.alert("Success", result.data.message);
    } catch (error) {
      console.error(error);
      Alert.alert("Error", error.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handlePackagePress = (pkg) => {
    Alert.alert(
      "Update Package",
      `ID: ${pkg.trackingNumber}\nStatus: ${pkg.status}`,
      [
        {
          text: "Mark Out for Delivery",
          onPress: () => updateStatus(pkg, "out_for_delivery"),
        },
        {
          text: "Mark Delivered",
          onPress: () => updateStatus(pkg, "delivered"),
        },
        { text: "Cancel", style: "cancel" },
      ],
    );
  };

  // ✅ REPLACE WITH THIS SIMPLE VERSION
  const handleBack = () => {
    if (router.canGoBack()) {
      router.back(); // Slides back to previous screen nicely
    } else {
      // Fallback: If opened via notification/deep link, go to Dashboard
      router.replace("/(checker)/(tabs)/trips");
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* 1. HEADER */}
      <ShipmentHeader shipmentId={shipmentId} onBack={handleBack} />

      {/* 2. LOADING OVERLAY */}
      {actionLoading && (
        <View style={styles.loaderOverlay}>
          <ActivityIndicator size="large" color="#3b82f6" />
        </View>
      )}

      {/* 3. SEARCH */}
      <ShipmentSearch value={search} onChange={setSearch} />

      {/* 4. LIST */}
      {loading ? (
        <View style={{ flex: 1, justifyContent: "center" }}>
          <ActivityIndicator size="large" color="#3b82f6" />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.trackingNumber}
          contentContainerStyle={{ paddingBottom: 100 }}
          renderItem={({ item }) => (
            <PackageListItem item={item} onPress={handlePackagePress} />
          )}
          ListEmptyComponent={
            <Text style={styles.emptyText}>No packages in this shipment.</Text>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0f172a" },
  loaderOverlay: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(15, 23, 42, 0.9)",
    zIndex: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyText: { textAlign: "center", color: "#64748b", marginTop: 40 },
});
