import React, { useState, useEffect, useMemo } from "react";
import {
  View,
  StyleSheet,
  FlatList,
  Alert,
  ActivityIndicator,
  Text,
  SafeAreaView,
  RefreshControl,
  TextInput,
  TouchableOpacity,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { FontAwesome5 } from "@expo/vector-icons";
import {
  collection,
  onSnapshot,
  query,
  orderBy,
  doc,
} from "firebase/firestore";
import { db } from "../../firebase";
import GetLocation from "react-native-get-location";

// ✅ IMPORT COMPONENTS
import TripDetailsHeader from "../../components/checker/trip-details/TripDetailsHeader";
import ShipmentControls from "../../components/checker/trip-details/ShipmentControlsModal";
import ShipmentListItem from "../../components/checker/trip-details/ShipmentListItem";
import TripFooter from "../../components/checker/trip-details/TripFooter";
import {
  bulkShipmentAction,
  finishLoadingTruck,
} from "../../components/utilities/FirebaseFunctions";
import ShipmentActionModal from "../../components/checker/trip-details/ShipmentActionModal";
import TripFilterModal from "../../components/driver/trip/TripFilterModal"; // ✅ Import the Filter Modal
import ShipmentControlsModal from "../../components/checker/trip-details/ShipmentControlsModal";

// Define the filter options for shipments inside a trip
const SHIPMENT_FILTER_OPTIONS = [
  { label: "Show All", value: "ALL", icon: "list", color: "#64748b" },
  {
    label: "Assigned",
    value: "ASSIGNED",
    icon: "clipboard",
    color: "#64748b",
  },
  { label: "Loaded", value: "LOADED", icon: "arrow-up", color: "#3b82f6" },
  {
    label: "Unloaded",
    value: "UNLOADED",
    icon: "arrow-down",
    color: "#f59e0b",
  },
  {
    label: "Delivered",
    value: "DELIVERED",
    icon: "check-circle",
    color: "#10b981",
  },
];

export default function TripDetailsScreen() {
  const { tripId, plate } = useLocalSearchParams();
  const router = useRouter();

  const [search, setSearch] = useState("");
  const [shipments, setShipments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [trip, setTrip] = useState(null);

  const [selectedShipment, setSelectedShipment] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // ✅ NEW FILTER STATES
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [activeStatusFilter, setActiveStatusFilter] = useState("ALL");

  const [bulkModalVisible, setBulkModalVisible] = useState(false);

  const getCurrentLocationSafe = async () => {
    try {
      const loc = await GetLocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 15000,
      });

      if (!loc) return null;
      return { lat: loc.latitude, lng: loc.longitude };
    } catch (error) {
      console.log("Location error (checker trip-details):", error);
      return null;
    }
  };

  // 1. FETCH SHIPMENTS
  useEffect(() => {
    if (!tripId) return;
    const shipmentsRef = collection(
      db,
      "truck_trips",
      tripId,
      "trip_shipments",
    );
    const q = query(shipmentsRef, orderBy("createdAt", "desc"));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedShipments = snapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          destination: data.route || "No Route Info",
          status: data.status || "ASSIGNED",
          packageCount: data.totalItems || 0,
          loadedCount: data.loadedCount || 0,
        };
      });
      setShipments(fetchedShipments);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [tripId]);

  // 2. FETCH TRIP DOC
  useEffect(() => {
    if (!tripId) return;
    const unsubscribe = onSnapshot(
      doc(db, "truck_trips", tripId),
      (docSnap) => {
        if (docSnap.exists()) {
          setTrip({ id: docSnap.id, ...docSnap.data() });
        }
      },
    );
    return () => unsubscribe();
  }, [tripId]);

  // 3. ✅ UPDATED FILTER & SEARCH LOGIC
  const filteredData = useMemo(() => {
    let filtered = shipments;

    // A. Filter by Status
    if (activeStatusFilter !== "ALL") {
      filtered = filtered.filter((s) => s.status === activeStatusFilter);
    }

    // B. Filter by Search Text
    if (search) {
      const term = search.toLowerCase();
      filtered = filtered.filter(
        (s) =>
          s.id.toLowerCase().includes(term) ||
          s.destination.toLowerCase().includes(term),
      );
    }

    return filtered;
  }, [shipments, search, activeStatusFilter]);

  // 4. ACTIONS
  const updateStatus = async (ids, newStatus) => {
    if (ids.length === 0) return;
    setUpdating(true);
    try {
      const location = await getCurrentLocationSafe();
      await bulkShipmentAction({
        tripId: tripId,
        shipmentIds: ids,
        action: newStatus,
        ...(location ? { location } : {}),
      });

      Alert.alert(
        "Success",
        `Updated ${ids.length} shipment(s) to ${newStatus}`,
      );
    } catch (error) {
      Alert.alert("Error", error.message);
    } finally {
      setUpdating(false);
    }
  };

  const handleSingleAction = (shipment) => {
    setSelectedShipment(shipment);
    setModalVisible(true);
  };

  const onModalAction = (actionType) => {
    if (selectedShipment) {
      updateStatus([selectedShipment.id], actionType);
    }
  };

  const handleBulkStatusChange = (newStatus) => {
    const ids = filteredData.map((s) => s.id);
    if (ids.length === 0) {
      Alert.alert("No Shipments", "No shipments found to update.");
      return;
    }
    Alert.alert(
      "Confirm Bulk Update",
      `Mark ${ids.length} shipments as ${newStatus}?`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Confirm", onPress: () => updateStatus(ids, newStatus) },
      ],
    );
  };

  const handleFinishLoading = () => {
    if (!trip) return;
    if ((trip.totalLoaded || 0) === 0) {
      Alert.alert("Empty Truck", "You must scan at least one package.");
      return;
    }

    const total = trip.totalItems || 0;
    const loaded = trip.totalLoaded || 0;
    const message =
      loaded >= total
        ? "All items loaded. Release?"
        : `Only ${loaded}/${total} loaded. Release anyway?`;

    Alert.alert("Confirm Seal", message, [
      { text: "Cancel", style: "cancel" },
      {
        text: "SEAL TRUCK",
        onPress: async () => {
          setUpdating(true);
          try {
            await finishLoadingTruck({ tripId: tripId });
            Alert.alert("Success", "Truck marked as LOADED.");
            router.back();
          } catch (err) {
            Alert.alert("Error", err.message);
          } finally {
            setUpdating(false);
          }
        },
      },
    ]);
  };

  const handleShipmentPress = (item) => {
    router.push({
      pathname: "/(checker)/shipment-details",
      params: {
        shipmentId: item.id,
        parentTripId: tripId,
        parentPlate: plate,
      },
    });
  };

  const onRefresh = () => {
    setRefreshing(true);
    setTimeout(() => {
      setRefreshing(false);
    }, 1500);
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* 1. HEADER */}
      <TripDetailsHeader
        tripId={tripId}
        plate={plate}
        onBack={() => router.back()}
      />

      {/* 2. LOADING OVERLAY */}
      {updating && (
        <View style={styles.loaderOverlay}>
          <ActivityIndicator size="large" color="#042C83" />
          <Text style={styles.loaderText}>Updating...</Text>
        </View>
      )}

      {/* 3. SEARCH, FILTER & BULK ACTIONS ROW */}
      <View style={styles.searchRow}>
        {/* Search Input */}
        <View style={styles.searchContainer}>
          <FontAwesome5 name="search" size={16} color="#94a3b8" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search ID or dest..."
            placeholderTextColor="#94a3b8"
            value={search}
            onChangeText={setSearch}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch("")}>
              <FontAwesome5 name="times-circle" size={16} color="#94a3b8" />
            </TouchableOpacity>
          )}
        </View>

        {/* Filter Button */}
        <TouchableOpacity
          style={[
            styles.actionSquareBtn,
            activeStatusFilter !== "ALL" && {
              backgroundColor: "#e0f2fe",
              borderColor: "#38bdf8",
            },
          ]}
          onPress={() => setFilterModalVisible(true)}
        >
          <FontAwesome5
            name="sliders-h"
            size={16}
            color={activeStatusFilter !== "ALL" ? "#0284c7" : "#0f172a"}
          />
        </TouchableOpacity>

        {/* Bulk Actions Button */}
        <TouchableOpacity
          style={styles.actionSquareBtn}
          onPress={() => setBulkModalVisible(true)}
        >
          <FontAwesome5 name="layer-group" size={16} color="#0f172a" />
        </TouchableOpacity>
      </View>

      {/* 5. LIST */}
      {loading ? (
        <View style={styles.loadingWrapper}>
          <ActivityIndicator size="large" color="#042C83" />
        </View>
      ) : (
        <FlatList
          data={filteredData}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={["#042C83"]}
              tintColor="#042C83"
            />
          }
          renderItem={({ item }) => (
            <ShipmentListItem
              item={item}
              onPress={handleShipmentPress}
              onMenuPress={handleSingleAction}
            />
          )}
          ListEmptyComponent={
            <Text style={styles.emptyText}>
              {search || activeStatusFilter !== "ALL"
                ? "No shipments match your filters."
                : "No shipments assigned."}
            </Text>
          }
        />
      )}

      {/* 6. FOOTER */}
      <TripFooter trip={trip} onFinish={handleFinishLoading} />

      {/* 7. ACTION MODAL */}
      <ShipmentActionModal
        visible={modalVisible}
        shipment={selectedShipment}
        onClose={() => setModalVisible(false)}
        onAction={onModalAction}
      />

      {/* ✅ 8. FILTER MODAL */}
      <TripFilterModal
        visible={filterModalVisible}
        onClose={() => setFilterModalVisible(false)}
        activeFilter={activeStatusFilter}
        onApplyFilter={setActiveStatusFilter}
        options={SHIPMENT_FILTER_OPTIONS}
      />

      {/* 9. BULK ACTION MODAL */}
      <ShipmentControlsModal
        visible={bulkModalVisible}
        onClose={() => setBulkModalVisible(false)}
        onBulkOutForDelivery={() => handleBulkStatusChange("OUT_FOR_DELIVERY")}
        onBulkDelivered={() => handleBulkStatusChange("DELIVERED")}
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
  loaderText: { marginTop: 10, fontWeight: "bold", color: "#042C83" },
  loadingWrapper: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },

  // ✅ STYLES FOR SEARCH ROW
  searchRow: {
    flexDirection: "row",
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
    gap: 12,
    backgroundColor: "#f1f5f9",
  },
  searchContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff",
    paddingHorizontal: 16,
    borderRadius: 12,
    height: 48,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  searchInput: {
    flex: 1,
    color: "#0f172a",
    marginLeft: 10,
    fontSize: 15,
  },
  // ✅ Replace your old `filterBtn` style with this:
  actionSquareBtn: {
    width: 48,
    height: 48,
    backgroundColor: "#ffffff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    alignItems: "center",
    justifyContent: "center",
  },

  listContent: {
    paddingBottom: 120,
    paddingTop: 8,
  },
  emptyText: { textAlign: "center", color: "#475569", marginTop: 40 },
});
