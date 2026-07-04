import React, { useState, useCallback, useEffect, useMemo } from "react";
import { View, StyleSheet, RefreshControl, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import {
  collection,
  query,
  where,
  getCountFromServer,
  Timestamp,
} from "firebase/firestore";
import { startOfDay, subDays } from "date-fns";
import { signOut } from "firebase/auth";
import { auth, db } from "../../../firebase";
import { useAuth } from "../../../contexts/AuthContext";
import { useTheme } from "../../../contexts/ThemeContext";
import { useCheckerLastMile } from "../../../contexts/CheckerLastMileContext";
import {
  CheckerHomeHero,
  DeliveredHistoryList,
  QuickActions,
  TodayAtGlance,
} from "../../../components/checker/CheckerHomeDashboard";
import { SECTION } from "../../../components/checker/design/checkerTheme";
import {
  countDeliveredPieces,
  countOutForDeliveryPieces,
  getDeliveredShipments,
  isSameLocalDay,
} from "../../../components/checker/dashboardData";

export default function CheckerIndex() {
  const router = useRouter();
  const { colors } = useTheme();
  const { user, profile } = useAuth();
  const {
    availableShipments = [],
    myRouteShipments = [],
    summary = {},
    shipmentsById = {},
  } = useCheckerLastMile();

  const [filter] = useState("TODAY");
  const [refreshing, setRefreshing] = useState(false);
  const checkerId = profile?.uid || user?.uid;
  const today = useMemo(() => new Date(), []);

  const goToScan = (mode, title, extra = {}) => {
    router.push({
      pathname: "/(checker)/scan",
      params: { mode, title, ...extra },
    });
  };

  const goLoad = () =>
    goToScan("delivery", "Load", { presetScanStatus: "LOAD_TO_VEHICLE" });
  const goRoute = () => router.push("/(checker)/(tabs)/deliveries");
  const goOffload = () => goToScan("offloading", "Offload Items");
  const goInfo = () => goToScan("info", "Information");
  const goAvailable = () => router.push("/(checker)/(tabs)/available-to-load");
  const goHistory = () => router.push("/(checker)/delivered-history");
  const openShipment = (shipment) =>
    router.push({
      pathname: "/(checker)/shipment-details",
      params: { shipmentId: shipment.id },
    });

  const handleLogout = async () => {
    try {
      await signOut(auth);
      router.replace("/(auth)/login");
    } catch (err) {
      console.error("Logout failed:", err);
    }
  };

  const fetchStats = useCallback(async () => {
    try {
      const shipmentsRef = collection(db, "shipments");
      const now = new Date();
      const startDate =
        filter === "WEEK" ? subDays(startOfDay(now), 7) : startOfDay(now);
      const firestoreDate = Timestamp.fromDate(startDate);

      const receivedQ = query(
        shipmentsRef,
        where("status", "==", "RECEIVED"),
        where("updatedAt", ">=", firestoreDate),
      );
      await getCountFromServer(receivedQ);
    } catch (err) {
      console.error("Stats Error:", err);
    }
  }, [filter]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchStats();
    setRefreshing(false);
  };

  const allKnownShipments = useMemo(
    () => Object.values(shipmentsById || {}),
    [shipmentsById],
  );

  const glance = useMemo(() => {
    const available = availableShipments.reduce(
      (n, s) => n + (s.poolStats?.available || 0),
      0,
    );
    const onVan = myRouteShipments.reduce(
      (n, s) => n + (s.poolStats?.mine || 0),
      0,
    );

    const deliveredToday = allKnownShipments.reduce((sum, shipment) => {
      const deliveredAt = shipment.deliveredAt || shipment.completedAt;
      const hasDeliveredToday =
        isSameLocalDay(deliveredAt, today) ||
        (Array.isArray(shipment.packages) &&
          shipment.packages.some((pkg) =>
            isSameLocalDay(pkg.deliveredAt || pkg.updatedAt, today),
          ));
      return hasDeliveredToday
        ? sum + countDeliveredPieces(shipment, checkerId)
        : sum;
    }, 0);

    const outForDeliveryToday = allKnownShipments.reduce((sum, shipment) => {
      const updatedToday =
        isSameLocalDay(shipment.updatedAt, today) ||
        (Array.isArray(shipment.packages) &&
          shipment.packages.some((pkg) =>
            isSameLocalDay(pkg.updatedAt || pkg.deliveredAt, today),
          ));
      return updatedToday
        ? sum + countOutForDeliveryPieces(shipment, checkerId)
        : sum;
    }, 0);

    return {
      available,
      onVan,
      delivered: deliveredToday || summary.delivered || 0,
      failed: summary.failed || 0,
      returned: summary.returned || 0,
      outForDeliveryToday,
    };
  }, [
    availableShipments,
    myRouteShipments,
    summary,
    allKnownShipments,
    checkerId,
    today,
  ]);

  const recentDelivered = useMemo(
    () => getDeliveredShipments(allKnownShipments, checkerId).slice(0, 3),
    [allKnownShipments, checkerId],
  );

  const goal = summary.totalPackages || glance.outForDeliveryToday || 0;
  const cards = [
    {
      key: "available",
      title: "Available",
      subtitle: "In Warehouse",
      value: glance.available,
      icon: "cube",
      color: SECTION.available.accent,
      softColor: "#eaf1ff",
      onPress: goAvailable,
    },
    {
      key: "on-van",
      title: "On My Van",
      subtitle: "Out for delivery",
      value: glance.onVan,
      icon: "truck",
      color: SECTION.route.accent,
      softColor: "#e8f7ee",
      onPress: goRoute,
    },
    {
      key: "delivered",
      title: "Delivered",
      subtitle: "Today",
      value: glance.delivered,
      icon: "check-circle",
      color: SECTION.delivered.accent,
      softColor: "#e7f8ed",
      trend: glance.delivered > 0 ? { positive: true, label: "Live today" } : null,
      onPress: goHistory,
    },
    {
      key: "failed",
      title: "Failed",
      subtitle: "Today",
      value: glance.failed,
      icon: "exclamation-circle",
      color: SECTION.failed.accent,
      softColor: "#fee8e8",
      trend: glance.failed > 0 ? { positive: false, label: "Needs action" } : null,
      onPress: goRoute,
    },
    {
      key: "returned",
      title: "Returned",
      subtitle: "To Warehouse",
      value: glance.returned,
      icon: "undo",
      color: SECTION.return.accent,
      softColor: "#fff1df",
      onPress: goRoute,
    },
  ];

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#ffffff"
            colors={[SECTION.available.accent]}
          />
        }
      >
        <CheckerHomeHero
          userName={user?.name || user?.fullName || profile?.name || "Checker"}
          onLogout={handleLogout}
          onProfilePress={() => router.push("/(checker)/profile")}
          currentDate={today}
        />

        <TodayAtGlance
          cards={cards}
          progress={{
            delivered: glance.delivered,
            total: glance.outForDeliveryToday,
            goal,
          }}
          onViewAll={goAvailable}
        />

        <QuickActions
          onLoad={goLoad}
          onRoute={goRoute}
          onOffload={goOffload}
          onInfo={goInfo}
        />

        <DeliveredHistoryList
          shipments={recentDelivered}
          onViewAll={goHistory}
          onPressShipment={openShipment}
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f7fbff",
  },
  content: {
    paddingBottom: 28,
  },
});
