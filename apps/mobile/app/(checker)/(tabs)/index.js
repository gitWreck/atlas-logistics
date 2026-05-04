import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  StyleSheet,
  RefreshControl,
  StatusBar,
  ScrollView,
  Alert,
  Text,
  TouchableOpacity,
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
import { auth, db } from "../../../firebase";
import { FontAwesome5 } from "@expo/vector-icons";

// ✅ IMPORT NEW COMPONENTS
import StatusFilter from "../../../components/checker/StatusFilter";
import StatusBoard from "../../../components/checker/StatusBoard";
import OperationsGrid from "../../../components/checker/OperationsGrid";
import { CHECKER_STATUS_BOARD_CARDS } from "../../../components/checker/StatusBoard";

export default function CheckerIndex() {
  const router = useRouter();

  // STATE
  const [filter, setFilter] = useState("TODAY"); // 'TODAY' | 'WEEK'
  const [stats, setStats] = useState({ received: 0, loaded: 0, pending: 0 });
  const [refreshing, setRefreshing] = useState(false);

  // 1. NAVIGATION HANDLER
  const goToScan = (mode, title) => {
    router.push({
      pathname: "/(checker)/scan",
      params: { mode, title },
    });
  };

  // 2. FETCH STATS (Facility View)
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

      const loadedQ = query(
        shipmentsRef,
        where("status", "==", "LOADED"),
        where("updatedAt", ">=", firestoreDate),
      );

      const totalQ = query(
        shipmentsRef,
        where("status", "in", ["RECEIVED", "LOADED"]),
        where("createdAt", ">=", firestoreDate),
      );

      const [rSnap, tSnap, lSnap] = await Promise.all([
        getCountFromServer(receivedQ),
        getCountFromServer(totalQ),
        getCountFromServer(loadedQ),
      ]);

      setStats({
        received: rSnap.data().count,
        total: tSnap.data().count,
        loaded: lSnap.data().count,
      });
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

  const handleLogout = () => {
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign Out",
        style: "destructive",
        onPress: () => {
          auth.signOut();
          router.replace("/(auth)/login");
        },
      },
    ]);
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#f1f5f9" />

      <View style={styles.header}>
        <View style={styles.textBlock}>
          <Text style={styles.title} numberOfLines={1}>
            Operations
          </Text>
          <Text style={styles.subtitle} numberOfLines={1}>
            Checker Dashboard
          </Text>
        </View>
        <TouchableOpacity onPress={handleLogout} style={styles.iconBtn}>
          <FontAwesome5 name="sign-out-alt" size={15} color="#0f172a" />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#0f172a"
            colors={["#0f172a"]}
          />
        }
      >
        {/* 2. FILTER & CONTROLS */}
        <StatusFilter activeFilter={filter} onFilterChange={setFilter} />

        {/* 3. STATS BOARD */}
        <StatusBoard
          stats={stats}
          filterMode={filter}
          cards={CHECKER_STATUS_BOARD_CARDS}
        />

        {/* 4. OPERATIONS GRID */}
        <OperationsGrid
          onScanLoad={() => goToScan("loading", "Load Truck")}
          onScanOffload={() => goToScan("offloading", "Offload Items")}
          onScanInfo={() => goToScan("info", "Information")}
        />
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
    paddingLeft: 20,
    paddingRight: 20,
    // paddingBottom: 40,
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
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    alignItems: "center",
    justifyContent: "center",
  },
  textBlock: {
    flex: 1,
    marginRight: 12,
  },
  title: {
    color: "#0f172a",
    fontSize: 16,
    fontWeight: "700",
  },
  subtitle: {
    color: "#64748b",
    fontSize: 12,
    marginTop: 2,
  },
});
