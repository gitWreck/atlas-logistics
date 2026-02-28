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
  updateTripStatus,
} from "../../components/utilities/FirebaseFunctions";

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
      params: { tripId: trip.id, tripType: trip.tripType },
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

        {/* --- DELAY BANNER WITH CLEAR BUTTON --- */}
        {isDelayed && (
          <View style={styles.delayBanner}>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
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

            {/* The Clear Button embedded in the banner */}
            <TouchableOpacity
              style={{
                marginTop: 12,
                backgroundColor: "#fff",
                paddingVertical: 8,
                borderRadius: 6,
                alignItems: "center",
              }}
              onPress={handleClearDelay}
              disabled={actionLoading}
            >
              <Text
                style={{ color: "#991b1b", fontWeight: "bold", fontSize: 13 }}
              >
                {actionLoading ? "Clearing..." : "CLEAR DELAY"}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        <TripProgressStepper currentStatus={trip.status} />
        <TripStatusRow
          totalShipments={trip.loadedCount ?? 0}
          totalPackages={trip.totalItems ?? 0}
        />
      </ScrollView>

      <View style={styles.bottomActions}>
        {/* ROW 1: PRIMARY ACTION BUTTONS */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          {/* PHASE 2: Report Delay Button (Only visible when driving and NOT delayed) */}
          {isDriving && !isDelayed && (
            <TouchableOpacity
              style={styles.hazardButton}
              onPress={handleReportDelay}
              activeOpacity={0.7}
            >
              <FontAwesome5
                name="exclamation-triangle"
                size={18}
                color="#ef4444"
              />
            </TouchableOpacity>
          )}

          {/* PHASE 1: START TRIP */}
          {isReadyToStart && (
            <View style={{ flex: 1 }}>
              <GradientButton
                title="Start Trip"
                onPress={handleStartTrip}
                loading={actionLoading}
                disabled={actionLoading}
              />
            </View>
          )}

          {/* PHASE 2: MARK ARRIVED */}
          {isDriving && (
            <View style={{ flex: 1 }}>
              <GradientButton
                title="Mark Arrived"
                onPress={() => {
                  Alert.alert(
                    "Mark Arrived",
                    "Have you reached the destination hub?",
                    [
                      { text: "Cancel", style: "cancel" },
                      {
                        text: "Yes, Arrived",
                        onPress: async () => {
                          try {
                            setActionLoading(true);
                            await updateTripStatus({
                              tripId: trip.id,
                              status: "ARRIVED",
                              notify: true, // Set to false if you don't want an automated SMS sent
                            });
                            Alert.alert(
                              "Success",
                              "You have arrived at the hub.",
                            );
                          } catch (error) {
                            console.error("Mark arrived error:", error);
                            Alert.alert(
                              "Error",
                              error.message || "Failed to update trip status.",
                            );
                          } finally {
                            setActionLoading(false);
                          }
                        },
                      },
                    ],
                  );
                }}
                loading={actionLoading}
                disabled={actionLoading}
              />
            </View>
          )}

          {/* PHASE 3: COMPLETE TRIP */}
          {trip?.status === "ARRIVED" && (
            <View style={{ flex: 1 }}>
              <GradientButton
                title="Complete Trip"
                onPress={async () => {
                  Alert.alert("Complete", "Confirm truck is fully unloaded?");
                }}
                loading={actionLoading}
                disabled={actionLoading}
              />
            </View>
          )}
        </View>

        {/* ALWAYS VISIBLE UNLESS COMPLETED: View Shipments */}
        {trip?.status !== "COMPLETED" && (
          <TouchableOpacity
            style={styles.secondaryLink}
            onPress={handleViewShipments}
          >
            <Text style={styles.secondaryLinkText}>View Shipments</Text>
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
    paddingBottom: 14,
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

  // --- BOTTOM BAR NEW STYLES ---
  hazardButton: {
    height: 52,
    width: 52,
    borderRadius: 26,
    backgroundColor: "#fef2f2",
    borderWidth: 1,
    borderColor: "#f87171",
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryLink: {
    marginTop: 16,
    alignItems: "center",
    paddingVertical: 8,
  },
  secondaryLinkText: {
    color: "#067FC6",
    fontWeight: "600",
    fontSize: 15,
  },
});
