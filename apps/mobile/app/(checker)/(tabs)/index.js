import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  RefreshControl,
  StatusBar,
  ScrollView,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import {
  collection,
  query,
  where,
  getCountFromServer,
  Timestamp,
} from "firebase/firestore";
import { startOfDay, subDays } from "date-fns";
import { db } from "../../../firebase";

import { useTheme } from "../../../contexts/ThemeContext";
import { useCheckerLastMile } from "../../../contexts/CheckerLastMileContext";
import {
  GroupLabel,
  StatCard,
  QuickAction,
} from "../../../components/checker/design/primitives";
import { SECTION } from "../../../components/checker/design/checkerTheme";

function greetingForNow() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning!";
  if (h < 18) return "Good afternoon!";
  return "Good evening!";
}

export default function CheckerIndex() {
  const router = useRouter();
  const { colors } = useTheme();

  // Real-time last-mile data (source of truth for the glance cards)
  const {
    availableShipments = [],
    myRouteShipments = [],
    summary = {},
  } = useCheckerLastMile();

  const [filter] = useState("TODAY"); // preserved for facility query parity
  const [refreshing, setRefreshing] = useState(false);

  // NAVIGATION HANDLERS (unchanged business flows)
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

  // FETCH facility stats (preserved) — keeps the warehouse query warm
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

  // DERIVE glance metrics from real-time context data
  const glance = useMemo(() => {
    const available = availableShipments.reduce(
      (n, s) => n + (s.poolStats?.available || 0),
      0,
    );
    const onVan = myRouteShipments.reduce(
      (n, s) => n + (s.poolStats?.mine || 0),
      0,
    );
    return {
      available,
      onVan,
      delivered: summary.delivered || 0,
      failed: summary.failed || 0,
      returned: summary.returned || 0,
    };
  }, [availableShipments, myRouteShipments, summary]);

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.text}
            colors={[colors.text]}
          />
        }
      >
        <Text style={[styles.greeting, { color: colors.textMuted }]}>
          {greetingForNow()}
        </Text>

        {/* TODAY AT A GLANCE */}
        <GroupLabel>Today at a glance</GroupLabel>
        <View style={styles.statGrid}>
          <StatCard
            value={glance.available}
            label="Available"
            sublabel="In Warehouse"
            icon="box"
            color={SECTION.available.accent}
          />
          <StatCard
            value={glance.onVan}
            label="On My Van"
            sublabel="Out for delivery"
            icon="truck"
            color={SECTION.route.accent}
          />
          <StatCard
            value={glance.delivered}
            label="Delivered"
            sublabel="Today"
            icon="check-circle"
            color={SECTION.delivered.accent}
          />
          <StatCard
            value={glance.failed}
            label="Failed"
            sublabel="Today"
            icon="exclamation-circle"
            color={SECTION.failed.accent}
          />
          <StatCard
            value={glance.returned}
            label="Returned"
            sublabel="To Warehouse"
            icon="undo"
            color={SECTION.return.accent}
            width="100%"
          />
        </View>

        {/* QUICK ACTIONS */}
        <GroupLabel style={{ marginTop: 20 }}>Quick actions</GroupLabel>
        <View style={styles.actionGrid}>
          <View style={styles.actionRow}>
            <QuickAction
              title="LOAD TO VAN"
              subtitle="Load to van"
              icon="truck"
              color={SECTION.load.accent}
              onPress={goLoad}
            />
            <QuickAction
              title="MY ROUTE"
              subtitle="View route"
              icon="map-marker-alt"
              color={SECTION.route.accent}
              onPress={goRoute}
            />
          </View>
          <View style={styles.actionRow}>
            <QuickAction
              title="OFFLOAD"
              subtitle="Deliver / Return"
              icon="box-open"
              color={SECTION.offload.accent}
              onPress={goOffload}
            />
            <QuickAction
              title="SCAN INFO"
              subtitle="Package info"
              icon="search"
              color={SECTION.info.accent}
              onPress={goInfo}
            />
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f1f5f9",
    paddingTop: Platform.OS === "android" ? StatusBar.currentHeight || 0 : 0,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 32,
  },
  greeting: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 12,
  },
  statGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  actionGrid: {
    gap: 12,
  },
  actionRow: {
    flexDirection: "row",
    gap: 12,
  },
});
