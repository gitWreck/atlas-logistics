import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  StyleSheet,
  RefreshControl,
  ScrollView,
  InteractionManager,
} from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "../../../contexts/AuthContext";
import { useTheme } from "../../../contexts/ThemeContext";
import { useCheckerLastMile } from "../../../contexts/CheckerLastMileContext";
import {
  CheckerHomeHero,
  CheckerHomeSkeleton,
  DateFilterModal,
  DeliveredHistoryList,
  QuickActions,
  TodayAtGlance,
} from "../../../components/checker/CheckerHomeDashboard";
import ManagerQuickAccess from "../../../components/manager/ManagerQuickAccess";
import { SECTION } from "../../../components/checker/design/checkerTheme";
import {
  getDashboardSummaryForDate,
  getLocalDateKey,
  getShipmentActivityDates,
  startOfLocalDay,
} from "../../../components/checker/dashboardData";

const RECENT_DATE_OPTION_COUNT = 7;

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
    map.set(getLocalDateKey(date), startOfLocalDay(date));
  });
  return [...map.values()].sort((a, b) => b.getTime() - a.getTime());
}

function getRecentDateOptions(referenceDate = new Date()) {
  const start = startOfLocalDay(referenceDate);
  return Array.from({ length: RECENT_DATE_OPTION_COUNT }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() - index);
    return date;
  });
}

export default function CheckerIndex() {
  const router = useRouter();
  const { colors } = useTheme();
  const { user, profile, isStaff } = useAuth();
  const {
    availableShipments = [],
    myRouteShipments = [],
    shipmentsById = {},
    assignedMunicipalities = [],
    loading: statsLoading = false,
    hasCachedSnapshot = false,
  } = useCheckerLastMile();

  const [refreshing, setRefreshing] = useState(false);
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [datePickerVisible, setDatePickerVisible] = useState(false);
  const [activityDates, setActivityDates] = useState([]);
  const checkerId = profile?.uid || user?.uid;
  const showInitialSkeleton =
    statsLoading &&
    !hasCachedSnapshot &&
    Object.keys(shipmentsById || {}).length === 0;

  const goToScan = useCallback((mode, title, extra = {}) => {
    router.push({
      pathname: "/(checker)/scan",
      params: { mode, title, ...extra },
    });
  }, [router]);

  const goLoad = useCallback(
    () => goToScan("delivery", "Load", { presetScanStatus: "LOAD_TO_VEHICLE" }),
    [goToScan],
  );
  const goRoute = useCallback(
    () => router.push("/(checker)/(tabs)/deliveries"),
    [router],
  );
  const goOffload = useCallback(
    () => goToScan("offloading", "Offload Items"),
    [goToScan],
  );
  const goInfo = useCallback(
    () => goToScan("info", "Information"),
    [goToScan],
  );
  const goAvailable = useCallback(
    () => router.push("/(checker)/(tabs)/available-to-load"),
    [router],
  );
  const goHistory = useCallback(
    () => router.push("/(checker)/delivered-history"),
    [router],
  );
  const openShipment = useCallback((shipment) =>
    router.push({
      pathname: "/(checker)/shipment-details",
      params: { shipmentId: shipment.id },
    }), [router]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 350);
  }, []);

  const allKnownShipments = useMemo(
    () =>
      mergeShipmentLists(
        Object.values(shipmentsById || {}),
        availableShipments,
        myRouteShipments,
      ),
    [shipmentsById, availableShipments, myRouteShipments],
  );

  const dateSummary = useMemo(
    () =>
      getDashboardSummaryForDate(
        allKnownShipments,
        checkerId,
        selectedDate,
        3,
      ),
    [allKnownShipments, checkerId, selectedDate],
  );

  const glance = useMemo(() => {
    // Live warehouse pool (not date-scoped) — matches Available tab.
    const available = (availableShipments || []).reduce(
      (sum, shipment) => sum + (shipment?.poolStats?.available || 0),
      0,
    );

    // Live on-van / OFD work for this user — matches My Deliveries tab.
    const onVan = (myRouteShipments || []).reduce(
      (sum, shipment) => sum + (shipment?.poolStats?.mine || 0),
      0,
    );

    const { delivered, failed, returned } = dateSummary;

    return {
      available,
      routeTotal: onVan + delivered + failed + returned,
      onVan,
      delivered,
      failed,
      returned,
    };
  }, [
    availableShipments,
    myRouteShipments,
    dateSummary,
  ]);

  const recentDelivered = dateSummary.recentDelivered;

  useEffect(() => {
    if (!datePickerVisible) return undefined;
    let cancelled = false;
    const task = InteractionManager.runAfterInteractions(() => {
      if (!cancelled) {
        setActivityDates(getShipmentActivityDates(allKnownShipments));
      }
    });
    return () => {
      cancelled = true;
      task?.cancel?.();
    };
  }, [datePickerVisible, allKnownShipments]);

  const availableDates = useMemo(
    () =>
      mergeDates(
        getRecentDateOptions(new Date()),
        [selectedDate],
        activityDates,
      ),
    [activityDates, selectedDate],
  );

  const goal = glance.routeTotal;
  const cards = useMemo(() => [
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
      title: "My Deliveries",
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
      trend:
        glance.delivered > 0 ? { positive: true, label: "Live today" } : null,
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
      trend:
        glance.failed > 0 ? { positive: false, label: "Needs action" } : null,
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
  ], [glance, goAvailable, goRoute, goHistory]);

  if (showInitialSkeleton) {
    return <CheckerHomeSkeleton />;
  }

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
          photoURL={profile?.photoURL || user?.photoURL}
          onProfilePress={() => router.push("/(checker)/profile")}
          currentDate={selectedDate}
          onDatePress={() => setDatePickerVisible(true)}
          dateLoading={statsLoading && !hasCachedSnapshot}
          assignedAreas={assignedMunicipalities}
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
          onOffload={goOffload}
          onInfo={goInfo}
        />

        {isStaff ? <ManagerQuickAccess preserveStaffTabs /> : null}

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
