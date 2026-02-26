import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Alert,
  ActivityIndicator,
  SafeAreaView,
  TouchableOpacity,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { getFunctions, httpsCallable } from "firebase/functions";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../../firebase";
import GetLocation from "react-native-get-location";

// ✅ IMPORT NEW COMPONENTS
import ShipmentHeader from "../../components/checker/shipment-details/ShipmentHeader";
import ShipmentSearch from "../../components/checker/shipment-details/ShipmentSearch";
import PackageListItem from "../../components/checker/shipment-details/PackageListItem";

import PackageActionModal from "../../components/checker/shipment-details/PackageActionModal";
import {
  reportCheckerTrip,
  updateShipmentPackages,
} from "../../components/utilities/FirebaseFunctions";

export default function ShipmentDetailsScreen() {
  const { shipmentId, parentTripId, parentPlate } = useLocalSearchParams();
  const router = useRouter();

  const [search, setSearch] = useState("");
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // ✅ NEW STATE FOR SELECTION & MODAL
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [modalVisible, setModalVisible] = useState(false);
  const [targetPackage, setTargetPackage] = useState(null); // null if bulk action

  const getCurrentLocationSafe = async () => {
    try {
      const loc = await GetLocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 15000,
      });

      if (!loc) return null;
      return {
        lat: loc.latitude,
        lng: loc.longitude,
      };
    } catch (error) {
      console.log("Location error (checker shipment-details):", error);
      return null;
    }
  };

  const executeAction = async (actionCode, { sendText }) => {
    setActionLoading(true);
    try {
      // const functions = getFunctions(undefined, "asia-southeast1");
      // const reportCheckerTrip = httpsCallable(functions, "reportCheckerTrip");
      // const sendManualSms = httpsCallable(functions, "sendManualSms");

      const location = await getCurrentLocationSafe();
      const trackingId = targetPackage?.trackingNumber || shipmentId;

      // 1. UPDATE DATABASE FIRST
      const dbResult = await reportCheckerTrip({
        shipmentId: trackingId,
        tripId: tripId,
        actionCode: actionCode,
        sendText: sendText,
        location: location,
      });

      Alert.alert(
        "Success",
        `Updated status to ${actionCode.replace(/_/g, " ")}` +
          (sendText && dbResult.data.phone
            ? "\nCustomer notified via SMS."
            : ""),
      );

      setModalVisible(false); // Closes the modal
      setTargetPackage(null); // Clears the selection
    } catch (error) {
      console.error(error);
      Alert.alert("Error", error.message);
    } finally {
      setActionLoading(false);
    }
  };

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

  // ✅ SELECTION HELPERS
  const handleSelectAll = () => {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set()); // Deselect All
    } else {
      const allIds = new Set(filtered.map((p) => p.trackingNumber));
      setSelectedIds(allIds);
    }
  };

  const toggleSelection = (id) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedIds(newSet);
  };

  // ✅ UPDATED ACTION HANDLER (Handles Single & Bulk)
  // const executeAction = async (newMode) => {
  //   setActionLoading(true);

  //   // STEP 1: Decide WHO to update
  //   // If 'targetPackage' exists (Menu Press), we create a Set with JUST that one ID.
  //   // If 'targetPackage' is null (Bulk Button), we use the 'selectedIds' Set.
  //   const idsToUpdate = targetPackage
  //     ? new Set([targetPackage.trackingNumber])
  //     : selectedIds;

  //   // STEP 2: Create the NEW full list
  //   // We loop through the CURRENT full list of packages.
  //   const updatedPackages = packages.map((pkg) => {
  //     // If this package's ID is in our "idsToUpdate" set...
  //     if (idsToUpdate.has(pkg.trackingNumber)) {
  //       // ...we clone it and change its status.
  //       return { ...pkg, status: newMode };
  //     }
  //     // Otherwise, keep it exactly as it is.
  //     return pkg;
  //   });

  //   try {
  //     console.log("updated packages: ", updatedPackages.trim());
  //     console.log("shipment id: ", shipmentId.trim());

  //     // const functions = getFunctions(undefined, "asia-southeast1");
  //     // const updateFn = httpsCallable(functions, "updateShipmentPackages");

  //     // STEP 3: Send the ENTIRE list (with the changes) to the server
  //     await updateShipmentPackages({
  //       shipmentId: shipmentId.trim(),
  //       packages: updatedPackages, // This contains 99 unchanged items + 1 updated item
  //     });

  //     Alert.alert("Success", `Updated status to ${newMode}`);

  //     // Cleanup
  //     setSelectedIds(new Set());
  //     setTargetPackage(null);
  //     setModalVisible(false); // Don't forget to close the modal!
  //   } catch (error) {
  //     console.error("Update Error:", error);
  //     Alert.alert("Update Failed", error.message);
  //   } finally {
  //     setActionLoading(false);
  //   }
  // };

  // ✅ UPDATED PRESS HANDLERS
  const handleMenuPress = (pkg) => {
    // If we are in "Selection Mode", tap acts like selection
    if (selectedIds.size > 0) {
      toggleSelection(pkg.trackingNumber);
      return;
    }

    // Otherwise, open the Single Action Modal
    setTargetPackage(pkg);
    setModalVisible(true);
  };

  const handleLongPress = (pkg) => {
    toggleSelection(pkg.trackingNumber);
    // Optional: Provide haptic feedback here
  };
  const handleBulkButtonPress = () => {
    setTargetPackage(null); // Indicates bulk mode
    setModalVisible(true);
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
          <ActivityIndicator size="large" color="#042C83" />
        </View>
      )}

      {/* ✅ SELECT ALL BAR */}
      <View style={styles.selectionBar}>
        <TouchableOpacity onPress={handleSelectAll}>
          <Text style={styles.selectText}>
            {selectedIds.size === filtered.length && filtered.length > 0
              ? "Deselect All"
              : "Select All"}
          </Text>
        </TouchableOpacity>
        <Text style={styles.countText}>{selectedIds.size} selected</Text>
      </View>

      {/* 3. SEARCH */}
      <ShipmentSearch value={search} onChange={setSearch} />

      {/* 4. LIST */}
      {loading ? (
        <View style={styles.loadingWrapper}>
          <ActivityIndicator size="large" color="#042C83" />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.trackingNumber}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => {
            const isSelected = selectedIds.has(item.trackingNumber);
            return (
              <View
                style={[
                  styles.itemWrapper,
                  isSelected && styles.selectedWrapper,
                ]}
              >
                <PackageListItem
                  item={item}
                  onMenuPress={handleMenuPress} // Tap the dots -> Open Modal
                  onLongPress={handleLongPress} // Hold -> Select
                  selected={selectedIds.has(item.trackingNumber)}
                />
                {/* Visual Indicator Overlay if PackageListItem can't be modified */}
                {isSelected && (
                  <View style={styles.selectionOverlay} pointerEvents="none" />
                )}
              </View>
            );
          }}
          ListEmptyComponent={
            <Text style={styles.emptyText}>No packages in this shipment.</Text>
          }
        />
      )}
      {/* ✅ BULK ACTION BUTTON (Floating) */}
      {selectedIds.size > 0 && (
        <View style={styles.floatingBar}>
          <TouchableOpacity
            style={styles.bulkBtn}
            onPress={handleBulkButtonPress}
          >
            <Text style={styles.bulkBtnText}>
              Update {selectedIds.size} Selected
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ✅ ACTION MODAL */}
      <PackageActionModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        count={targetPackage ? 1 : selectedIds.size}
        onAction={executeAction}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f1f5f9" },
  loaderOverlay: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(15, 23, 42, 0.15)",
    zIndex: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingWrapper: { flex: 1, justifyContent: "center", alignItems: "center" },
  listContent: { paddingBottom: 120 },
  emptyText: { textAlign: "center", color: "#475569", marginTop: 40 },

  // New Styles
  selectionBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
    backgroundColor: "#fff",
  },
  selectText: { color: "#3b82f6", fontWeight: "600" },
  countText: { color: "#64748b" },
  itemWrapper: {
    borderRadius: 12,
    marginHorizontal: 20,
    marginVertical: 6,
    overflow: "hidden",
  },
  selectedWrapper: {
    borderWidth: 2,
    borderColor: "#3b82f6",
    backgroundColor: "#eff6ff",
  },
  selectionOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(59, 130, 246, 0.1)",
  },

  floatingBar: {
    position: "absolute",
    bottom: 20,
    left: 20,
    right: 20,
    zIndex: 10,
  },
  bulkBtn: {
    backgroundColor: "#042C83",
    padding: 16,
    borderRadius: 16,
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 4 },
  },
  bulkBtnText: { color: "#fff", fontWeight: "bold", fontSize: 16 },
});
