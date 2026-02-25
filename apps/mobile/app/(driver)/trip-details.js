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
import { doc, onSnapshot, updateDoc } from "firebase/firestore"; // ADDED updateDoc
import { db } from "../../firebase";
import { StatusBar } from "expo-status-bar";
import GetLocation from "react-native-get-location";

import TripSummaryCard from "../../components/driver/trip/TripSummaryCard";
import TripProgressStepper from "../../components/driver/trip/TripProgressStepper";
import TripStatusRow from "../../components/driver/trip/TripStatusRow";
import GradientButton from "../../components/ui/figma/GradientButton";
import {
  clearTruckDelay,
  startTrip,
} from "../../components/utilities/FirebaseFunctions";
import { Image } from "expo-image";

export default function TripDetailsScreen() {
  const { tripId } = useLocalSearchParams();
  const router = useRouter();
  const [trip, setTrip] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const getCurrentLocationSafe = async () => {
    try {
      const loc = await GetLocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 15000,
      });

      if (!loc) return null;
      return {
        lat: loc.latitude,
        lng: loc.longitude,
      };
    } catch (error) {
      console.log("Location error (startTrip):", error);
      return null;
    }
  };

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
      <View style={[styles.center, { backgroundColor: "#f1f5f9" }]}>
        <ActivityIndicator size="large" color="#042C83" />
      </View>
    );
  }

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
              const location = await getCurrentLocationSafe();
              await startTrip({
                tripId: trip.id,
                ...(location ? { location } : {}),
              });
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

  // --- NEW: Clear Delay Function ---
  // Make sure to add these imports at the top of your file if you haven't already:
  // import { getFunctions, httpsCallable } from "firebase/functions";

  const handleClearDelay = async () => {
    Alert.alert(
      "Resume Trip",
      "Are you ready to clear the delay and resume driving?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Resume",
          onPress: async () => {
            try {
              setActionLoading(true);

              // 2. Call the Cloud Function with the expected payload
              await clearTruckDelay({
                truckTripId: trip.id,
                notify: true, // Set to false if you want to silently clear the delay without SMS
              });

              Alert.alert("Success", "Delay cleared. Drive safely!");
            } catch (error) {
              console.error("Clear delay error:", error);
              Alert.alert(
                "Error",
                error.message || "Failed to clear the delay.",
              );
            } finally {
              setActionLoading(false);
            }
          },
        },
      ],
    );
  };

  const isReadyToStart =
    trip?.status === "LOADED" || trip?.status === "ASSIGNED";
  const isDriving = trip?.status === "IN_TRANSIT";

  // --- NEW: Delay Logic Variable ---
  const isDelayed = trip?.delayCleared === false && !!trip?.delayReason;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <FontAwesome5 name="arrow-left" size={15} color="#0f172a" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Trip Details</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <TripSummaryCard trip={trip} />

        {/* --- NEW: DELAY BANNER --- */}
        {isDelayed && (
          <View style={styles.delayBanner}>
            <FontAwesome5
              name="exclamation-triangle"
              size={18}
              color="#991b1b"
            />
            <View style={styles.delayTextContainer}>
              <Text style={styles.delayTitle}>Delay Approved</Text>
              <Text style={styles.delaySubtitle}>
                {trip.delayReason
                  ? trip.delayReason.replace(/_/g, " ")
                  : "Admin has approved your delay."}
              </Text>
            </View>
          </View>
        )}

        <TripProgressStepper currentStatus={trip.status} />
        <TripStatusRow
          totalShipments={trip.loadedCount ?? 0}
          totalPackages={trip.totalItems ?? 0}
        />
      </ScrollView>

      <View style={styles.bottomActions}>
        {isReadyToStart ? (
          <GradientButton
            title="Start Trip"
            onPress={handleStartTrip}
            loading={actionLoading}
            disabled={actionLoading}
          />
        ) : (
          <GradientButton
            title="View Shipments"
            onPress={handleViewShipments}
          />
        )}

        {/* --- NEW: DYNAMIC REPORT/CLEAR DELAY LINKS --- */}

        {/* 1. Show "Report Delay" ONLY if driving AND not currently delayed */}
        {isDriving && !isDelayed && (
          <TouchableOpacity
            style={styles.reportDelayLink}
            onPress={handleReportDelay}
            activeOpacity={0.7}
          >
            <FontAwesome5
              name="exclamation-triangle"
              size={14}
              color="#ef4444"
              style={{ marginRight: 6 }}
            />
            <Text style={styles.reportDelayText}>Report Delay</Text>
          </TouchableOpacity>
        )}

        {/* 2. Show "Clear Delay" ONLY if currently delayed */}
        {isDelayed && (
          <TouchableOpacity
            style={[styles.reportDelayLink, { marginTop: 16 }]}
            onPress={handleClearDelay}
            activeOpacity={0.7}
            disabled={actionLoading}
          >
            <FontAwesome5
              name="check-circle"
              size={16}
              color="#10b981"
              style={{ marginRight: 6 }}
            />
            <Text
              style={[
                styles.reportDelayText,
                { color: "#10b981", fontSize: 16 },
              ]}
            >
              {actionLoading ? "Clearing..." : "Clear Delay & Resume Trip"}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f1f5f9",
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 15,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  backBtn: {
    padding: 0,
  },
  headerTitle: {
    color: "#0f172a",
    fontSize: 16,
    fontWeight: "bold",
    flex: 1,
    marginLeft: 12,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 120,
  },
  bottomActions: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#ffffff",
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 34,
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
  },
  reportDelayLink: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 12,
  },
  reportDelayText: {
    fontSize: 14,
    color: "#ef4444",
    fontWeight: "500",
  },

  // --- NEW DELAY BANNER STYLES ---
  delayBanner: {
    flexDirection: "row",
    backgroundColor: "#fef2f2",
    borderColor: "#f87171",
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,

    marginBottom: 16,
    alignItems: "center",

    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  delayTextContainer: {
    marginLeft: 12,
    flex: 1,
  },
  delayTitle: {
    color: "#991b1b",
    fontSize: 14,
    fontWeight: "bold",
    textTransform: "uppercase",
  },
  delaySubtitle: {
    color: "#b91c1c",
    fontSize: 12,
    marginTop: 2,
  },
});
