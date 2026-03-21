import React, { useState, useEffect, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  FlatList,
  SafeAreaView,
  TextInput,
  RefreshControl,
  Platform,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { useRouter } from "expo-router";
import { FontAwesome5 } from "@expo/vector-icons";
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
  limit,
} from "firebase/firestore";
import { signOut } from "firebase/auth";
import { db, auth } from "../../../firebase";
import { GLOBAL_STYLES } from "../../../components/constants/theme";

// ✅ IMPORT THE NEW COMPONENTS
import TabSelector from "../../../components/driver/TabSelector";
import TripCard from "../../../components/driver/trip/TripCard";
import TripFilterModal from "../../../components/driver/trip/TripFilterModal";
import DriverHeader from "../../../components/driver/DriverHeader";

export default function DriverDashboard() {
  const router = useRouter();
  const uid = auth.currentUser?.uid;

  const [activeTab, setActiveTab] = useState("Active");
  const [allTrips, setAllTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [driverName, setDriverName] = useState("Driver");

  // ✅ NEW STATES FOR REFRESH & SEARCH
  const [refreshing, setRefreshing] = useState(false);
  const [searchText, setSearchText] = useState("");

  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [activeStatusFilter, setActiveStatusFilter] = useState("ALL");

  const fetchData = async () => {
    if (!uid) return;
    try {
      const userRef = doc(db, "users", uid);

      const activeQuery = query(
        collection(db, "truck_trips"),
        where("driverId", "==", uid),
        where("status", "in", ["ASSIGNED", "LOADED", "IN_TRANSIT", "ARRIVED"]),
      );

      const completedQuery = query(
        collection(db, "truck_trips"),
        where("driverId", "==", uid),
        where("status", "==", "COMPLETED"),
        limit(10),
      );

      const [userSnap, activeSnap, completedSnap] = await Promise.all([
        getDoc(userRef),
        getDocs(activeQuery),
        getDocs(completedQuery),
      ]);

      if (userSnap.exists()) {
        const d = userSnap.data();
        setDriverName(d.name || d.fullName || "Driver");
      }

      const activeList = activeSnap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));
      const completedList = completedSnap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));

      setAllTrips([...activeList, ...completedList]);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // ✅ PULL-TO-REFRESH FUNCTION
  const onRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  };

  // ✅ UPDATED TO INCLUDE SEARCH FILTERING
  const filteredTrips = useMemo(() => {
    let trips = allTrips.filter((trip) => {
      // 1. Filter by Tab
      if (activeTab === "Active") {
        return (
          trip.status === "IN_TRANSIT" ||
          trip.status === "LOADED" ||
          trip.status === "ARRIVED"
        );
      }
      if (activeTab === "Upcoming") {
        return trip.status === "ASSIGNED" || trip.status === "CREATED";
      }
      if (activeTab === "Completed") {
        return trip.status === "COMPLETED";
      }
      return false;
    });

    // 2. Filter by Search Text
    if (searchText) {
      const term = searchText.toLowerCase();
      trips = trips.filter((trip) => {
        return (
          (trip.id || "").toLowerCase().includes(term) ||
          (trip.route || "").toLowerCase().includes(term) ||
          (trip.destination || "").toLowerCase().includes(term)
        );
      });
    }

    return trips;
  }, [allTrips, activeTab, searchText, activeStatusFilter]);

  const handleViewTrip = (trip) => {
    if (
      trip.status === "ASSIGNED" ||
      trip.status === "LOADED" ||
      trip.status === "IN_TRANSIT" ||
      trip.status === "ARRIVED"
    ) {
      router.push({
        pathname: "/(driver)/trip-details",
        params: { tripId: trip.id },
      });
    } else {
      Alert.alert(
        "Trip Details",
        `Status: ${trip.status}\nRoute: ${trip.route}`,
      );
    }
  };

  const handleLogout = () => {
    Alert.alert("Sign Out", "Are you sure?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign Out",
        style: "destructive",
        onPress: () => {
          signOut(auth);
          router.replace("/(auth)/login");
        },
      },
    ]);
  };

  if (loading) {
    return (
      <View style={[GLOBAL_STYLES.center, { backgroundColor: "#f1f5f9" }]}>
        <ActivityIndicator size="large" color="#042C83" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#f1f5f9" />

      {/* HEADER */}
      <DriverHeader
        title="My Trips"
        userName={driverName}
        onLogout={handleLogout}
        onProfilePress={() => router.push("/(driver)/profile")}
      />

      {/* COMPONENT 1: TABS */}
      <TabSelector activeTab={activeTab} onTabChange={setActiveTab} />

      {/* ✅ NEW: SEARCH & FILTER BAR */}
      <View style={styles.searchRow}>
        <View style={styles.searchContainer}>
          <FontAwesome5 name="search" size={16} color="#94a3b8" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search trips, routes..."
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

      {/* COMPONENT 2: LIST WITH CARD & REFRESH CONTROL */}
      <FlatList
        data={filteredTrips}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        // ✅ ATTACH REFRESH CONTROL
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#042C83"
            colors={["#042C83"]}
          />
        }
        renderItem={({ item }) => (
          <TripCard
            trip={item}
            onPress={handleViewTrip}
            actionLabel={
              activeTab === "Completed" ? "View History" : "View Trip"
            }
          />
        )}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <FontAwesome5 name="clipboard-list" size={40} color="#94a3b8" />
            <Text style={styles.emptyText}>
              {searchText
                ? "No trips match your search."
                : `No ${activeTab.toLowerCase()} trips.`}
            </Text>
          </View>
        }
      />
      <TripFilterModal
        visible={filterModalVisible}
        onClose={() => setFilterModalVisible(false)}
        activeFilter={activeStatusFilter}
        onApplyFilter={setActiveStatusFilter}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f1f5f9",
  },

  // ✅ SEARCH ROW
  searchRow: {
    flexDirection: "row",
    paddingHorizontal: 20,
    paddingVertical: 12,
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

  listContent: { paddingHorizontal: 20, paddingBottom: 50, paddingTop: 4 },
  emptyContainer: { alignItems: "center", marginTop: 50, gap: 10 },
  emptyText: { color: "#64748b" },
});
