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
import { FontAwesome5 } from "@expo/vector-icons";
import { getFunctions, httpsCallable } from "firebase/functions";
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
} from "firebase/firestore";
import { signOut } from "firebase/auth";
import { db, auth } from "../../firebase";
import { COLORS, GLOBAL_STYLES } from "../../components/constants/theme";

export default function DriverDashboard() {
  const router = useRouter();
  const uid = auth.currentUser?.uid;

  const [activeTrip, setActiveTrip] = useState(null);
  const [upcomingTrips, setUpcomingTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false); // Added this missing state
  const [driverName, setDriverName] = useState("Driver");
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = async () => {
    if (!uid) return;
    try {
      const userRef = doc(db, "users", uid);
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

      const allTrips = tripSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

      // Priority Logic
      const current =
        allTrips.find((t) => t.status === "IN_TRANSIT") ||
        allTrips.find((t) => t.status === "LOADED");

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

  // ✅ UPDATED: Accepts specific 'trip' object
  const handleStartTrip = async (trip) => {
    // Safety: Don't switch if currently driving another truck
    if (
      activeTrip &&
      activeTrip.status === "IN_TRANSIT" &&
      activeTrip.id !== trip.id
    ) {
      Alert.alert(
        "Busy",
        "You must finish your current trip before starting a new one.",
      );
      return;
    }

    Alert.alert("Start Trip", `Start trip ${trip.tripId}?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Start Now",
        onPress: async () => {
          setActionLoading(true);
          try {
            const functions = getFunctions(undefined, "asia-southeast1");
            const updateTripStatus = httpsCallable(
              functions,
              "updateTripStatus",
            );

            // Call Cloud Function
            await updateTripStatus({ tripId: trip.id, status: "IN_TRANSIT" });

            Alert.alert("Success", "Trip started! Drive safely.");

            // Optimistic Update: Move this trip to 'activeTrip' locally
            const updatedTrip = { ...trip, status: "IN_TRANSIT" };
            setActiveTrip(updatedTrip);
            setUpcomingTrips((prev) => prev.filter((t) => t.id !== trip.id));
          } catch (error) {
            Alert.alert("Error", error.message);
          } finally {
            setActionLoading(false);
          }
        },
      },
    ]);
  };

  // ✅ NEW: Handle clicks on Upcoming Trips
  const handleUpcomingPress = (trip) => {
    if (trip.status === "LOADED") {
      // It's ready to go, offer to start it
      handleStartTrip(trip);
    } else {
      // It's assigned but not loaded yet
      Alert.alert(
        "Not Ready",
        `Trip ${trip.tripId} is currently ${trip.status}. It must be LOADED by a checker before you can start.`,
      );
    }
  };

  // Navigation
  const goToScan = (mode) => {
    if (!activeTrip) return;
    router.push({
      pathname: "/(driver)/scan",
      params: {
        mode,
        title: mode === "delivered" ? "Delivery Scan" : "Scan",
        tripId: activeTrip.id,
      },
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
        {/* SECTION A: ACTIVE JOB */}
        <Text style={GLOBAL_STYLES.sectionTitle}>Current Job</Text>

        {activeTrip ? (
          <View style={GLOBAL_STYLES.card}>
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

            <View style={{ gap: 12, marginTop: 16 }}>
              {activeTrip.status === "LOADED" && (
                <TouchableOpacity
                  style={[
                    GLOBAL_STYLES.btn,
                    { backgroundColor: COLORS.success },
                  ]}
                  onPress={() => handleStartTrip(activeTrip)}
                  disabled={actionLoading}
                >
                  {actionLoading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <FontAwesome5 name="play" color="#fff" size={16} />
                  )}
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

        {/* SECTION B: UPCOMING QUEUE */}
        {upcomingTrips.length > 0 && (
          <>
            <Text style={GLOBAL_STYLES.sectionTitle}>
              Up Next ({upcomingTrips.length})
            </Text>
            {upcomingTrips.map((trip) => (
              // ✅ CHANGED: View -> TouchableOpacity
              <TouchableOpacity
                key={trip.id}
                style={[GLOBAL_STYLES.card, styles.miniCard]}
                onPress={() => handleUpcomingPress(trip)}
              >
                <View>
                  <Text style={{ color: "#fff", fontWeight: "bold" }}>
                    {trip.tripId}
                  </Text>
                  <Text style={{ color: COLORS.textSecondary, fontSize: 12 }}>
                    {trip.route}
                  </Text>
                </View>
                {/* Visual Cue: Show 'Start' icon if ready */}
                <View
                  style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
                >
                  <View
                    style={[styles.badge, { backgroundColor: COLORS.slate }]}
                  >
                    <Text style={{ color: "#fff", fontSize: 10 }}>
                      {trip.status}
                    </Text>
                  </View>
                  {trip.status === "LOADED" && (
                    <FontAwesome5
                      name="play-circle"
                      size={24}
                      color={COLORS.success}
                    />
                  )}
                </View>
              </TouchableOpacity>
            ))}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

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
