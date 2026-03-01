import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
  RefreshControl, // ✅ ADD THIS
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { FontAwesome5 } from "@expo/vector-icons";
import { StatusBar } from "expo-status-bar";
import { collection, query, onSnapshot, orderBy } from "firebase/firestore";
import { db } from "../../firebase";
import ShipmentCard from "../../components/driver/shipment/ShipmentCard";
import ShipmentFilterModal from "../../components/driver/shipment/ShipmentFilterModal";

export default function ShipmentsListScreen() {
  const { tripId, tripType } = useLocalSearchParams();
  const router = useRouter();

  const [shipments, setShipments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState("");
  const [activeFilter, setActiveFilter] = useState("ALL"); // NEW
  const [isFilterModalVisible, setFilterModalVisible] = useState(false); // NEW

  // ✅ ADD THESE LINES
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = () => {
    setRefreshing(true);
    // Since onSnapshot is already real-time, we just simulate a brief network
    // delay to give the user the visual satisfaction of a refresh.
    setTimeout(() => {
      setRefreshing(false);
    }, 1000);
  };

  useEffect(() => {
    if (!tripId) return;

    // Listen to sub-collection: truck_trips/{id}/trip_shipments
    const q = query(
      collection(db, "truck_trips", tripId, "trip_shipments"),
      orderBy("status", "asc"), // Shows "ASSIGNED"/"LOADED" before "DELIVERED"
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setShipments(list);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [tripId]);

  // Search Logic
  const filteredData = shipments.filter((item) => {
    // 1. Status Filter Check
    if (activeFilter !== "ALL" && item.status !== activeFilter) {
      return false;
    }

    // 2. Search Text Check
    const term = searchText.toLowerCase();
    if (term) {
      return (
        (item.id && item.id.toLowerCase().includes(term)) ||
        (item.destinationAddress &&
          item.destinationAddress.toLowerCase().includes(term)) ||
        (item.receiverName && item.receiverName.toLowerCase().includes(term))
      );
    }
    return true;
  });

  const handlePressShipment = (shipment) => {
    // Go to Detail/Action Page
    // You can reuse a general "Shipment Details" page or a specific "Scan" page
    router.push({
      pathname: "/(driver)/shipment-details",
      params: { shipmentId: shipment.id, tripId: tripId, tripType: tripType },
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      {/* Header: back | title | count (right) */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <FontAwesome5 name="arrow-left" size={15} color="#0f172a" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Shipments</Text>
        <Text style={styles.headerCount}>{shipments.length} Items</Text>
      </View>

      {/* ✅ NEW: SEARCH & FILTER BAR */}
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

        {/* Filter Button */}
        <TouchableOpacity
          style={[
            styles.filterBtn,
            activeFilter !== "ALL" && {
              backgroundColor: "#e0f2fe",
              borderColor: "#38bdf8",
            },
          ]}
          onPress={() => setFilterModalVisible(true)}
        >
          <FontAwesome5
            name="sliders-h"
            size={16}
            color={activeFilter !== "ALL" ? "#0284c7" : "#0f172a"}
          />
        </TouchableOpacity>
      </View>

      {/* List */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#042C83" />
        </View>
      ) : (
        <FlatList
          data={filteredData}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          // ✅ ADD THIS PROP
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#042C83" // iOS spinner color
              colors={["#042C83"]} // Android spinner color
            />
          }
          renderItem={({ item }) => (
            <ShipmentCard shipment={item} onPress={handlePressShipment} />
          )}
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <FontAwesome5 name="box-open" size={40} color="#94a3b8" />
              <Text style={styles.emptyText}>No shipments found.</Text>
            </View>
          }
        />
      )}
      <ShipmentFilterModal
        visible={isFilterModalVisible}
        onClose={() => setFilterModalVisible(false)}
        activeFilter={activeFilter}
        onApplyFilter={setActiveFilter}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f1f5f9",
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f1f5f9",
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 15,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  backBtn: {
    padding: 0,
  },
  headerTitle: {
    color: "#0f172a",
    fontSize: 16,
    fontWeight: "bold",
    flex: 1,
    marginLeft: 12,
  },
  headerCount: {
    color: "#0f172a",
    fontSize: 14,
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 20,
    marginTop: 16,
    marginBottom: 16,
    gap: 12, // Creates perfect spacing between the bar and the button
  },
  searchContainer: {
    flex: 1, // Tells the search bar to take up all remaining horizontal space
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
  filterBtn: {
    width: 50,
    height: 50,
    backgroundColor: "#ffffff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    alignItems: "center",
    justifyContent: "center",
  },
  listContent: { paddingHorizontal: 20, paddingBottom: 40 },
  emptyBox: { alignItems: "center", marginTop: 60, gap: 12 },
  emptyText: { color: "#64748b", fontSize: 14 },
});
