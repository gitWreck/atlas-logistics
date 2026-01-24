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
import { collection, query, where, getDocs, limit } from "firebase/firestore";
import { signOut } from "firebase/auth";
import { db, auth } from "../../firebase"; // Ensure auth is imported to get current user

export default function DriverDashboard() {
  const router = useRouter();
  const [currentTrip, setCurrentTrip] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // 1. FETCH ASSIGNED TRIP
  useEffect(() => {
    // In a real app, you'd filter by 'driverId == auth.currentUser.uid'
    // For now, we fetch the first active trip for demo purposes
    const fetchTrip = async () => {
      try {
        const q = query(
          collection(db, "truck_trips"),
          where("status", "in", ["CREATED", "LOADED", "IN_TRANSIT"]),
          // where("driverId", "==", auth.currentUser.uid), // Uncomment when ready
          limit(1),
        );
        const snapshot = await getDocs(q);

        if (!snapshot.empty) {
          const doc = snapshot.docs[0];
          setCurrentTrip({ id: doc.id, ...doc.data() });
        } else {
          setCurrentTrip(null);
        }
      } catch (error) {
        console.error("Error fetching trip:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchTrip();
  }, []);

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
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#fbbf24" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* HEADER */}
      <View style={styles.header}>
        <View style={styles.profileInfo}>
          <View style={styles.avatar}>
            <FontAwesome5 name="user" size={20} color="#fbbf24" />
          </View>
          <View>
            <Text style={styles.greeting}>Welcome back,</Text>
            <Text style={styles.username}>Driver</Text>
          </View>
        </View>
        {/* LOGOUT BUTTON */}
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <FontAwesome5 name="sign-out-alt" size={20} color="#ef4444" />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* A. CURRENT TRIP CARD */}
        {currentTrip ? (
          <View style={styles.tripCard}>
            <View style={styles.tripHeader}>
              <View style={styles.plateBox}>
                <Text style={styles.plateText}>{currentTrip.tripId}</Text>
                <Text style={styles.plateText}>{currentTrip.plateNumber}</Text>
              </View>
              <View
                style={[
                  styles.statusBadge,
                  currentTrip.status === "IN_TRANSIT"
                    ? styles.bgGreen
                    : styles.bgBlue,
                ]}
              >
                <Text
                  style={[
                    styles.statusText,
                    currentTrip.status === "IN_TRANSIT"
                      ? styles.textGreen
                      : styles.textBlue,
                  ]}
                >
                  {currentTrip.status.replace(/_/g, " ")}
                </Text>
              </View>
            </View>

            <Text style={styles.routeLabel}>Route:</Text>
            <Text style={styles.routeText}>
              {currentTrip.route || "Main Hub -> Destination"}
            </Text>

            <View style={styles.statsRow}>
              <View style={styles.stat}>
                <Text style={styles.statVal}>
                  {currentTrip.loadedCount || 0}
                </Text>
                <Text style={styles.statLabel}>Packages</Text>
              </View>
              <View style={styles.stat}>
                <Text style={styles.statVal}>{currentTrip.dropOffs || 1}</Text>
                <Text style={styles.statLabel}>Stops</Text>
              </View>
            </View>
          </View>
        ) : (
          <View style={styles.emptyCard}>
            <FontAwesome5 name="check-circle" size={40} color="#cbd5e1" />
            <Text style={styles.emptyText}>No Active Trip Assigned</Text>
          </View>
        )}

        {/* B. ACTION BUTTONS */}
        {currentTrip && (
          <View style={styles.actionsGrid}>
            {/* 1. START TRIP (Only if Loaded) */}
            {currentTrip.status === "LOADED" && (
              <TouchableOpacity
                style={[styles.bigBtn, styles.btnGreen]}
                onPress={handleStartTrip}
                disabled={actionLoading}
              >
                {actionLoading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <FontAwesome5 name="play" size={24} color="#fff" />
                    <Text style={styles.btnText}>START TRIP</Text>
                  </>
                )}
              </TouchableOpacity>
            )}

            {/* 2. SCAN PICKUP (If you need to add late items) */}
            {/* Usually drivers don't pick up after start, but if required: */}
            <TouchableOpacity
              style={[styles.bigBtn, styles.btnSlate]}
              onPress={() => goToScan("loading", "Pickup Scan")}
            >
              <FontAwesome5 name="box-open" size={24} color="#fff" />
              <Text style={styles.btnText}>SCAN PICKUP</Text>
            </TouchableOpacity>

            {/* 3. DELIVER (Only if In Transit) */}
            {currentTrip.status === "IN_TRANSIT" && (
              <TouchableOpacity
                style={[styles.bigBtn, styles.btnBlue]}
                onPress={() => goToScan("delivered", "Delivery Scan")}
              >
                <FontAwesome5 name="hand-holding-box" size={24} color="#fff" />
                <Text style={styles.btnText}>DELIVER ITEMS</Text>
              </TouchableOpacity>
            )}

            {/* 4. REPORT DELAY (Always Available if active) */}
            <TouchableOpacity
              style={[styles.bigBtn, styles.btnOrange]}
              onPress={() => router.push("/(driver)/delays")}
            >
              <FontAwesome5
                name="exclamation-triangle"
                size={24}
                color="#fff"
              />
              <Text style={styles.btnText}>REPORT DELAY</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0f172a" },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#0f172a",
  },
  header: {
    padding: 20,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  // 👇 NEW STYLE: Groups Avatar + Text horizontally
  profileInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12, // Adds space between the icon and the text
  },
  greeting: { color: "#94a3b8", fontSize: 14 },
  username: { color: "#fff", fontSize: 20, fontWeight: "bold" },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#1e293b",
    alignItems: "center",
    justifyContent: "center",
  },

  content: { padding: 20 },

  // Trip Card
  tripCard: {
    backgroundColor: "#1e293b",
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: "#334155",
  },
  tripHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 15,
  },
  plateBox: {
    backgroundColor: "#fbbf24",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 4,
  },
  plateText: { color: "#000", fontWeight: "800", fontSize: 16 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  bgGreen: { backgroundColor: "#dcfce7" },
  bgBlue: { backgroundColor: "#dbeafe" },
  textGreen: { color: "#166534", fontWeight: "700", fontSize: 10 },
  textBlue: { color: "#1e40af", fontWeight: "700", fontSize: 10 },

  routeLabel: { color: "#94a3b8", fontSize: 12, marginBottom: 4 },
  routeText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 15,
  },

  statsRow: {
    flexDirection: "row",
    gap: 20,
    borderTopWidth: 1,
    borderTopColor: "#334155",
    paddingTop: 15,
  },
  stat: {},
  statVal: { color: "#fff", fontSize: 20, fontWeight: "700" },
  statLabel: { color: "#94a3b8", fontSize: 12 },

  emptyCard: {
    backgroundColor: "#1e293b",
    borderRadius: 16,
    padding: 40,
    alignItems: "center",
    gap: 10,
    marginBottom: 24,
  },
  emptyText: { color: "#94a3b8" },

  // Buttons
  actionsGrid: { gap: 15 },
  bigBtn: {
    height: 80,
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 15,
  },
  btnText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "bold",
    letterSpacing: 1,
  },

  btnGreen: { backgroundColor: "#10b981" },
  btnBlue: { backgroundColor: "#3b82f6" },
  btnOrange: { backgroundColor: "#f59e0b" },
  btnSlate: { backgroundColor: "#334155" },
});
