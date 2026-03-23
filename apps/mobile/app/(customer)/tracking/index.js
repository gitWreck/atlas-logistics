import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Alert,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { useLocalSearchParams, useRouter } from "expo-router";
import { doc, getDoc } from "firebase/firestore";
import { Image } from "expo-image";

import { db } from "../../../firebase";
import { STATUS_STEPS } from "../../../components/constants/tracking-constants";

// Import our new components
import StatusRouteCard from "../../../components/tracking/StatusRouteCard";
import TrackingMap from "../../../components/tracking/TrackingMap";
import TrackingTimeline from "../../../components/tracking/TrackingTimelines";
import ProofOfDelivery from "../../../components/tracking/ProofOfDelivery";
import ShipmentStats from "../../../components/tracking/ShipmentStats";

// Hardcoded package location for Divisoria
const PACKAGE_LOCATION = {
  latitude: 14.605683302722035,
  longitude: 120.96347820295834,
  latitudeDelta: 0.02,
  longitudeDelta: 0.02,
};

export default function CustomerTrackingDetailsScreen() {
  const { trackingId } = useLocalSearchParams();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [data, setData] = useState(null);
  const [photos, setPhotos] = useState([]);
  const [selectedStepIndex, setSelectedStepIndex] = useState(null);
  // const [pickupLoading, setPickupLoading] = useState(false);
  const mapRef = useRef(null);

  const normalizedTracking = useMemo(
    () =>
      String(trackingId || "")
        .trim()
        .toUpperCase(),
    [trackingId],
  );

  // --- LOGIC: Dynamic Status Steps ---
  const dynamicStatusSteps = useMemo(() => {
    // Determine if it's a pickup order based on your Firebase data flag
    const isPickupOrder = data?.isPickupRequested === true;

    return isPickupOrder
      ? [
          { code: "PENDING_PICKUP", label: "Pending Pickup" },
          { code: "PICKED_UP", label: "Picked Up" },
          { code: "RECEIVED", label: "Received at Hub" },
          { code: "LOADED", label: "Loaded" },
          { code: "IN_TRANSIT", label: "In Transit" },
          { code: "OUT_FOR_DELIVERY", label: "Out for Delivery" },
          { code: "DELIVERED", label: "Delivered" },
        ]
      : [
          { code: "CREATED", label: "Created" },
          { code: "RECEIVED", label: "Received at Hub" },
          { code: "LOADED", label: "Loaded" },
          { code: "IN_TRANSIT", label: "In Transit" },
          { code: "OUT_FOR_DELIVERY", label: "Out for Delivery" },
          { code: "DELIVERED", label: "Delivered" },
        ];
  }, [data?.isPickupRequested]);

  const fetchData = useCallback(async () => {
    if (!normalizedTracking) {
      setError("Invalid tracking number.");
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError("");

      const publicRef = doc(db, "shipments", normalizedTracking);
      const snap = await getDoc(publicRef);

      if (!snap.exists()) {
        setError("Shipment not found. Please check your tracking ID.");
        setLoading(false);
        return;
      }

      setData({ id: snap.id, ...snap.data() });
      // NOTE: Add Photos fetching here if needed later
    } catch (err) {
      console.error("Failed to load tracking details:", err);
      setError("System offline. Please try again later.");
    } finally {
      setLoading(false);
    }
  }, [normalizedTracking]);

  // --- DATA FETCHING ---
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const activeStepIndex = useMemo(() => {
    if (!data?.status) return 0;
    const current = String(data.status).toUpperCase();
    const idx = dynamicStatusSteps.findIndex((s) => {
      if (Array.isArray(s.code)) return s.code.includes(current);
      return s.code === current;
    });
    return idx === -1 ? 0 : idx;
  }, [data?.status]);

  // --- LOGIC: Stats ---
  const totalItems = data?.totalPackages ?? 0;
  const loaded = data?.itemsDelivered ?? 0;
  const pending = Math.max(totalItems - loaded, 0);

  // --- LOGIC: Location Parsing ---
  // (Kept in parent because it requires heavy processing of raw data)
  const statusHistoryLocations = useMemo(() => {
    if (!data?.statusHistory || !Array.isArray(data.statusHistory)) return [];

    return data.statusHistory
      .map((entry) => {
        const rawStatus = entry?.status || entry?.code || "";
        const status = String(rawStatus).toUpperCase().trim();

        // Only include if status is in our known steps
        const stepIndex = dynamicStatusSteps.findIndex((step) => {
          const codes = Array.isArray(step.code) ? step.code : [step.code];
          return codes.some((c) => String(c).toUpperCase() === status);
        });

        if (stepIndex === -1) return null;

        const lat = entry?.location?.lat || entry?.location?.latitude;
        const lng = entry?.location?.lng || entry?.location?.longitude;

        if (!lat || !lng) return null;
        return { latitude: lat, longitude: lng };
      })
      .filter(Boolean);
  }, [data?.statusHistory]);

  const statusLocationsPerStep = useMemo(() => {
    const buckets = dynamicStatusSteps.map(() => []);
    if (!data?.statusHistory) return buckets;

    data.statusHistory.forEach((entry) => {
      const rawStatus = entry?.status || entry?.code || "";
      const status = String(rawStatus).toUpperCase().trim();
      const lat = entry?.location?.lat || entry?.location?.latitude;
      const lng = entry?.location?.lng || entry?.location?.longitude;

      if (!lat || !lng) return;

      const coordinate = { latitude: lat, longitude: lng };
      const stepIndex = dynamicStatusSteps.findIndex((step) => {
        const codes = Array.isArray(step.code) ? step.code : [step.code];
        return codes.some((c) => String(c).toUpperCase() === status);
      });

      if (stepIndex >= 0) {
        buckets[stepIndex].push({ coordinate, raw: entry });
      }
    });
    return buckets;
  }, [data?.statusHistory]);

  // --- LOGIC: Map Animation ---
  const latestLocation =
    statusHistoryLocations.length > 0
      ? statusHistoryLocations[statusHistoryLocations.length - 1]
      : null;

  const initialRegion = useMemo(() => {
    if (latestLocation) {
      return {
        latitude: latestLocation.latitude,
        longitude: latestLocation.longitude,
        latitudeDelta: 0.02,
        longitudeDelta: 0.02,
      };
    }
    return PACKAGE_LOCATION;
  }, [latestLocation]);

  const selectedLocation = useMemo(() => {
    if (selectedStepIndex == null) return latestLocation;
    const bucket = statusLocationsPerStep[selectedStepIndex];
    if (!bucket || bucket.length === 0) return latestLocation;
    return bucket[bucket.length - 1].coordinate;
  }, [latestLocation, selectedStepIndex, statusLocationsPerStep]);

  useEffect(() => {
    if (!mapRef.current || !selectedLocation) return;
    mapRef.current.animateToRegion(
      { ...selectedLocation, latitudeDelta: 0.02, longitudeDelta: 0.02 },
      350,
    );
  }, [selectedLocation]);

  // --- RENDER STATES ---

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <StatusBar style="dark" />
        <ActivityIndicator size="large" color="#042C83" />
      </View>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar style="dark" />
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backBtn}
          >
            <Image
              source={require("../../../assets/icons/back.svg")}
              style={{ width: 20, height: 20 }}
            />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Tracking Details</Text>
        </View>
        <View style={[styles.scroll, styles.centerScroll]}>
          <View style={styles.errorBox}>
            <Text style={styles.errorTitle}>Oops</Text>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity
              onPress={() => router.back()}
              style={styles.errorButton}
            >
              <Text style={styles.errorButtonText}>Go back</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // --- MAIN RENDER ---
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Image
            source={require("../../../assets/icons/back.svg")}
            style={{ width: 20, height: 20 }}
          />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Tracking Details</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* 1. Status & Route */}
        <StatusRouteCard
          status={data?.status}
          originCode={data?.originCode}
          origin={data?.origin}
          destCode={data?.destinationCode}
          destination={data?.destination}
        />

        {/* 2. Map */}
        <TrackingMap
          mapRef={mapRef}
          initialRegion={initialRegion}
          historyLocations={statusHistoryLocations}
          packageLocation={PACKAGE_LOCATION}
        />

        {/* 3. Timeline */}
        <TrackingTimeline
          steps={dynamicStatusSteps}
          activeIndex={activeStepIndex}
          selectedIndex={selectedStepIndex}
          onSelectStep={(idx) =>
            setSelectedStepIndex((prev) => (prev === idx ? null : idx))
          }
          locationsPerStep={statusLocationsPerStep}
        />

        {/* 4. Photos */}
        <ProofOfDelivery photos={photos} />

        {/* 5. Footer Stats */}
        <ShipmentStats total={totalItems} loaded={loaded} pending={pending} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f1f5f9" },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f1f5f9",
  },
  scroll: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 32 },
  centerScroll: { flex: 1, justifyContent: "center" },
  header: {
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 15,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  backBtn: { padding: 0 },
  headerTitle: {
    color: "#0f172a",
    fontSize: 16,
    fontWeight: "bold",
    flex: 1,
    marginLeft: 12,
  },
  // Error styles
  errorBox: {
    padding: 24,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#fecaca",
    backgroundColor: "#fef2f2",
    marginHorizontal: 20,
  },
  errorTitle: {
    color: "#991b1b",
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 6,
  },
  errorText: { color: "#b91c1c", fontSize: 13, marginBottom: 12 },
  errorButton: {
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "#fee2e2",
  },
  errorButtonText: { color: "#991b1b", fontSize: 13, fontWeight: "600" },
  requestPickupButton: {
    marginTop: 14,
    marginBottom: 12,
    backgroundColor: "#042C83",
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  requestPickupButtonDisabled: {
    opacity: 0.7,
  },
  requestPickupButtonText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "700",
  },
});
