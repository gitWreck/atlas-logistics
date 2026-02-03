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
import { StatusBar } from "expo-status-bar";

import TripSummaryCard from "../../components/driver/trip/TripSummaryCard";
import TripProgressStepper from "../../components/driver/trip/TripProgressStepper";
import TripStatusRow from "../../components/driver/trip/TripStatusRow";
import GradientButton from "../../components/ui/figma/GradientButton";
import { startTrip } from "../../components/utilities/FirebaseFunctions";
import { Image } from "expo-image";

export default function TripDetailsScreen() {
  const { tripId } = useLocalSearchParams();
  const router = useRouter();
  const [trip, setTrip] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

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
              await startTrip({ tripId: trip.id });
              Alert.alert("Success", "Trip Started! Drive Safely.");
            } catch (error) {
              Alert.alert("Error", error.message);
            } finally {
              setActionLoading(false);
            }
          },
        },
      ]
    );
  };

  const isReadyToStart = trip?.status === "LOADED" || trip?.status === "ASSIGNED";
  const isDriving = trip?.status === "IN_TRANSIT";

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      {/* Header: light theme like index.js */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Image
            source={require("../../assets/icons/back.svg")}
            style={{ width: 14, height: 14 }}
          />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Trip Details</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <TripSummaryCard trip={trip} />
        <TripProgressStepper currentStatus={trip.status} />
        <TripStatusRow
          totalShipments={trip.loadedCount ?? 0}
          totalPackages={trip.totalItems ?? 0}
        />
      </ScrollView>

      {/* Bottom CTA: GradientButton - View Shipments or Start Trip */}
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
        {isDriving && (
          <TouchableOpacity
            style={styles.reportDelayLink}
            onPress={handleReportDelay}
            activeOpacity={0.7}
          >
            <FontAwesome5 name="exclamation-triangle" size={14} color="#ef4444" style={{ marginRight: 6 }} />
            <Text style={styles.reportDelayText}>Report Delay</Text>
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
    flexDirection: "column",
    alignItems: "flex-start",
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  backBtn: { 
    padding: 0, 
    marginBottom: 10,
  },
  headerTitle: {
    color: "#0f172a",
    fontSize: 16,
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
});
