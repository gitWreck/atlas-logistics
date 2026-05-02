import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
  StatusBar as RNStatusBar,
  UIManager,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { FontAwesome5 } from "@expo/vector-icons";
import { doc, onSnapshot } from "firebase/firestore";
import { StatusBar } from "expo-status-bar";

import { db } from "../../firebase";

import { useAuth } from "../../contexts/AuthContext.js";
import { getCurrentLocationSafe } from "../utilities/helpers";

import TripSummaryCard from "./TripSummaryCard";
import TripProgressStepper from "./TripProgressStepper";
import TripStatusRow from "./TripStatusRow";
import GradientButton from "../ui/figma/GradientButton";

import {
  clearTruckDelay,
  startTrip,
  updateTripStatus,
} from "../utilities/FirebaseFunctions";

export default function TripDetailsScreen() {
  if (
    Platform.OS === "android" &&
    UIManager.setLayoutAnimationEnabledExperimental
  ) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
  }

  const { tripId } = useLocalSearchParams();
  const router = useRouter();
  const { role, isChecker, isDriver } = useAuth();

  const [trip, setTrip] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    if (!tripId) {
      setLoading(false);
      return;
    }

    const unsub = onSnapshot(
      doc(db, "truck_trips", String(tripId)),
      (docSnap) => {
        if (docSnap.exists()) {
          setTrip({
            id: docSnap.id,
            ...docSnap.data(),
          });
        } else {
          Alert.alert("Error", "Trip not found");
          router.back();
        }
        setLoading(false);
      },
      (error) => {
        console.error("Trip details subscription error:", error);
        Alert.alert("Error", "Failed to load trip details.");
        setLoading(false);
      },
    );

    return () => unsub();
  }, [tripId, router]);

  const isReadyToStart = trip?.status === "LOADED";
  const hasLockedManifest = trip?.manifestLocked === true && !!trip?.manifestId;
  const isDriving = trip?.status === "IN_TRANSIT";
  const isArrived = trip?.status === "ARRIVED";
  const isCompleted = trip?.status === "COMPLETED";

  const isDelayed = trip?.delayCleared === false && !!trip?.delayReason;

  const roleLabel = useMemo(() => {
    if (isChecker) return "Checker";
    if (isDriver) return "Driver";
    return role || "User";
  }, [isChecker, isDriver, role]);

  const canViewShipments = !!trip && !isCompleted;
  const canDriverStartTrip = isDriver && isReadyToStart && hasLockedManifest;
  const shouldShowManifestLockNotice =
    isDriver && isReadyToStart && !hasLockedManifest;
  const canDriverReportDelay = isDriver && isDriving && !isDelayed;
  const canDriverClearDelay = isDriver && isDelayed;
  const canDriverMarkArrived = isDriver && isDriving;
  const canDriverCompleteTrip = isDriver && isArrived;

  const canCheckerOpenShipments = isChecker && !!trip;
  const hasAnyBottomAction =
    canDriverStartTrip ||
    canDriverReportDelay ||
    canDriverMarkArrived ||
    canDriverCompleteTrip ||
    canViewShipments ||
    canCheckerOpenShipments;

  const handleViewShipments = () => {
    const basePath = isChecker
      ? "/(checker)/trip-shipments"
      : "/(driver)/trip-shipments";

    router.push({
      pathname: basePath,
      params: {
        tripId: trip.id,
        tripType: trip.tripType || "",
      },
    });
  };

  const handleReportDelay = () => {
    if (!isDriver) return;

    router.push({
      pathname: "/(driver)/report-delay",
      params: {
        tripId: trip.id,
        tripType: trip.tripType || "",
      },
    });
  };

  const handleStartTrip = async () => {
    if (!hasLockedManifest) {
      Alert.alert(
        "Manifest Required",
        "This trip can only be started after its manifest has been locked.",
      );
      return;
    }

    Alert.alert(
      "Start Trip",
      "Are you sure you want to start the route? This will mark all shipment with packages as In Transit.",
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
              Alert.alert("Success", "Trip started. Drive safely.");
            } catch (error) {
              console.error("Start trip error:", error);
              Alert.alert("Error", error?.message || "Failed to start trip.");
            } finally {
              setActionLoading(false);
            }
          },
        },
      ],
    );
  };

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

              await clearTruckDelay({
                tripId: trip.id,
                notify: true,
              });

              Alert.alert("Success", "Delay cleared. Drive safely.");
            } catch (error) {
              console.error("Clear delay error:", error);
              Alert.alert(
                "Error",
                error?.message || "Failed to clear the delay.",
              );
            } finally {
              setActionLoading(false);
            }
          },
        },
      ],
    );
  };

  const handleMarkArrived = async () => {
    Alert.alert("Mark Arrived", "Have you reached the destination hub?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Yes, Arrived",
        onPress: async () => {
          try {
            setActionLoading(true);

            await updateTripStatus({
              tripId: trip.id,
              status: "ARRIVED",
              notify: true,
            });

            Alert.alert("Success", "You have arrived at the hub.");
          } catch (error) {
            console.error("Mark arrived error:", error);
            Alert.alert(
              "Error",
              error?.message || "Failed to update trip status.",
            );
          } finally {
            setActionLoading(false);
          }
        },
      },
    ]);
  };

  const handleCompleteTrip = async () => {
    Alert.alert("Mark Completed", "Have you completed the trip?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Yes",
        onPress: async () => {
          try {
            setActionLoading(true);

            await updateTripStatus({
              tripId: trip.id,
              status: "COMPLETED",
              notify: true,
            });

            Alert.alert("Success", "You have completed the trip.");
          } catch (error) {
            console.error("Mark completed error:", error);
            Alert.alert(
              "Error",
              error?.message || "Failed to update trip status.",
            );
          } finally {
            setActionLoading(false);
          }
        },
      },
    ]);
  };

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: "#f1f5f9" }]}>
        <ActivityIndicator size="large" color="#042C83" />
      </View>
    );
  }

  if (!trip) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar style="dark" />
        <View style={styles.center}>
          <FontAwesome5 name="truck" size={28} color="#94a3b8" />
          <Text style={styles.emptyTitle}>Trip unavailable</Text>
          <Text style={styles.emptyText}>
            The selected trip could not be loaded.
          </Text>

          <TouchableOpacity
            style={styles.backGhostBtn}
            onPress={() => router.back()}
          >
            <Text style={styles.backGhostBtnText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" backgroundColor="#f1f5f9" />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <FontAwesome5 name="arrow-left" size={15} color="#0f172a" />
        </TouchableOpacity>

        <View style={styles.headerTextWrap}>
          <Text style={styles.headerTitle}>Trip Details</Text>
          <Text style={styles.headerSubtitle}>{roleLabel} view</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <TripSummaryCard trip={trip} />

        {isDelayed && (
          <View style={styles.delayBanner}>
            <View style={styles.delayTopRow}>
              <FontAwesome5
                name="exclamation-triangle"
                size={18}
                color="#991b1b"
              />

              <View style={styles.delayTextContainer}>
                <Text style={styles.delayTitle}>Delay Approved</Text>
                <Text style={styles.delaySubtitle}>
                  {trip.delayReason
                    ? String(trip.delayReason).replace(/_/g, " ")
                    : "Admin has approved your delay."}
                </Text>
              </View>
            </View>

            {canDriverClearDelay && (
              <TouchableOpacity
                style={styles.clearDelayButton}
                onPress={handleClearDelay}
                disabled={actionLoading}
              >
                <Text style={styles.clearDelayButtonText}>
                  {actionLoading ? "Clearing..." : "CLEAR DELAY"}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        <TripProgressStepper currentStatus={trip.status} />

        {shouldShowManifestLockNotice && (
          <View style={styles.manifestNoticeCard}>
            <View style={styles.manifestNoticeIconWrap}>
              <FontAwesome5 name="lock" size={14} color="#92400e" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.manifestNoticeTitle}>
                Locked manifest required
              </Text>
              <Text style={styles.manifestNoticeText}>
                Start Trip will be available after an admin or manager locks the
                trip manifest.
              </Text>
            </View>
          </View>
        )}

        <TripStatusRow
          totalShipments={
            trip.totalItems ??
            // trip.totalShipments ??
            // trip.shipmentCount ??
            // trip.shipmentsCount ??
            0
          }
          totalPackages={trip.totalItems ?? 0}
          loaded={trip.totalLoaded ?? trip.loadedCount ?? 0}
          pending={trip.itemPending ?? trip.pendingCount ?? 0}
          arrived={trip.totalArrived ?? 0}
          delivered={trip.totalDelivered ?? 0}
        />

        {isChecker && (
          <View style={styles.checkerInfoCard}>
            <View style={styles.checkerInfoIconWrap}>
              <FontAwesome5 name="clipboard-check" size={15} color="#0369a1" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.checkerInfoTitle}>Checker view</Text>
              <Text style={styles.checkerInfoText}>
                This screen shows the trip summary and shipment access.
                Driver-only controls like Start Trip, Delay, Arrived, and
                Complete are hidden.
              </Text>
            </View>
          </View>
        )}
      </ScrollView>

      {hasAnyBottomAction && (
        <View style={styles.bottomActions}>
          <View style={styles.primaryActionsRow}>
            {canDriverReportDelay && (
              <TouchableOpacity
                style={styles.hazardButton}
                onPress={handleReportDelay}
                activeOpacity={0.7}
                disabled={actionLoading}
              >
                <FontAwesome5
                  name="exclamation-triangle"
                  size={18}
                  color="#ef4444"
                />
              </TouchableOpacity>
            )}

            {canDriverStartTrip && (
              <View style={styles.flexAction}>
                <GradientButton
                  title="Start Trip"
                  onPress={handleStartTrip}
                  loading={actionLoading}
                  disabled={actionLoading}
                />
              </View>
            )}

            {canDriverMarkArrived && (
              <View style={styles.flexAction}>
                <GradientButton
                  title="Mark Arrived"
                  onPress={handleMarkArrived}
                  loading={actionLoading}
                  disabled={actionLoading}
                />
              </View>
            )}

            {canDriverCompleteTrip && (
              <View style={styles.flexAction}>
                <GradientButton
                  title="Complete Trip"
                  onPress={handleCompleteTrip}
                  loading={actionLoading}
                  disabled={actionLoading}
                />
              </View>
            )}
          </View>

          {(canViewShipments || canCheckerOpenShipments) && (
            <TouchableOpacity
              style={styles.secondaryLink}
              onPress={handleViewShipments}
              disabled={actionLoading}
            >
              <Text style={styles.secondaryLinkText}>
                {isChecker ? "View Trip Shipments" : "View Shipments"}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f1f5f9",
    paddingTop: Platform.OS === "android" ? RNStatusBar.currentHeight || 0 : 0,
  },

  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
    gap: 10,
  },

  emptyTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0f172a",
    marginTop: 6,
  },

  emptyText: {
    fontSize: 13,
    color: "#64748b",
    textAlign: "center",
  },

  backGhostBtn: {
    marginTop: 10,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },

  backGhostBtnText: {
    color: "#0f172a",
    fontWeight: "600",
  },

  header: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 15,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },

  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    alignItems: "center",
    justifyContent: "center",
  },

  headerTextWrap: {
    marginLeft: 12,
    flex: 1,
  },

  headerTitle: {
    color: "#0f172a",
    fontSize: 16,
    fontWeight: "700",
  },

  headerSubtitle: {
    marginTop: 2,
    color: "#64748b",
    fontSize: 12,
  },

  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 140,
  },

  delayBanner: {
    backgroundColor: "#fef2f2",
    borderColor: "#f87171",
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },

  delayTopRow: {
    flexDirection: "row",
    alignItems: "center",
  },

  delayTextContainer: {
    marginLeft: 12,
    flex: 1,
  },

  delayTitle: {
    color: "#991b1b",
    fontSize: 14,
    fontWeight: "700",
    textTransform: "uppercase",
  },

  delaySubtitle: {
    color: "#b91c1c",
    fontSize: 12,
    marginTop: 2,
  },

  clearDelayButton: {
    marginTop: 12,
    backgroundColor: "#fff",
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: "center",
  },

  clearDelayButtonText: {
    color: "#991b1b",
    fontWeight: "700",
    fontSize: 13,
  },

  checkerInfoCard: {
    marginTop: 16,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    padding: 14,
    borderRadius: 12,
    backgroundColor: "#eff6ff",
    borderWidth: 1,
    borderColor: "#bfdbfe",
  },

  checkerInfoIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "#dbeafe",
    alignItems: "center",
    justifyContent: "center",
  },

  checkerInfoTitle: {
    color: "#075985",
    fontSize: 13,
    fontWeight: "700",
  },

  checkerInfoText: {
    marginTop: 3,
    color: "#0369a1",
    fontSize: 12,
    lineHeight: 18,
  },

  manifestNoticeCard: {
    marginBottom: 16,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    padding: 14,
    borderRadius: 12,
    backgroundColor: "#fffbeb",
    borderWidth: 1,
    borderColor: "#fde68a",
  },

  manifestNoticeIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "#fef3c7",
    alignItems: "center",
    justifyContent: "center",
  },

  manifestNoticeTitle: {
    color: "#92400e",
    fontSize: 13,
    fontWeight: "700",
  },

  manifestNoticeText: {
    marginTop: 3,
    color: "#a16207",
    fontSize: 12,
    lineHeight: 18,
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

  primaryActionsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },

  flexAction: {
    flex: 1,
  },

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
