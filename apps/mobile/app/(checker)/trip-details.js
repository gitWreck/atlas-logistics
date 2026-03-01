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
  LayoutAnimation,
  Platform,
  UIManager,
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

// ✅ IMPORT COMPONENTS
import TripDetailsHeader from "../../components/checker/trip-details/TripDetailsHeader";
import ShipmentListItem from "../../components/checker/trip-details/ShipmentListItem";
import ShipmentActionModal from "../../components/checker/trip-details/ShipmentActionModal";
import TripFilterModal from "../../components/driver/trip/TripFilterModal";
import ShipmentControlsModal from "../../components/checker/trip-details/ShipmentControlsModal";
import {
  bulkShipmentAction,
  finalizeHubProcessing,
  updateShipmentStatusChecker,
} from "../../components/utilities/FirebaseFunctions";
import { CHECKER_SHIPMENT_FILTER } from "../../components/constants/tracking-constants";
import { getCurrentLocationSafe } from "../../components/utilities/helpers";

export default function TripDetailsScreen() {
  // Enable LayoutAnimation for Android
  if (
    Platform.OS === "android" &&
    UIManager.setLayoutAnimationEnabledExperimental
  ) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
  }

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

  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [activeStatusFilter, setActiveStatusFilter] = useState("ALL");
  const [bulkModalVisible, setBulkModalVisible] = useState(false);

  const [showScanOptions, setShowScanOptions] = React.useState(false);

  // FETCH SHIPMENTS
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
          ...data,
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

  // FETCH TRIP DOC
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

  // FILTER & SEARCH LOGIC
  const filteredData = useMemo(() => {
    let filtered = shipments;

    // Filter by Status (Grouping Failures into "EXCEPTION")
    if (activeStatusFilter !== "ALL") {
      if (activeStatusFilter === "EXCEPTION") {
        filtered = filtered.filter(
          (s) => s.status.includes("FAILED") || s.status.includes("MISSING"),
        );
      } else {
        filtered = filtered.filter((s) => s.status === activeStatusFilter);
      }
    }

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

  const updateStatus = async (ids, newStatus, remarks = "") => {
    if (ids.length === 0) return;
    setUpdating(true);

    try {
      const location = await getCurrentLocationSafe();

      // Check if it's a single update or bulk
      if (ids.length === 1) {
        // ✅ Use the Precision Scalpel for 1 item
        await updateShipmentStatusChecker({
          shipmentId: ids[0],
          tripId: tripId,
          newStatus: newStatus,
          remarks: remarks,
          ...(location ? { location } : {}),
        });
      } else {
        // ✅ Use the Power Tool for many items
        await bulkShipmentAction({
          tripId: tripId,
          shipmentIds: ids,
          action: newStatus,
          remarks: remarks,
          ...(location ? { location } : {}),
        });
      }

      Alert.alert("Success", "Shipment status updated.");
    } catch (error) {
      Alert.alert("Error", error.message);
    } finally {
      setUpdating(false);
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
        {
          text: "Confirm",
          onPress: () =>
            updateStatus(ids, newStatus, "Updated via Bulk Action"),
        },
      ],
    );
  };

  // ✅ UPDATED: Now accepts 'remarks' from the ShipmentControlsModal
  const handleFinishTrip = (forcedStatus = null, remarksText = "") => {
    if (!trip) return;

    const total = trip.totalItems || 0;
    const processed = trip.totalLoaded || trip.totalArrived || 0;

    // Determine if we are loading an outbound truck or receiving an inbound truck
    const isReceiving =
      trip.status === "IN_TRANSIT" || trip.status === "ARRIVED";
    const actionWord = isReceiving ? "Receive" : "Seal";
    const statusWord = forcedStatus || (isReceiving ? "ARRIVED" : "LOADED");

    const message =
      processed >= total
        ? `All items processed. ${actionWord} Truck?`
        : `Only ${processed}/${total} processed. ${actionWord} anyway?`;

    Alert.alert(`Confirm ${actionWord}`, message, [
      { text: "Cancel", style: "cancel" },
      {
        text: `YES, ${actionWord.toUpperCase()}`,
        style: "destructive",
        onPress: async () => {
          setUpdating(true);
          try {
            // ✅ Now passing tripId AND remarks to the cloud function
            await finalizeHubProcessing({
              tripId,
              remarks: remarksText,
            });

            Alert.alert("Success", `Trip marked as ${statusWord}.`);
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

  const onRefresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1500);
  };

  const toggleOptions = () => {
    // Configures the next layout change to be animated
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setShowScanOptions(!showScanOptions);
  };

  return (
    <SafeAreaView style={styles.container}>
      <TripDetailsHeader
        tripId={tripId}
        plate={plate}
        onBack={() => router.back()}
      />

      {updating && (
        <View style={styles.loaderOverlay}>
          <ActivityIndicator size="large" color="#042C83" />
          <Text style={styles.loaderText}>Updating...</Text>
        </View>
      )}

      {/* SEARCH, FILTER & BULK ACTIONS ROW */}
      <View style={styles.searchRow}>
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

        <TouchableOpacity
          style={styles.actionSquareBtn}
          onPress={() => setBulkModalVisible(true)}
        >
          <FontAwesome5 name="layer-group" size={16} color="#0f172a" />
        </TouchableOpacity>
      </View>

      {/* LIST */}
      <View style={{ flex: 1 }}>
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
                onPress={() =>
                  router.push({
                    pathname: "/(checker)/shipment-details",
                    params: {
                      shipmentId: item.id,
                      parentTripId: tripId,
                      parentPlate: plate,
                    },
                  })
                }
                onMenuPress={(shipment) => {
                  setSelectedShipment(shipment);
                  setModalVisible(true);
                }}
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
      </View>

      {/* SCAN OPTIONS OVERLAY */}
      {showScanOptions && (
        <View style={styles.optionContainer}>
          {/* Buttons slide up from the FAB position */}
          <TouchableOpacity
            style={[styles.optionBtn, { backgroundColor: "#059669" }]}
            onPress={() => {
              toggleOptions(); // Close with animation
              router.push({
                pathname: "/(checker)/scan",
                params: { mode: "delivering", tripId },
              });
            }}
          >
            <FontAwesome5 name="file-import" size={16} color="#fff" />
            <Text style={styles.optionText}>OFFLOAD</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.optionBtn, { backgroundColor: "#2563eb" }]}
            onPress={() => {
              toggleOptions(); // Close with animation
              router.push({
                pathname: "/(checker)/scan",
                params: { mode: "loading", tripId },
              });
            }}
          >
            <FontAwesome5 name="truck-loading" size={16} color="#fff" />
            <Text style={styles.optionText}>LOAD</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* THE MAIN FAB */}
      <TouchableOpacity
        style={[styles.fab, showScanOptions && styles.fabActive]}
        activeOpacity={0.8}
        onPress={toggleOptions} // Uses the animated toggle
      >
        <FontAwesome5
          name={showScanOptions ? "times" : "barcode"}
          size={22}
          color="#ffffff"
        />
      </TouchableOpacity>

      {/* MODALS */}
      <ShipmentActionModal
        visible={modalVisible}
        shipment={selectedShipment}
        onClose={() => setModalVisible(false)}
        onAction={(actionType, remarksText) => {
          if (selectedShipment)
            updateStatus([selectedShipment.id], actionType, remarksText);
        }}
      />

      <TripFilterModal
        visible={filterModalVisible}
        onClose={() => setFilterModalVisible(false)}
        activeFilter={activeStatusFilter}
        onApplyFilter={setActiveStatusFilter}
        options={CHECKER_SHIPMENT_FILTER}
      />

      <ShipmentControlsModal
        visible={bulkModalVisible}
        onClose={() => setBulkModalVisible(false)}
        tripStatus={trip?.status}
        // ✅ Update these handlers to accept the remarks string
        onBulkLoad={(remarks) => handleBulkStatusChange("LOADED", remarks)}
        onBulkReceive={(remarks) => handleBulkStatusChange("RECEIVED", remarks)}
        onFinalize={(remarks) => handleFinishTrip(null, remarks)}
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
  loadingWrapper: { flex: 1, justifyContent: "center", alignItems: "center" },

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
  searchInput: { flex: 1, color: "#0f172a", marginLeft: 10, fontSize: 15 },
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

  listContent: { paddingBottom: 80, paddingTop: 8 },
  emptyText: { textAlign: "center", color: "#475569", marginTop: 40 },

  fab: {
    position: "absolute",
    bottom: 30,
    right: 20,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#0f172a",
    justifyContent: "center",
    alignItems: "center",
    elevation: 5,
    zIndex: 100,
  },
  fabActive: {
    backgroundColor: "#64748b",
  },
  optionContainer: {
    position: "absolute",
    bottom: 100,
    right: 20,
    gap: 12,
    alignItems: "flex-end",
    zIndex: 99,
  },
  optionBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 30,
    gap: 10,
    elevation: 3,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 5,
  },
  optionText: {
    color: "#fff",
    fontWeight: "800",
    fontSize: 13,
  },
});
