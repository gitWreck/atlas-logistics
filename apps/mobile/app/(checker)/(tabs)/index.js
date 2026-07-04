import React, { useState, useEffect, useMemo } from "react";
import { View, StyleSheet, RefreshControl, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import {
  collection,
  query,
  where,
  onSnapshot,
} from "firebase/firestore";
import { format } from "date-fns";
import { db } from "../../../firebase";
import { useAuth } from "../../../contexts/AuthContext";
import { useTheme } from "../../../contexts/ThemeContext";
import { useCheckerLastMile } from "../../../contexts/CheckerLastMileContext";
import {
  CheckerHomeHero,
  DateFilterModal,
  DeliveredHistoryList,
  QuickActions,
  TodayAtGlance,
} from "../../../components/checker/CheckerHomeDashboard";
import { SECTION } from "../../../components/checker/design/checkerTheme";
import {
  countAvailablePiecesForDate,
  countDeliveredPiecesForDate,
  countFailedPiecesForDate,
  countOutForDeliveryTotalPiecesForDate,
  countReturnedPiecesForDate,
  getDeliveredShipmentsForDate,
  getShipmentActivityDates,
} from "../../../components/checker/dashboardData";

function mergeShipmentLists(...lists) {
  const map = new Map();
  lists.flat().forEach((shipment) => {
    if (shipment?.id) map.set(shipment.id, shipment);
  });
  return [...map.values()];
}

function mergeDates(...dates) {
  const map = new Map();
  dates.flat().forEach((date) => {
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) return;
    map.set(format(date, "yyyy-MM-dd"), date);
  });
  return [...map.values()].sort((a, b) => b.getTime() - a.getTime());
}

export default function CheckerIndex() {
  const router = useRouter();
  const { colors } = useTheme();
  const { user, profile } = useAuth();
  const {
    availableShipments = [],
    myRouteShipments = [],
    shipmentsById = {},
  } = useCheckerLastMile();

  const [refreshing, setRefreshing] = useState(false);
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [datePickerVisible, setDatePickerVisible] = useState(false);
  const [queriedShipments, setQueriedShipments] = useState([]);
  const [statsLoading, setStatsLoading] = useState(true);
  const checkerId = profile?.uid || user?.uid;

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

  useEffect(() => {
    if (!checkerId) {
      setQueriedShipments([]);
      setStatsLoading(false);
      return undefined;
    }

    setStatsLoading(true);
    let assigned = [];
    let active = [];
    let assignedReady = false;
    let activeReady = false;

    const publish = () => {
      setQueriedShipments(mergeShipmentLists(assigned, active));
      if (assignedReady && activeReady) setStatsLoading(false);
    };

    const shipmentsRef = collection(db, "shipments");
    const assignedQuery = query(
      shipmentsRef,
      where("assignedCheckerId", "==", String(checkerId)),
    );
    const activeQuery = query(
      shipmentsRef,
      where("activeCheckerIds", "array-contains", String(checkerId)),
    );

    const unsubAssigned = onSnapshot(
      assignedQuery,
      (snap) => {
        assigned = snap.docs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data(),
        }));
        assignedReady = true;
        publish();
      },
      (err) => {
        console.warn("Checker home assigned shipment query failed:", err);
        assignedReady = true;
        publish();
      },
    );

    const unsubActive = onSnapshot(
      activeQuery,
      (snap) => {
        active = snap.docs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data(),
        }));
        activeReady = true;
        publish();
      },
      (err) => {
        console.warn("Checker home active shipment query failed:", err);
        activeReady = true;
        publish();
      },
    );

    return () => {
      unsubAssigned();
      unsubActive();
    };
  }, [checkerId]);

  const onRefresh = async () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 350);
  };

  const allKnownShipments = useMemo(
    () =>
      mergeShipmentLists(
        Object.values(shipmentsById || {}),
        availableShipments,
        myRouteShipments,
        queriedShipments,
      ),
    [shipmentsById, availableShipments, myRouteShipments, queriedShipments],
  );

  const glance = useMemo(() => {
    const routeTotal = allKnownShipments.reduce(
      (sum, shipment) =>
        sum +
        countOutForDeliveryTotalPiecesForDate(
          shipment,
          checkerId,
          selectedDate,
        ),
      0,
    );
    const delivered = allKnownShipments.reduce(
      (sum, shipment) =>
        sum + countDeliveredPiecesForDate(shipment, checkerId, selectedDate),
      0,
    );
    const failed = allKnownShipments.reduce(
      (sum, shipment) =>
        sum + countFailedPiecesForDate(shipment, checkerId, selectedDate),
      0,
    );
    const returned = allKnownShipments.reduce(
      (sum, shipment) =>
        sum + countReturnedPiecesForDate(shipment, checkerId, selectedDate),
      0,
    );

    return {
      available: allKnownShipments.reduce(
        (sum, shipment) =>
          sum + countAvailablePiecesForDate(shipment, checkerId, selectedDate),
        0,
      ),
      routeTotal,
      onVan: Math.max(routeTotal - delivered - failed - returned, 0),
      delivered,
      failed,
      returned,
    };
  }, [allKnownShipments, checkerId, selectedDate]);

  const recentDelivered = useMemo(
    () =>
      getDeliveredShipmentsForDate(
        allKnownShipments,
        checkerId,
        selectedDate,
      ).slice(0, 3),
    [allKnownShipments, checkerId, selectedDate],
  );

  const availableDates = useMemo(
    () =>
      mergeDates(
        [new Date(), selectedDate],
        getShipmentActivityDates(allKnownShipments),
      ),
    [allKnownShipments, selectedDate],
  );

  const goal = glance.routeTotal;
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
      subtitle: "Out for Delivery",
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
          onProfilePress={() => router.push("/(checker)/profile")}
          currentDate={selectedDate}
          onDatePress={() => setDatePickerVisible(true)}
          dateLoading={statsLoading}
        />

        <TodayAtGlance
          cards={cards}
          progress={{
            delivered: glance.delivered,
            total: glance.routeTotal,
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
          emptyMessage="No deliveries found for the selected date."
        />

        <DateFilterModal
          visible={datePickerVisible}
          dates={availableDates}
          selectedDate={selectedDate}
          onSelectDate={(date) => {
            setSelectedDate(date);
            setDatePickerVisible(false);
          }}
          onClose={() => setDatePickerVisible(false)}
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
