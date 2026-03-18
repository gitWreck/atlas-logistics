import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  SafeAreaView,
  StyleSheet,
  RefreshControl,
  StatusBar,
  ScrollView,
  Platform, // <--- ADD THIS
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import {
  getFirestore,
  collection,
  query,
  where,
  getCountFromServer,
  Timestamp,
} from "firebase/firestore";
import { getAuth, signOut } from "firebase/auth";
import { startOfDay, subDays } from "date-fns";

// ✅ IMPORT NEW COMPONENTS
import CheckerHeader from "../../../components/checker/CheckerHeader";
import StatusFilter from "../../../components/checker/StatusFilter";
import StatusBoard from "../../../components/checker/StatusBoard";
import OperationsGrid from "../../../components/checker/OperationsGrid";

export default function CheckerIndex() {
  const router = useRouter();
  const auth = getAuth();
  const db = getFirestore();

  // STATE
  const [filter, setFilter] = useState("TODAY"); // 'TODAY' | 'WEEK'
  const [stats, setStats] = useState({ received: 0, loaded: 0, pending: 0 });
  const [refreshing, setRefreshing] = useState(false);
  const [userName, setUserName] = useState("Checker");

  // 1. NAVIGATION HANDLER
  const goToScan = (mode, title) => {
    router.push({
      pathname: "/(checker)/scan",
      params: { mode, title },
    });
  };

  const handleLogout = () => {
    Alert.alert("Sign Out", "Are you sure?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign Out",
        style: "destructive",
        onPress: () => {
          signOut(auth);
          router.replace("/(auth)/login");
        },
      },
    ]);
  };

  // 2. FETCH STATS (Facility View)
  const fetchStats = useCallback(async () => {
    try {
      if (auth.currentUser?.displayName) {
        setUserName(auth.currentUser.displayName);
      }

      const shipmentsRef = collection(db, "shipments");
      const now = new Date();

      const startDate =
        filter === "WEEK" ? subDays(startOfDay(now), 7) : startOfDay(now);
      const firestoreDate = Timestamp.fromDate(startDate);

      const pendingQ = query(shipmentsRef, where("status", "==", "RECEIVED"));
      const partiallyQ = query(
        shipmentsRef,
        where("status", "==", "PARTIALLY_PROCESSED"),
      );

      const receivedQ = query(
        shipmentsRef,
        where("createdAt", ">=", firestoreDate),
      );

      const loadedQ = query(
        shipmentsRef,
        where("status", "in", ["IN_TRANSIT", "COMPLETED"]),
        where("updatedAt", ">=", firestoreDate),
      );

      const [pSnap, rSnap, lSnap] = await Promise.all([
        getCountFromServer(pendingQ),
        getCountFromServer(receivedQ),
        getCountFromServer(loadedQ),
      ]);

      setStats({
        pending: pSnap.data().count,
        received: rSnap.data().count,
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

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#f1f5f9" />

      {/* 1. HEADER */}
      <CheckerHeader
        userName={userName}
        onLogout={handleLogout}
        // ✅ This points to the profile.js you just created
        onProfilePress={() => router.push("/(checker)/profile")}
      />

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
        <StatusBoard stats={stats} filterMode={filter} />

        {/* 4. OPERATIONS GRID */}
        <OperationsGrid
          onScanLoad={() => goToScan("loading", "Load Truck")}
          onScanOffload={() => goToScan("offloading", "Offload Items")}
          onScanInfo={() => goToScan("info", "Information")}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f1f5f9",
    paddingTop: Platform.OS === "android" ? StatusBar.currentHeight : 0,
  },
  content: {
    paddingLeft: 20,
    paddingRight: 20,
    // paddingBottom: 40,
  },
});
