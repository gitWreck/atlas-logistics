import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  StatusBar as RNStatusBar,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { useLocalSearchParams, useRouter } from "expo-router";
import { doc, getDoc } from "firebase/firestore";
import { FontAwesome5 } from "@expo/vector-icons";

import { db } from "../../../firebase";
import TripProgressStepper from "../../../components/trips/TripProgressStepper";
import ShipmentDetailHeader from "../../../components/shipments/ShipmentDetailHeader";
import ShipmentHeaderCard from "../../../components/shipments/ShipmentHeaderCard";
import ShipmentPackagesPanel from "../../../components/shipments/details/ShipmentPackagesPanel";
import ExistingProofsViewer from "../../../components/tracking/ExistingProofsViewer";

export default function CustomerTrackingDetailsScreen() {
  const { trackingId } = useLocalSearchParams();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [shipment, setShipment] = useState(null);

  const normalizedTracking = useMemo(
    () =>
      String(trackingId || "")
        .trim()
        .toUpperCase(),
    [trackingId],
  );

  const fetchData = useCallback(async () => {
    if (!normalizedTracking) {
      setError("Invalid tracking number.");
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError("");

      const snap = await getDoc(doc(db, "shipments", normalizedTracking));

      if (!snap.exists()) {
        setShipment(null);
        setError("Shipment not found. Please check your tracking ID.");
        return;
      }

      setShipment({ id: snap.id, ...snap.data() });
    } catch (err) {
      console.error("Failed to load tracking details:", err);
      setShipment(null);
      setError("System offline. Please try again later.");
    } finally {
      setLoading(false);
    }
  }, [normalizedTracking]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const packages = shipment?.packages || [];

  const displayShipment = useMemo(() => {
    if (!shipment) return null;

    const hasTotals =
      shipment?.totals?.totalContentQty != null ||
      shipment?.totals?.totalItems != null;

    if (hasTotals) return shipment;

    const derivedTotals = packages.reduce(
      (acc, pkg) => {
        const quantity = Number(pkg?.quantity) || 1;
        const status = String(pkg?.status || "").toUpperCase();

        acc.totalContentQty += quantity;
        if (status === "LOADED") acc.loaded += quantity;
        if (status === "MISSING") acc.missing += quantity;

        return acc;
      },
      { loaded: 0, missing: 0, totalContentQty: 0 },
    );

    return {
      ...shipment,
      totals: {
        ...(shipment.totals || {}),
        ...derivedTotals,
      },
    };
  }, [packages, shipment]);

  const progressType = useMemo(() => {
    const status = String(shipment?.status || "").toUpperCase();
    const rawType = String(shipment?.tripType || shipment?.routeType || "")
      .trim()
      .toUpperCase();

    if (rawType === "LOCAL_PICKUP" || shipment?.isPickupRequested === true) {
      return "SHIPMENT_PICKUP";
    }

    if (status === "PENDING_PICKUP" || status === "PICKED_UP") {
      return "SHIPMENT_PICKUP";
    }

    return "SHIPMENT_DELIVERY";
  }, [
    shipment?.isPickupRequested,
    shipment?.routeType,
    shipment?.status,
    shipment?.tripType,
  ]);

  if (loading) {
    return (
      <View style={styles.center}>
        <StatusBar style="dark" />
        <ActivityIndicator size="large" color="#042C83" />
      </View>
    );
  }

  if (error || !shipment) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar style="dark" />
        <ShipmentDetailHeader
          title="Tracking Details"
          subtitle="Shipment lookup"
          onBack={() => router.back()}
        />

        <View style={styles.emptyState}>
          <View style={styles.emptyIconWrap}>
            <FontAwesome5 name="box-open" size={22} color="#94a3b8" />
          </View>
          <Text style={styles.emptyTitle}>Shipment unavailable</Text>
          <Text style={styles.emptyText}>
            {error || "The selected shipment could not be loaded."}
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

      <ShipmentDetailHeader
        title="Tracking Details"
        subtitle={shipment.id || normalizedTracking}
        onBack={() => router.back()}
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <ShipmentHeaderCard shipment={shipment} showActions={false} />

        <TripProgressStepper
          currentStatus={shipment.status}
          tripType={progressType}
        />

        <ExistingProofsViewer
          proofOfReceipt={shipment.proofOfReceipt}
          proofOfDelivery={shipment.proofOfDelivery}
        />

        <ShipmentPackagesPanel
          shipment={displayShipment}
          packages={packages}
          editable={false}
          showOverview={false}
        />
      </ScrollView>
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
    backgroundColor: "#f1f5f9",
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 32,
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  emptyIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0f172a",
    marginBottom: 6,
  },
  emptyText: {
    fontSize: 13,
    color: "#64748b",
    textAlign: "center",
    lineHeight: 19,
  },
  backGhostBtn: {
    marginTop: 16,
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
});
