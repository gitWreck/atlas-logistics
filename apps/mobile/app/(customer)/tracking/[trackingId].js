import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  where,
} from "firebase/firestore";
import { FontAwesome5 } from "@expo/vector-icons";
import { Image } from "expo-image";
import MapView, { Marker, PROVIDER_DEFAULT } from "react-native-maps";

import { db } from "../../../firebase";

// Hardcoded package location for Divisoria (updated coordinates)
const PACKAGE_LOCATION = {
  latitude: 14.605683302722035,
  longitude: 120.96347820295834,
  latitudeDelta: 0.02,
  longitudeDelta: 0.02,
};


const BLUE = "#155DFC";
const GREY = "#94a3b8";
const GREY_LINE = "#e2e8f0";

// Customer-facing shipment journey:
// - Warehouse A ➜ Warehouse B
// - Warehouse B ➜ Customer house
// Codes align with backend status values; labels clarify each leg.
const STATUS_STEPS = [
  {
    code: "RECEIVED",
    label: "RECEIVED",
    source: require("../../../assets/icons/picked-requested.svg"),
  },
  {
    code: "ASSIGNED",
    label: "ASSIGNED TO A TRIP",
    source: require("../../../assets/icons/picked-requested.svg"),
  },
  {
    code: "LOADED",
    label: "LOADED ON TRUCK",
    source: require("../../../assets/icons/picked-requested.svg"),
  },
  {
    code: ["IN_TRANSIT", "OUT_FOR_DELIVERY"],
    label: "IN TRANSIT",
    source: require("../../../assets/icons/in-transit.svg"),
  },
  {
    code: "COMPLETED",
    label: "FOR DELIVERY TO CUSTOMER",
    source: require("../../../assets/icons/picked-requested.svg"),
  },
  {
    code: "OUT_FOR_DELIVERY_CUSTOMER",
    label: "OUT FOR DELIVERY",
    source: require("../../../assets/icons/out-for-delivery.svg"),
  },
  {
    code: "DELIVERED",
    label: "DELIVERED TO YOUR ADDRESS",
    source: require("../../../assets/icons/delivered.png"),
  },
];

export default function CustomerTrackingDetailsScreen() {
  const { trackingId } = useLocalSearchParams();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [data, setData] = useState(null);
  const [photos, setPhotos] = useState([]);

  const normalizedTracking = useMemo(
    () => String(trackingId || "").trim().toUpperCase(),
    [trackingId],
  );

  useEffect(() => {
    const fetchData = async () => {
      if (!normalizedTracking) {
        setError("Invalid tracking number.");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError("");

        // 1) Core tracking data from shipments
        const publicRef = doc(db, "shipments", normalizedTracking);
        const snap = await getDoc(publicRef);

        if (!snap.exists()) {
          setError("Shipment not found. Please check your tracking ID.");
          setLoading(false);
          return;
        }

        const payload = { id: snap.id, ...(snap.data() || {}) };
        setData(payload);

        // 2) Optional photos from tracking_photos
        // const photosQuery = query(
        //   collection(db, "tracking_photos"),
        //   where("trackingNumber", "==", normalizedTracking),
        //   limit(4),
        // );
        // const photosSnap = await getDocs(photosQuery);
        // const photoItems = photosSnap.docs.map((docSnap) => ({
        //   id: docSnap.id,
        //   ...(docSnap.data() || {}),
        // }));
        // setPhotos(photoItems);
      } catch (err) {
        console.error("Failed to load tracking details:", err);
        setError("System offline. Please try again later.");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [normalizedTracking]);

  const activeStepIndex = useMemo(() => {
    if (!data?.status) return 0;
    const current = String(data.status).toUpperCase();
    const idx = STATUS_STEPS.findIndex((s) => {
      if (Array.isArray(s.code)) {
        return s.code.includes(current);
      }
      return s.code === current;
    });
    return idx === -1 ? 0 : idx;
  }, [data?.status]);

  const totalItems = data?.totalPackages ?? 0;
  const loaded = data?.itemsDelivered ?? 0;
  const pending = Math.max(totalItems - loaded, 0);

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
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
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

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      {/* Header - same as trip-details */}
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
        {/* Status + Route row */}
        <View style={styles.statusRouteRow}>
          <View style={styles.statusCard}>
            <Text style={styles.labelMuted}>Current Status</Text>
            <View style={styles.statusPill}>
              <Text style={styles.statusPillText}>
                {data?.status || "Unknown"}
              </Text>
            </View>
            <Text style={styles.updatedText}>Updated just now</Text>
          </View>

          <View style={styles.routeCard}>
            <Text style={styles.labelMuted}>Route</Text>
            <View style={styles.routeRow}>
              <View style={styles.routeEndpoint}>
                <Text style={styles.routeCodeText}>
                  {data?.originCode || "ORIG"}
                </Text>
                <Text style={styles.routeCityText} numberOfLines={1}>
                  {data?.origin || ""}
                </Text>
              </View>

              <FontAwesome5
                name="long-arrow-alt-right"
                size={20}
                color="#64748b"
              />

              <View style={styles.routeEndpoint}>
                <Text style={styles.routeCodeText}>
                  {data?.destinationCode || "DEST"}
                </Text>
                <Text style={styles.routeCityText} numberOfLines={1}>
                  {data?.destination || ""}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Package location map */}
        <View style={styles.mapSectionCard}>
          <Text style={styles.sectionTitle}>Package Location</Text>
          <View style={styles.mapContainer}>
            <MapView
              style={styles.map}
              initialRegion={PACKAGE_LOCATION}
              showsUserLocation={false}
              scrollEnabled={true}
              zoomEnabled={true}
              provider={PROVIDER_DEFAULT}
            >
              <Marker
                coordinate={{
                  latitude: PACKAGE_LOCATION.latitude,
                  longitude: PACKAGE_LOCATION.longitude,
                }}
                title="Your package"
                description="Current package location"
              />
            </MapView>
          </View>
        </View>

        {/* Timeline steps - now vertical, matching TripProgressStepper */}
        <View style={styles.timelineWrapper}>
          {STATUS_STEPS.map((step, index) => {
            const isActive = index <= activeStepIndex;
            const isLineActive = index < activeStepIndex;
            const isLast = index === STATUS_STEPS.length - 1;
            return (
              <View key={step.code} style={styles.timelineStepRow}>
                <View style={styles.timelineLeftColumn}>
                  <View
                    style={[
                      styles.timelineIconCircle,
                      isActive
                        ? styles.timelineIconCircleActive
                        : styles.timelineIconCircleInactive,
                    ]}
                  >
                    <Image
                      source={step.source}
                      style={[
                        styles.timelineStepIcon,
                        { tintColor: isActive ? "#fff" : GREY },
                      ]}
                    />
                  </View>
                  {!isLast && (
                    <View
                      style={[
                        styles.timelineConnector,
                        isLineActive
                          ? styles.timelineConnectorActive
                          : styles.timelineConnectorInactive,
                      ]}
                    />
                  )}
                </View>
                <View style={styles.timelineLabelWrapper}>
                  <Text
                    style={[
                      styles.timelineLabel,
                      isActive && styles.timelineLabelActive,
                    ]}
                  >
                    {step.label}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>

        {/* Proof of delivery / images */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Proof of Delivery / Images</Text>
            {photos.length > 0 && (
              <Text style={styles.sectionCount}>({photos.length})</Text>
            )}
          </View>
          {photos.length === 0 ? (
            <Text style={styles.sectionEmpty}>
              No images have been uploaded yet.
            </Text>
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.photoRow}
            >
              {photos.map((photo) => (
                <Image
                  key={photo.id}
                  source={{ uri: photo.downloadUrl || photo.url }}
                  style={styles.photo}
                />
              ))}
            </ScrollView>
          )}
        </View>

        {/* Totals row */}
        <View style={styles.footerStatsRow}>
          <View style={styles.footerStatCard}>
            <Text style={styles.footerStatLabel}>TOTAL ITEMS</Text>
            <Text style={styles.footerStatValue}>{totalItems}</Text>
          </View>
          <View style={styles.footerStatCard}>
            <Text style={styles.footerStatLabel}>LOADED</Text>
            <Text style={styles.footerStatValue}>{loaded}</Text>
          </View>
          <View style={styles.footerStatCard}>
            <Text style={styles.footerStatLabel}>PENDING</Text>
            <Text style={styles.footerStatValue}>{pending}</Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f1f5f9",
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f1f5f9",
  },
  scroll: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 32,
  },
  centerScroll: {
    flex: 1,
    justifyContent: "center",
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
  statusRouteRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 20,
  },
  statusCard: {
    flex: 1,
    backgroundColor: "#ffffff",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    padding: 14,
  },
  routeCard: {
    flex: 1,
    backgroundColor: "#ffffff",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    padding: 14,
  },
  labelMuted: {
    color: "#64748b",
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: 6,
  },
  statusPill: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "#dcfce7",
  },
  statusPillText: {
    color: "#16a34a",
    fontSize: 12,
    fontWeight: "600",
  },
  updatedText: {
    marginTop: 8,
    color: "#64748b",
    fontSize: 11,
  },
  routeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  routeEndpoint: {
    flex: 1,
  },
  routeCodeText: {
    color: "#0f172a",
    fontSize: 16,
    fontWeight: "700",
  },
  routeCityText: {
    color: "#64748b",
    fontSize: 11,
  },
  timelineWrapper: {
    paddingVertical: 16,
    paddingHorizontal: 4,
    marginBottom: 20,
  },
  timelineStepRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  timelineLeftColumn: {
    width: 32,
    alignItems: "center",
    marginRight: 12,
  },
  timelineIconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    justifyContent: "center",
    alignItems: "center",
  },
  timelineIconCircleActive: {
    backgroundColor: BLUE,
    borderColor: BLUE,
  },
  timelineIconCircleInactive: {
    backgroundColor: "#fff",
    borderColor: GREY_LINE,
  },
  timelineStepIcon: {
    width: 16,
    height: 16,
  },
  timelineConnector: {
    width: 2,
    height: 46,
    marginVertical: 6,
  },
  timelineConnectorActive: {
    backgroundColor: BLUE,
  },
  timelineConnectorInactive: {
    backgroundColor: GREY_LINE,
  },
  timelineLabel: {
    color: GREY,
    fontSize: 12,
  },
  timelineLabelActive: {
    color: "#111827",
    fontWeight: "600",
  },
  timelineLabelWrapper: {
    justifyContent: "center",
    paddingTop: 4,
  },
  mapSectionCard: {
    backgroundColor: "#ffffff",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    padding: 16,
    marginBottom: 20,
  },
  mapContainer: {
    height: 200,
    borderRadius: 12,
    overflow: "hidden",
    marginTop: 10,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  map: {
    width: "100%",
    height: "100%",
  },
  sectionCard: {
    backgroundColor: "#ffffff",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    padding: 16,
    marginBottom: 20,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  sectionTitle: {
    color: "#0f172a",
    fontSize: 13,
    fontWeight: "600",
  },
  sectionCount: {
    color: "#64748b",
    fontSize: 11,
  },
  sectionEmpty: {
    color: "#64748b",
    fontSize: 12,
  },
  photoRow: {
    gap: 10,
  },
  photo: {
    width: 120,
    height: 90,
    borderRadius: 10,
    backgroundColor: "#f1f5f9",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  footerStatsRow: {
    flexDirection: "row",
    backgroundColor: "#ffffff",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    overflow: "hidden",
  },
  footerStatCard: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 12,
    alignItems: "center",
    borderRightWidth: 1,
    borderRightColor: "#e2e8f0",
  },
  footerStatLabel: {
    color: "#64748b",
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: 4,
  },
  footerStatValue: {
    color: "#0f172a",
    fontSize: 16,
    fontWeight: "700",
  },
  errorBox: {
    paddingHorizontal: 24,
    paddingVertical: 20,
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
  errorText: {
    color: "#b91c1c",
    fontSize: 13,
    marginBottom: 12,
  },
  errorButton: {
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "#fee2e2",
  },
  errorButtonText: {
    color: "#991b1b",
    fontSize: 13,
    fontWeight: "600",
  },
});

