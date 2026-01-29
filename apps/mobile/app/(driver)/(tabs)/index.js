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
import { COLORS, GLOBAL_STYLES } from "../../../components/constants/theme";

// ✅ IMPORT THE NEW COMPONENTS
// (Adjust path depending on where you saved them)
import TabSelector from "../../../components/driver/TabSelector";
import TripCard from "../../../components/driver/trip/TripCard";

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
        where("status", "in", ["CREATED", "ASSIGNED", "LOADED", "IN_TRANSIT"]),
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
        return trip.status === "IN_TRANSIT" || trip.status === "LOADED";
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
      trip.status === "IN_TRANSIT" ||
      trip.status === "LOADED" ||
      trip.status === "CREATED"
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
          router.replace("/");
        },
      },
    ]);
  };

  if (loading) {
    return (
      <View style={GLOBAL_STYLES.center}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={GLOBAL_STYLES.container}>
      {/* HEADER */}
      <View style={styles.header}>
        <View style={styles.profileInfo}>
          <View style={styles.avatar}>
            <FontAwesome5 name="user-alt" size={18} color={COLORS.primary} />
          </View>
          <View>
            <Text style={styles.greeting}>Welcome back,</Text>
            <Text style={styles.driverName}>{driverName}</Text>
          </View>
        </View>
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <FontAwesome5 name="sign-out-alt" size={20} color={COLORS.danger} />
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
            <FontAwesome5 name="clipboard-list" size={40} color="#334155" />
            <Text style={styles.emptyText}>
              No {activeTab.toLowerCase()} trips.
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

// Only Keep Styles needed for the Layout Container
const styles = StyleSheet.create({
  header: {
    padding: 24,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  profileInfo: { flexDirection: "row", gap: 12, alignItems: "center" },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.card,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#334155",
  },
  greeting: { color: COLORS.textSecondary, fontSize: 12 },
  driverName: { color: COLORS.textPrimary, fontSize: 18, fontWeight: "bold" },
  listContent: { paddingHorizontal: 20, paddingBottom: 50 },
  emptyContainer: { alignItems: "center", marginTop: 50, gap: 10 },
  emptyText: { color: COLORS.textSecondary },
});
