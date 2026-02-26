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
import { db, auth } from "../../firebase";
import { COLORS, GLOBAL_STYLES } from "../../components/constants/theme";
import { Image } from "expo-image";

// ✅ IMPORT THE NEW COMPONENTS
// (Adjust path depending on where you saved them)
import TabSelector from "../../components/driver/TabSelector";
import TripCard from "../../components/driver/trip/TripCard";

export default function DriverDashboard() {
  const router = useRouter();
  const uid = auth.currentUser?.uid;

  const [activeTab, setActiveTab] = useState("Active");
  const [allTrips, setAllTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [driverName, setDriverName] = useState("Driver");

  const fetchData = async () => {
    if (!uid) return;
    try {
      const userRef = doc(db, "users", uid);

      const activeQuery = query(
        collection(db, "truck_trips"),
        where("driverId", "==", uid),
        where("status", "in", [
          // "CREATED",
          "ASSIGNED",
          "LOADED",
          "IN_TRANSIT",
          "ARRIVED",
        ]),
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

  const filteredTrips = useMemo(() => {
    return allTrips.filter((trip) => {
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
  }, [allTrips, activeTab]);

  const handleViewTrip = (trip) => {
    console.log("TRIP DETAILS: ", trip);
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
      <StatusBar style="dark" />
      {/* HEADER: My Trips (light theme - matches Figma) */}
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Image
            source={require("../../../assets/icons/driver-icon.svg")}
            style={{ width: 45, height: 45 }}
          />
          <Text style={styles.headerTitle}>My Trips</Text>
        </View>
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <FontAwesome5 name="sign-out-alt" size={20} color={COLORS.logout} />
        </TouchableOpacity>
      </View>

      {/* ✅ COMPONENT 1: TABS */}
      <TabSelector activeTab={activeTab} onTabChange={setActiveTab} />

      {/* ✅ COMPONENT 2: LIST WITH CARD */}
      <FlatList
        data={filteredTrips}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
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
              No {activeTab.toLowerCase()} trips.
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

// Light theme - matches Figma design
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f1f5f9",
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 15,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  titleRow: { flexDirection: "row", alignItems: "center" },
  headerIcon: { marginRight: 12 },
  headerTitle: {
    color: "#0f172a",
    fontSize: 16,
    fontWeight: "600",
    marginLeft: 12,
  },
  listContent: { paddingHorizontal: 20, paddingBottom: 50, paddingTop: 10 },
  emptyContainer: { alignItems: "center", marginTop: 50, gap: 10 },
  emptyText: { color: "#64748b" },
});
