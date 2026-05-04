import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
  RefreshControl,
  Alert,
  LayoutAnimation,
  Platform,
  UIManager,
  StatusBar as RNStatusBar,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { FontAwesome5 } from "@expo/vector-icons";
import { StatusBar } from "expo-status-bar";
import {
  collection,
  query,
  onSnapshot,
  orderBy,
  doc,
} from "firebase/firestore";

import { db } from "../../firebase";
import { useAuth } from "../../contexts/AuthContext.js";

import ShipmentCard from "../shipments/ShipmentCard";
import ShipmentFilterModal from "../shipments/modals/ShipmentFilterModal";

import TripDetailsHeader from "../trips/TripDetailsHeader";
import ShipmentActionModal from "../shipments/modals/ShipmentActionModal";
import ShipmentControlsModal from "../shipments/modals/ShipmentControlsModal";

import {
  bulkShipmentAction,
  finalizeHubProcessing,
  updateShipmentStatus,
} from "../utilities/FirebaseFunctions";
import { getCurrentLocationSafe } from "../utilities/helpers";

export default function ShipmentListScreen({
  filterOptions,
  enableBulkActions = false,
  enableScanActions = false,
  enableShipmentMenu = false,
}) {
  if (
    Platform.OS === "android" &&
    UIManager.setLayoutAnimationEnabledExperimental
  ) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
  }

  const { isChecker } = useAuth();
  const router = useRouter();

  const { tripId, tripType, plate } = useLocalSearchParams();

  const [trip, setTrip] = useState(null);
  const [shipments, setShipments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [searchText, setSearchText] = useState("");
  const [activeFilter, setActiveFilter] = useState("ALL");
  const [isFilterModalVisible, setFilterModalVisible] = useState(false);

  const [selectedShipment, setSelectedShipment] = useState(null);
  const [shipmentActionVisible, setShipmentActionVisible] = useState(false);
  const [bulkModalVisible, setBulkModalVisible] = useState(false);

  const [showScanOptions, setShowScanOptions] = useState(false);

  useEffect(() => {
    if (!tripId) {
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, "truck_trips", String(tripId), "trip_shipments"),
      orderBy("createdAt", "desc"),
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list = snapshot.docs.map((shipmentDoc) => {
          const data = shipmentDoc.data();

          return {
            id: shipmentDoc.id,
            ...data,
            status: data.status || "ASSIGNED",
            totalItems: data.totalItems ?? data.packageCount ?? 0,
            loadedCount: data.loadedCount ?? 0,
          };
        });

        setShipments(list);
        setLoading(false);
      },
      (error) => {
        console.error("Shipment list subscription error:", error);
        setLoading(false);
      },
    );

    return () => unsubscribe();
  }, [tripId]);

  useEffect(() => {
    if (!tripId) return;

    const unsubscribe = onSnapshot(
      doc(db, "truck_trips", String(tripId)),
      (docSnap) => {
        if (docSnap.exists()) {
          setTrip({
            id: docSnap.id,
            ...docSnap.data(),
          });
        }
      },
      (error) => {
        console.error("Trip subscription error:", error);
      },
    );

    return () => unsubscribe();
  }, [tripId]);

  const onRefresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1000);
  };

  const filteredData = useMemo(() => {
    let filtered = [...shipments];

    if (activeFilter !== "ALL") {
      if (activeFilter === "EXCEPTION") {
        filtered = filtered.filter(
          (s) =>
            String(s.status || "").includes("FAILED") ||
            String(s.status || "").includes("MISSING"),
        );
      } else {
        filtered = filtered.filter((s) => s.status === activeFilter);
      }
    }

    if (searchText.trim()) {
      const term = searchText.toLowerCase().trim();

      filtered = filtered.filter((item) => {
        // console.log("itemssss: ", item);
        const idText = String(item.id || "").toLowerCase();
        // const package()
        const trackingText = String(item.shipmentId || "").toLowerCase();
        const destinationText = String(
          item.destinationAddress ||
            item.destination ||
            item.recipient?.address?.street ||
            item.recipient?.address?.city ||
            "",
        ).toLowerCase();
        const nameText = String(
          item.receiverName || item.recipient?.name || item.sender?.name || "",
        ).toLowerCase();

        return (
          idText.includes(term) ||
          trackingText.includes(term) ||
          destinationText.includes(term) ||
          nameText.includes(term)
        );
      });
    }

    return filtered;
  }, [shipments, searchText, activeFilter]);

  const routeBase = isChecker ? "/(checker)" : "/(driver)";

  const handlePressShipment = (shipment) => {
    router.push({
      pathname: `${routeBase}/shipment-details`,
      params: {
        shipmentId: shipment.id,
        tripId: String(tripId || ""),
        tripType: String(tripType || ""),
        parentTripId: String(tripId || ""),
        parentPlate: String(plate || trip?.truckPlateNumber || ""),
      },
    });
  };

  const toggleOptions = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setShowScanOptions((prev) => !prev);
  };

  const updateStatus = async (ids, newStatus, remarks = "") => {
    if (!ids?.length) return;

    setUpdating(true);

    try {
      const location = await getCurrentLocationSafe();

      if (ids.length === 1) {
        await updateShipmentStatus({
          shipmentId: ids[0],
          tripId: String(tripId),
          newStatus,
          remarks,
          ...(location ? { location } : {}),
        });
      } else {
        await bulkShipmentAction({
          tripId: String(tripId),
          shipmentIds: ids,
          action: newStatus,
          remarks,
          ...(location ? { location } : {}),
        });
      }

      Alert.alert("Success", "Shipment status updated.");
    } catch (error) {
      console.error("Shipment status update error:", error);
      Alert.alert(
        "Error",
        error?.message || "Failed to update shipment status.",
      );
    } finally {
      setUpdating(false);
    }
  };

  const handleBulkStatusChange = (newStatus, remarks = "") => {
    const ids = filteredData.map((s) => s.id);

    if (!ids.length) {
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
          onPress: () => updateStatus(ids, newStatus, remarks),
        },
      ],
    );
  };

  const handleFinalizeTrip = (remarksText = "") => {
    if (!trip) return;

    const total = trip.totalItems || 0;
    const processed = trip.totalLoaded || trip.totalArrived || 0;

    const isReceiving =
      trip.status === "IN_TRANSIT" || trip.status === "ARRIVED";
    const actionWord = isReceiving ? "Receive" : "Load";

    const message =
      processed >= total
        ? `All items processed. ${actionWord} truck now?`
        : `Only ${processed}/${total} processed. ${actionWord} anyway?`;

    Alert.alert(`Confirm ${actionWord}`, message, [
      { text: "Cancel", style: "cancel" },
      {
        text: `YES, ${actionWord.toUpperCase()}`,
        style: "destructive",
        onPress: async () => {
          setUpdating(true);
          try {
            await finalizeHubProcessing({
              tripId: String(tripId),
              remarks: remarksText,
            });

            Alert.alert("Success", "Trip processing finalized.");
            router.back();
          } catch (error) {
            console.error("Finalize trip error:", error);
            Alert.alert("Error", error?.message || "Failed to finalize trip.");
          } finally {
            setUpdating(false);
          }
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" backgroundColor="#f1f5f9" />

      <TripDetailsHeader
        tripId={tripId}
        plate={plate || trip?.truckPlateNumber}
        onBack={() => router.back()}
      />

      {updating && (
        <View style={styles.loaderOverlay}>
          <ActivityIndicator size="large" color="#042C83" />
          <Text style={styles.loaderText}>Updating...</Text>
        </View>
      )}

      <View style={styles.searchRow}>
        <View style={styles.searchContainer}>
          <FontAwesome5 name="search" size={16} color="#94a3b8" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search address, ID, or name..."
            placeholderTextColor="#94a3b8"
            value={searchText}
            onChangeText={setSearchText}
          />
          {searchText.length > 0 && (
            <TouchableOpacity onPress={() => setSearchText("")}>
              <FontAwesome5 name="times-circle" size={16} color="#94a3b8" />
            </TouchableOpacity>
          )}
        </View>

        <TouchableOpacity
          style={[
            styles.actionSquareBtn,
            activeFilter !== "ALL" && styles.actionSquareBtnActive,
          ]}
          onPress={() => setFilterModalVisible(true)}
        >
          <FontAwesome5
            name="sliders-h"
            size={16}
            color={activeFilter !== "ALL" ? "#0284c7" : "#0f172a"}
          />
        </TouchableOpacity>

        {enableBulkActions && (
          <TouchableOpacity
            style={styles.actionSquareBtn}
            onPress={() => setBulkModalVisible(true)}
          >
            <FontAwesome5 name="layer-group" size={16} color="#0f172a" />
          </TouchableOpacity>
        )}
      </View>

      <View style={{ flex: 1 }}>
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color="#042C83" />
          </View>
        ) : (
          <FlatList
            data={filteredData}
            keyExtractor={(item) => item.id}
            contentContainerStyle={[
              styles.listContent,
              enableShipmentMenu && { paddingBottom: 100 },
            ]}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor="#042C83"
                colors={["#042C83"]}
              />
            }
            renderItem={({ item }) => (
              <ShipmentCard
                shipment={item}
                onPress={handlePressShipment}
                actionLabel={
                  enableShipmentMenu ? "Update Shipment" : "View Details"
                }
                onMorePress={
                  enableShipmentMenu
                    ? () => {
                        setSelectedShipment(item);
                        setShipmentActionVisible(true);
                      }
                    : undefined
                }
              />
            )}
            ListEmptyComponent={
              <View style={styles.emptyBox}>
                <FontAwesome5 name="box-open" size={40} color="#94a3b8" />
                <Text style={styles.emptyText}>
                  {searchText || activeFilter !== "ALL"
                    ? "No shipments match your filters."
                    : "No shipments found."}
                </Text>
              </View>
            }
          />
        )}
      </View>

      {enableScanActions && showScanOptions && (
        <View style={styles.optionContainer}>
          <TouchableOpacity
            style={[styles.optionBtn, { backgroundColor: "#059669" }]}
            onPress={() => {
              toggleOptions();
              router.push({
                pathname: "/(checker)/scan",
                params: { mode: "offloading", tripId: String(tripId) },
              });
            }}
          >
            <FontAwesome5 name="file-import" size={16} color="#fff" />
            <Text style={styles.optionText}>OFFLOAD</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.optionBtn, { backgroundColor: "#2563eb" }]}
            onPress={() => {
              toggleOptions();
              router.push({
                pathname: "/(checker)/scan",
                params: { mode: "loading", tripId: String(tripId) },
              });
            }}
          >
            <FontAwesome5 name="truck-loading" size={16} color="#fff" />
            <Text style={styles.optionText}>LOAD</Text>
          </TouchableOpacity>
        </View>
      )}

      {enableScanActions && (
        <TouchableOpacity
          style={[styles.fab, showScanOptions && styles.fabActive]}
          activeOpacity={0.8}
          onPress={toggleOptions}
        >
          <FontAwesome5
            name={showScanOptions ? "times" : "barcode"}
            size={22}
            color="#ffffff"
          />
        </TouchableOpacity>
      )}

      {enableShipmentMenu && (
        <>
          <ShipmentActionModal
            visible={shipmentActionVisible}
            shipment={selectedShipment}
            onClose={() => {
              setShipmentActionVisible(false);
              setSelectedShipment(null);
            }}
            onAction={(actionType, remarksText) => {
              if (selectedShipment) {
                updateStatus([selectedShipment.id], actionType, remarksText);
              }
            }}
          />

          <ShipmentControlsModal
            visible={bulkModalVisible}
            onClose={() => setBulkModalVisible(false)}
            tripStatus={trip?.status}
            onBulkLoad={(remarks) => handleBulkStatusChange("LOADED", remarks)}
            onBulkReceive={(remarks) =>
              handleBulkStatusChange("RECEIVED", remarks)
            }
            onFinalize={(remarks) => handleFinalizeTrip(remarks)}
          />
        </>
      )}

      <ShipmentFilterModal
        visible={isFilterModalVisible}
        onClose={() => setFilterModalVisible(false)}
        activeFilter={activeFilter}
        onApplyFilter={setActiveFilter}
        options={filterOptions}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f1f5f9",
    paddingTop: Platform.OS === "android" ? RNStatusBar.currentHeight || 0 : 0,
  },

  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f1f5f9",
  },

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

  loaderText: {
    marginTop: 10,
    fontWeight: "700",
    color: "#042C83",
  },

  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
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
    height: 50,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },

  searchInput: {
    flex: 1,
    color: "#0f172a",
    marginLeft: 12,
    fontSize: 16,
  },

  actionSquareBtn: {
    width: 50,
    height: 50,
    backgroundColor: "#ffffff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    alignItems: "center",
    justifyContent: "center",
  },

  actionSquareBtnActive: {
    backgroundColor: "#e0f2fe",
    borderColor: "#38bdf8",
  },

  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },

  emptyBox: {
    alignItems: "center",
    marginTop: 60,
    gap: 12,
  },

  emptyText: {
    color: "#64748b",
    fontSize: 14,
    textAlign: "center",
  },

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
