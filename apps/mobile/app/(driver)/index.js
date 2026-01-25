import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  ScrollView,
  SafeAreaView,
} from "react-native";
import { useRouter } from "expo-router";
import { FontAwesome5, Ionicons } from "@expo/vector-icons";
import { getFunctions, httpsCallable } from "firebase/functions";
import {
  collection,
  query,
  where,
  getDocs,
  limit,
  doc,
  getDoc,
} from "firebase/firestore";
import { signOut } from "firebase/auth";
import { db, auth } from "../../firebase"; // Ensure auth is imported to get current user
// 1. IMPORT YOUR NEW STYLES
import { COLORS, GLOBAL_STYLES } from "../../components/constants/theme";

export default function DriverDashboard() {
  const router = useRouter();
  const uid = auth.currentUser?.uid;

  // State for separation
  const [activeTrip, setActiveTrip] = useState(null);
  const [upcomingTrips, setUpcomingTrips] = useState([]);

  const [loading, setLoading] = useState(true);
  const [driverName, setDriverName] = useState("Driver");
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = async () => {
    if (!uid) return;

    try {
      const userRef = doc(db, "users", uid);

      // 2. QUERY UPDATE: Remove 'limit(1)' to get ALL assigned trips
      const tripQuery = query(
        collection(db, "truck_trips"),
        where("status", "in", ["CREATED", "ASSIGNED", "LOADED", "IN_TRANSIT"]),
        where("driverId", "==", uid),
      );

      const [userSnap, tripSnap] = await Promise.all([
        getDoc(userRef),
        getDocs(tripQuery),
      ]);

      if (userSnap.exists()) {
        const data = userSnap.data();
        setDriverName(data.name || data.fullName || "Driver");
      }

      // 3. LOGIC SEPARATION: Sort trips into Active vs Upcoming
      const allTrips = tripSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

      // Priority: Find IN_TRANSIT first, then LOADED
      const current =
        allTrips.find((t) => t.status === "IN_TRANSIT") ||
        allTrips.find((t) => t.status === "LOADED");

      // Everything else is upcoming
      const queue = allTrips.filter((t) => t.id !== current?.id);

      setActiveTrip(current || null);
      setUpcomingTrips(queue);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  };

  const handleLogout = () => {
    Alert.alert("Sign Out", "Are you sure you want to log out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign Out",
        style: "destructive", // Red color on iOS
        onPress: async () => {
          try {
            await signOut(auth);
            router.replace("/"); // Redirect to Login/Root
          } catch (error) {
            Alert.alert("Error", error.message);
          }
        },
      },
    ]);
  };

  // 2. HANDLE "START TRIP"
  const handleStartTrip = async () => {
    setActionLoading(true);
    try {
      const functions = getFunctions(undefined, "asia-southeast1");
      const updateTripStatus = httpsCallable(functions, "updateTripStatus");
      // Note: You need to create this simple Cloud Function or use Firestore update directly

      // For now, let's simulate the success or call a hypothetical function
      // await updateTripStatus({ tripId: currentTrip.id, status: "IN_TRANSIT" });

      Alert.alert("Success", "Trip started! Drive safely.");
      // Optimistic Update
      setCurrentTrip((prev) => ({ ...prev, status: "IN_TRANSIT" }));
    } catch (error) {
      Alert.alert("Error", error.message);
    } finally {
      setActionLoading(false);
    }
  };

  // 3. NAVIGATION HANDLERS
  const goToScan = (mode, title) => {
    router.push({
      pathname: "/(driver)/scan",
      params: { mode, title, tripId: currentTrip.id },
    });
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
            <FontAwesome5
              name="steering-wheel"
              size={20}
              color={COLORS.primary}
            />
          </View>
          <View>
            <Text style={styles.greeting}>Ready to roll,</Text>
            <Text style={styles.driverName}>{driverName}</Text>
          </View>
        </View>
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <FontAwesome5 name="sign-out-alt" size={20} color={COLORS.danger} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* SECTION A: ACTIVE JOB (Big Card) */}
        <Text style={GLOBAL_STYLES.sectionTitle}>Current Job</Text>

        {activeTrip ? (
          <View style={GLOBAL_STYLES.card}>
            {/* Trip Header */}
            <View style={styles.tripHeader}>
              <View style={styles.plateBox}>
                <Text style={styles.plateText}>{activeTrip.plateNumber}</Text>
              </View>
              <View
                style={[
                  styles.badge,
                  activeTrip.status === "IN_TRANSIT"
                    ? styles.bgGreen
                    : styles.bgBlue,
                ]}
              >
                <Text style={styles.badgeText}>{activeTrip.status}</Text>
              </View>
            </View>

            <Text style={styles.routeText}>
              {activeTrip.route || "Hub -> Destination"}
            </Text>

            {/* Action Buttons for Active Trip */}
            <View style={{ gap: 12, marginTop: 16 }}>
              {activeTrip.status === "LOADED" && (
                <TouchableOpacity
                  style={[
                    GLOBAL_STYLES.btn,
                    { backgroundColor: COLORS.success },
                  ]}
                  onPress={() => handleStartTrip(activeTrip)}
                >
                  <FontAwesome5 name="play" color="#fff" size={16} />
                  <Text style={GLOBAL_STYLES.btnText}>START TRIP</Text>
                </TouchableOpacity>
              )}
              {activeTrip.status === "IN_TRANSIT" && (
                <TouchableOpacity
                  style={[
                    GLOBAL_STYLES.btn,
                    { backgroundColor: COLORS.secondary },
                  ]}
                  onPress={() => goToScan("delivered")}
                >
                  <FontAwesome5 name="box" color="#fff" size={16} />
                  <Text style={GLOBAL_STYLES.btnText}>DELIVER ITEMS</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        ) : (
          <View
            style={[GLOBAL_STYLES.card, { alignItems: "center", padding: 40 }]}
          >
            <Text style={{ color: COLORS.textSecondary }}>
              No active trips right now.
            </Text>
          </View>
        )}

        {/* SECTION B: UPCOMING QUEUE (Small List) */}
        {upcomingTrips.length > 0 && (
          <>
            <Text style={GLOBAL_STYLES.sectionTitle}>
              Up Next ({upcomingTrips.length})
            </Text>
            {upcomingTrips.map((trip) => (
              <View key={trip.id} style={[GLOBAL_STYLES.card, styles.miniCard]}>
                <View>
                  <Text style={{ color: "#fff", fontWeight: "bold" }}>
                    {trip.tripId}
                  </Text>
                  <Text style={{ color: COLORS.textSecondary, fontSize: 12 }}>
                    {trip.route}
                  </Text>
                </View>
                <View style={[styles.badge, { backgroundColor: COLORS.slate }]}>
                  <Text style={{ color: "#fff", fontSize: 10 }}>SCHEDULED</Text>
                </View>
              </View>
            ))}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// Local styles for specific layout tweaks, using Global Constants
const styles = StyleSheet.create({
  header: {
    padding: 24,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  profileInfo: { flexDirection: "row", gap: 12, alignItems: "center" },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.card,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.slate,
  },
  greeting: { color: COLORS.textSecondary, fontSize: 12 },
  driverName: { color: COLORS.textPrimary, fontSize: 18, fontWeight: "bold" },

  content: { paddingHorizontal: 20, paddingBottom: 40 },

  // Trip Specifics
  tripHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  plateBox: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 8,
    borderRadius: 4,
    justifyContent: "center",
  },
  plateText: { fontWeight: "bold", color: "#000" },

  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  badgeText: { fontWeight: "bold", fontSize: 10, color: "#fff" },
  bgGreen: { backgroundColor: COLORS.success },
  bgBlue: { backgroundColor: COLORS.secondary },

  routeText: { color: "#fff", fontSize: 16, fontWeight: "600" },

  miniCard: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
  },
});
