import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { FontAwesome5 } from "@expo/vector-icons";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../../firebase";
import { COLORS, GLOBAL_STYLES } from "../../components/constants/theme";

// ✅ IMPORT THE NEW COMPONENTS
import TripSummaryCard from "../../components/driver/trip/TripSummaryCard";
import TripProgressStepper from "../../components/driver/trip/TripProgressStepper";
import TripStatusRow from "../../components/driver/trip/TripStatusRow";
import TripActionButtons from "../../components/driver/trip/TripActionButtons";
import { startTrip } from "../../components/utilities/FirebaseFunctions";

export default function TripDetailsScreen() {
  const { tripId } = useLocalSearchParams();
  const router = useRouter();
  const [trip, setTrip] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false); // Add this state

  useEffect(() => {
    if (!tripId) return;
    const unsub = onSnapshot(doc(db, "truck_trips", tripId), (docSnap) => {
      if (docSnap.exists()) {
        setTrip({ id: docSnap.id, ...docSnap.data() });
      } else {
        Alert.alert("Error", "Trip not found");
        router.back();
      }
      setLoading(false);
    });
    return () => unsub();
  }, [tripId]);

  if (loading) {
    return (
      <View style={GLOBAL_STYLES.center}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  // Handlers
  const handleViewShipments = () => {
    router.push({
      pathname: "/(driver)/shipments",
      params: { tripId: trip.id },
    });
  };

  const handleReportDelay = () => {
    router.push({
      pathname: "/(driver)/report-delay",
      params: { tripId: trip.id },
    });
  };

  const handleStartTrip = async () => {
    Alert.alert(
      "Start Trip",
      "Are you sure you want to start the route? This will mark all packages as Out for Delivery.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "START NOW",
          onPress: async () => {
            setActionLoading(true);
            try {
              // Call the Cloud Function or Update Doc directly
              // If you have a specific function for 'startTrip', use it.
              // Otherwise, update the doc:
              /* await updateDoc(doc(db, "truck_trips", tripId), {
                    status: "IN_TRANSIT",
                    startedAt: serverTimestamp()
                 });
              */

              // Using Cloud Function (Recommended for the automation)
              await startTrip({ tripId: trip.id });

              Alert.alert("Success", "Trip Started! Drive Safely.");
            } catch (error) {
              Alert.alert("Error", error.message);
            } finally {
              setActionLoading(false);
            }
          },
        },
      ],
    );
  };

  return (
    <SafeAreaView style={GLOBAL_STYLES.container}>
      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <FontAwesome5 name="arrow-left" size={20} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Trip Details</Text>
        <View style={{ width: 20 }} />
      </View>

      {/* CONTENT */}
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* 1. Summary Card */}
        <TripSummaryCard trip={trip} />

        {/* 2. Timeline */}
        <Text style={GLOBAL_STYLES.sectionTitle}>Status Timeline</Text>
        <TripProgressStepper currentStatus={trip.status} />

        {/* 3. Stats */}
        <TripStatusRow
          totalShipments={trip.loadedCount || 0}
          totalPackages={trip.totalItems || 0}
        />
      </ScrollView>

      <TripActionButtons
        status={trip?.status}
        loading={actionLoading}
        onStartTrip={handleStartTrip} // The function we wrote earlier
        onViewShipments={handleViewShipments}
        onReportDelay={handleReportDelay}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    padding: 20,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  headerTitle: { color: "#fff", fontSize: 18, fontWeight: "bold" },
  backBtn: { padding: 8 },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 150 }, // Added padding for bottom buttons
});
