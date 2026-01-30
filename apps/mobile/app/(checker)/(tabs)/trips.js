import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  SafeAreaView,
  ActivityIndicator,
  Platform,
  StatusBar,
} from "react-native";
import { useRouter } from "expo-router";
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
} from "firebase/firestore";
import { db } from "../../../firebase";
import { COLORS, GLOBAL_STYLES } from "../../../components/constants/theme";

// ✅ Import the new component
import CheckerTripCard from "../../../components/checker/CheckerTripCard";

export default function TripsScreen() {
  const router = useRouter();
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 1. QUERY: Active Trips for Checkers (Created, Assigned, Loading)
    // Note: Removed 'OUT_FOR_DELIVERY' as usually checkers are done by then,
    // but you can add it back if checkers need to review departed trucks.
    const q = query(
      collection(db, "truck_trips"),
      where("status", "in", ["CREATED", "ASSIGNED", "LOADING"]),
      orderBy("createdAt", "desc"),
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const fetchedTrips = snapshot.docs.map((doc) => {
          const data = doc.data();

          console.log("CHECKER TRIPS: ", data);
          return {
            id: doc.id,
            plate: data.plateNumber || "No Plate",
            status: data.status || "UNKNOWN",
            route: data.route || "No Route",
            loaded: data.totalLoaded || 0, // Using unified field names
            total: data.totalItems || 0,
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

  return (
    <SafeAreaView style={GLOBAL_STYLES.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Active Loads</Text>
        <Text style={styles.subtitle}>{trips.length} trucks in yard</Text>
      </View>

      {/* List */}
      {loading ? (
        <View style={GLOBAL_STYLES.center}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : (
        <FlatList
          data={trips}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <CheckerTripCard trip={item} onPress={handlePress} />
          )}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No active trips found.</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    padding: 24,
    borderBottomWidth: 1,
    borderBottomColor: "#1e293b",
    paddingTop: Platform.OS === "android" ? StatusBar.currentHeight : 0,
  },
  title: { fontSize: 24, fontWeight: "800", color: "#fff" },
  subtitle: { color: "#94a3b8", fontSize: 14, marginTop: 4 },

  listContent: { padding: 20, paddingBottom: 50 },

  emptyContainer: { alignItems: "center", marginTop: 50 },
  emptyText: { color: "#64748b" },
});
