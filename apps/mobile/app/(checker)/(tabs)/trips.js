import React, { useState, useEffect, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  SafeAreaView,
  ActivityIndicator,
  Platform,
  StatusBar,
  TextInput,
  TouchableOpacity,
  RefreshControl,
} from "react-native";
import { useRouter } from "expo-router";
import { FontAwesome5 } from "@expo/vector-icons";
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
} from "firebase/firestore";
import { db } from "../../../firebase";
import { COLORS, GLOBAL_STYLES } from "../../../components/constants/theme";

// ✅ Import your components
import CheckerTripCard from "../../../components/checker/CheckerTripCard";
import TripFilterModal from "../../../components/driver/trip/TripFilterModal"; // Assuming you reuse the same modal
import { CHECKER_TRIP_FILTER } from "../../../components/constants/tracking-constants";
import CheckerHeader from "../../../components/checker/CheckerHeader";

export default function CheckerTripsScreen() {
  const router = useRouter();

  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [activeStatusFilter, setActiveStatusFilter] = useState("ALL");

  useEffect(() => {
    // 1. QUERY: Active Trips for Checkers
    const q = query(
      collection(db, "truck_trips"),
      where("status", "in", [
        "CREATED",
        "ASSIGNED",
        "LOADING",
        "LOADED",
        "IN_TRANSIT",
      ]),
      orderBy("updatedAt", "desc"),
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const fetchedTrips = snapshot.docs.map((doc) => {
          const data = doc.data();

          return {
            ...data, // ✅ NEW: This instantly grabs EVERY field in the document (driverName, tripType, etc.)

            // Your custom mappings and fallbacks applied on top:
            id: doc.id,
            plate: data.truckPlateNumber || "No Plate",
            status: data.status || "UNKNOWN",
            route: data.route || "No Route",
            loaded: data.totalLoaded || 0,
            total: data.totalItems || 0,
          };
        });

        setTrips(fetchedTrips);
        console.log("Fetched Trips:", fetchedTrips);
        setLoading(false);
      },
      (error) => {
        console.error("Error fetching trips:", error);
        setLoading(false);
      },
    );

    return () => unsubscribe();
  }, []);

  // ✅ PULL-TO-REFRESH FUNCTION
  const onRefresh = () => {
    setRefreshing(true);
    // onSnapshot is real-time, so we just simulate a visual refresh delay
    setTimeout(() => {
      setRefreshing(false);
    }, 1000);
  };

  // ✅ FILTER & SEARCH LOGIC
  const filteredTrips = useMemo(() => {
    let filtered = trips;

    // 1. Filter by Specific Status
    if (activeStatusFilter !== "ALL") {
      filtered = filtered.filter((trip) => trip.status === activeStatusFilter);
    }

    // 2. Filter by Search Text (Plate, Route, or ID)
    if (searchText) {
      const term = searchText.toLowerCase();
      filtered = filtered.filter((trip) => {
        return (
          (trip.id || "").toLowerCase().includes(term) ||
          (trip.plate || "").toLowerCase().includes(term) ||
          (trip.route || "").toLowerCase().includes(term)
        );
      });
    }

    return filtered;
  }, [trips, searchText, activeStatusFilter]);

  const handlePress = (trip) => {
    router.push({
      pathname: "/(checker)/trip-details",
      params: { tripId: trip.id, plate: trip.plate },
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* 1. Global Checker Header */}
      {/* <CheckerHeader userName={currentUser.name} onLogout={handleLogout} /> */}

      {/* ✅ NEW: SEARCH & FILTER BAR */}
      <View style={styles.searchRow}>
        <View style={styles.searchContainer}>
          <FontAwesome5 name="search" size={16} color="#94a3b8" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search plate, route..."
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
            styles.filterBtn,
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
      </View>

      {/* List */}
      {loading ? (
        <View style={GLOBAL_STYLES.center}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : (
        <FlatList
          data={filteredTrips}
          keyExtractor={(item) => item.id} // ✅ NEW: Performance optimizations
          initialNumToRender={8}
          maxToRenderPerBatch={10}
          windowSize={11}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={COLORS.primary}
              colors={[COLORS.primary]}
            />
          }
          renderItem={({ item }) => (
            <CheckerTripCard trip={item} onPress={handlePress} />
          )}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <FontAwesome5
                name="truck-loading"
                size={40}
                color="#94a3b8"
                style={{ marginBottom: 12 }}
              />
              <Text style={styles.emptyText}>
                {searchText
                  ? "No trips match your search."
                  : "No active trips found."}
              </Text>
            </View>
          }
        />
      )}

      {/* ✅ MODAL COMPONENT */}
      <TripFilterModal
        visible={filterModalVisible}
        onClose={() => setFilterModalVisible(false)}
        activeFilter={activeStatusFilter}
        onApplyFilter={setActiveStatusFilter}
        options={CHECKER_TRIP_FILTER}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f1f5f9",
  },
  header: {
    paddingHorizontal: 20,
    paddingTop:
      Platform.OS === "android" ? (StatusBar.currentHeight || 0) + 12 : 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#cbd5e1",
    backgroundColor: "#ffffff",
  },
  title: { fontSize: 20, fontWeight: "700", color: "#0f172a" },
  subtitle: { color: "#475569", fontSize: 13, marginTop: 4 },

  // ✅ STYLES FOR SEARCH ROW
  searchRow: {
    flexDirection: "row",
    paddingHorizontal: 20,
    paddingTop: 34,
    paddingBottom: 6,
    gap: 12,
    backgroundColor: "#f1f5f9",
  },
  searchContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f8fafc",
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
  filterBtn: {
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
    // backgroundColor: "#000000ff",
    padding: 20,
    paddingBottom: 50,
  },
  emptyContainer: { alignItems: "center", marginTop: 50 },
  emptyText: { color: "#64748b" },
});
