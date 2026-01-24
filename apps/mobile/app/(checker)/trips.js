import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
} from "react-native";
import { FontAwesome5 } from "@expo/vector-icons";
import { useRouter } from "expo-router";
// 1. IMPORT FIREBASE
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
} from "firebase/firestore";
import { db } from "../../firebase"; // Adjust path to your firebase config

export default function TripsScreen() {
  const router = useRouter();
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);

  // 2. FETCH REAL DATA
  useEffect(() => {
    // Query: Get all trips that are NOT completed (Active)
    const q = query(
      collection(db, "truck_trips"),
      where("status", "in", ["CREATED", "LOADING", "OUT_FOR_DELIVERY"]),
      // Note: You might need a composite index for 'status' + 'createdAt'.
      // If the app crashes, remove orderBy temporarily or check your Firebase Console logs for the index link.
      orderBy("createdAt", "desc"),
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const fetchedTrips = snapshot.docs.map((doc) => {
          const data = doc.data();
          return {
            id: doc.id,
            plate: data.plateNumber || "No Plate",
            status: data.status || "UNKNOWN",
            // Map your specific fields here
            loaded: data.totalLoaded || 0,
            total: data.totalItems || 0, // Ensure you use the correct field name (totalItems vs packageTotal)
          };
        });
        setTrips(fetchedTrips);
        setLoading(false);
      },
      (error) => {
        console.error("Error fetching trips:", error);
        setLoading(false);
      },
    );

    return () => unsubscribe();
  }, []);

  const handlePress = (trip) => {
    router.push({
      pathname: "/(checker)/trip-details",
      params: { tripId: trip.id, plate: trip.plate },
    });
  };

  const renderTripItem = ({ item }) => {
    // Avoid NaN if total is 0
    const progress = item.total > 0 ? (item.loaded / item.total) * 100 : 0;

    return (
      <TouchableOpacity style={styles.card} onPress={() => handlePress(item)}>
        <View style={styles.cardHeader}>
          <View style={styles.iconBox}>
            <FontAwesome5 name="truck" size={16} color="#3b82f6" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.tripId}>{item.id}</Text>
            <Text style={styles.plate}>{item.plate}</Text>
          </View>
          <View
            style={[
              styles.badge,
              item.status === "LOADING" ? styles.badgeBlue : styles.badgePurple,
              item.status === "OUT_FOR_DELIVERY" && styles.badgeOrange, // Add style for delivery
            ]}
          >
            <Text style={styles.badgeText}>
              {item.status.replace(/_/g, " ")}
            </Text>
          </View>
        </View>

        <View style={styles.progressContainer}>
          <Text style={styles.progressValue}>
            {item.loaded} / {item.total} Loaded
          </Text>
          <View style={styles.progressBarBg}>
            <View style={[styles.progressBarFill, { width: `${progress}%` }]} />
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Active Trips</Text>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#3b82f6" />
          <Text style={{ marginTop: 10, color: "#64748b" }}>
            Loading Trips...
          </Text>
        </View>
      ) : (
        <FlatList
          data={trips}
          keyExtractor={(item) => item.id}
          renderItem={renderTripItem}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <Text style={styles.emptyText}>No active trips found.</Text>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0f172a" }, // Dark Bg
  header: {
    padding: 24,
    backgroundColor: "#0f172a",
    borderBottomWidth: 1,
    borderColor: "#334155",
  }, // Dark Header
  title: { fontSize: 24, fontWeight: "800", color: "#fff" }, // White Text
  listContent: { padding: 16, gap: 16 },

  // Card Styles
  card: {
    backgroundColor: "#1e293b",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#334155",
  }, // Dark Card
  cardHeader: {
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
    marginBottom: 12,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: "#334155",
    alignItems: "center",
    justifyContent: "center",
  }, // Darker Icon Box
  tripId: { fontSize: 16, fontWeight: "700", color: "#fff" }, // White ID
  plate: { fontSize: 12, color: "#94a3b8" }, // Gray Plate

  // Badges (Keep colored backgrounds but maybe adjust for dark mode contrast)
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  badgeBlue: { backgroundColor: "rgba(59, 130, 246, 0.2)" }, // Transparent Blue
  badgePurple: { backgroundColor: "rgba(168, 85, 247, 0.2)" },
  badgeOrange: { backgroundColor: "rgba(251, 191, 36, 0.2)" },

  badgeText: { fontSize: 10, fontWeight: "700", color: "#e2e8f0" }, // Light Text

  // Progress Bar
  progressContainer: { gap: 6 },
  progressValue: {
    fontSize: 12,
    fontWeight: "700",
    color: "#cbd5e1",
    textAlign: "right",
  },
  progressBarBg: {
    height: 6,
    backgroundColor: "#334155",
    borderRadius: 3,
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    backgroundColor: "#3b82f6",
    borderRadius: 3,
  },

  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  emptyText: { textAlign: "center", color: "#64748b", marginTop: 40 },
});
