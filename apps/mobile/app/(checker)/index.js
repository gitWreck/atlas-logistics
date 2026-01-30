import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  StyleSheet,
  RefreshControl,
  StatusBar,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { FontAwesome5 } from "@expo/vector-icons";
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

  const handleLogout = async () => {
    try {
      await signOut(auth);
      router.replace("/(auth)/login");
    } catch (error) {
      Alert.alert("Error", error.message);
    }
  };

  // 2. FETCH STATS (Facility View)
  const fetchStats = useCallback(async () => {
    try {
      // Get User Profile Name (Optional)
      if (auth.currentUser?.displayName) {
        setUserName(auth.currentUser.displayName);
      }

      const shipmentsRef = collection(db, "shipments");
      const now = new Date();

      // A. Date Range for Activity
      const startDate =
        filter === "WEEK" ? subDays(startOfDay(now), 7) : startOfDay(now);
      const firestoreDate = Timestamp.fromDate(startDate);

      // B. Queries
      // Pending: Always real-time backlog (No date filter)
      const pendingQ = query(shipmentsRef, where("status", "==", "RECEIVED"));

      // Inbound: What arrived in this period
      const receivedQ = query(
        shipmentsRef,
        where("createdAt", ">=", firestoreDate),
      );

      // Outbound: What left in this period
      const loadedQ = query(
        shipmentsRef,
        where("status", "in", ["IN_TRANSIT", "COMPLETED"]),
        where("updatedAt", ">=", firestoreDate),
      );

      // C. Execute
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

  // Initial Load
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
      <StatusBar barStyle="light-content" backgroundColor="#0f172a" />

      {/* 1. HEADER */}
      <View style={styles.header}>
        <View style={styles.profileInfo}>
          <View style={styles.avatar}>
            <FontAwesome5 name="user-check" size={18} color="#3b82f6" />
          </View>
          <View>
            <Text style={styles.greeting}>Hello,</Text>
            <Text style={styles.username}>{userName}</Text>
          </View>
        </View>
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <FontAwesome5 name="sign-out-alt" size={18} color="#ef4444" />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#fff"
            colors={["#3b82f6"]}
          />
        }
      >
        {/* 2. DASHBOARD CONTROLS (Filter) */}
        <View style={styles.controlsRow}>
          <Text style={styles.sectionTitle}>Facility Overview</Text>
          <View style={styles.filterContainer}>
            <TouchableOpacity
              style={[
                styles.filterTab,
                filter === "TODAY" && styles.activeFilter,
              ]}
              onPress={() => setFilter("TODAY")}
            >
              <Text
                style={[
                  styles.filterText,
                  filter === "TODAY" && styles.activeFilterText,
                ]}
              >
                Today
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.filterTab,
                filter === "WEEK" && styles.activeFilter,
              ]}
              onPress={() => setFilter("WEEK")}
            >
              <Text
                style={[
                  styles.filterText,
                  filter === "WEEK" && styles.activeFilterText,
                ]}
              >
                Week
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* 3. STATS BOARD */}
        <View style={styles.statsRow}>
          {/* INBOUND */}
          <View style={styles.statCard}>
            <Text style={styles.statVal}>{stats.received}</Text>
            <Text style={styles.statLabel}>Inbound</Text>
            <Text style={styles.statSub}>
              {filter === "TODAY" ? "Today" : "7 Days"}
            </Text>
            <View style={[styles.statBar, { backgroundColor: "#3b82f6" }]} />
          </View>

          {/* OUTBOUND */}
          <View style={styles.statCard}>
            <Text style={styles.statVal}>{stats.loaded}</Text>
            <Text style={styles.statLabel}>Outbound</Text>
            <Text style={styles.statSub}>
              {filter === "TODAY" ? "Today" : "7 Days"}
            </Text>
            <View style={[styles.statBar, { backgroundColor: "#10b981" }]} />
          </View>

          {/* BACKLOG */}
          <View style={styles.statCard}>
            <Text style={styles.statVal}>{stats.pending}</Text>
            <Text style={styles.statLabel}>On Floor</Text>
            <Text style={[styles.statSub, { color: "#f59e0b" }]}>Active</Text>
            <View style={[styles.statBar, { backgroundColor: "#f59e0b" }]} />
          </View>
        </View>

        {/* 4. OPERATIONS GRID */}
        <Text style={[styles.sectionTitle, { marginTop: 24 }]}>Operations</Text>

        <View style={styles.gridContainer}>
          <View style={styles.row}>
            {/* A. LOAD TRUCK */}
            <TouchableOpacity
              style={[styles.gridBtn, { backgroundColor: "#3b82f6" }]}
              onPress={() => goToScan("loading", "Load Truck")}
            >
              <View style={styles.iconCircle}>
                <FontAwesome5 name="truck" size={24} color="#3b82f6" />
              </View>
              <Text style={styles.btnTitle}>LOAD TRUCK</Text>
              <Text style={styles.btnSub}>Scan to vehicle</Text>
            </TouchableOpacity>

            {/* B. OFFLOAD (Updated Mode!) */}
            <TouchableOpacity
              style={[
                styles.gridBtn,
                {
                  backgroundColor: "#1e293b",
                  borderWidth: 1,
                  borderColor: "#334155",
                },
              ]}
              // ⚠️ Corrected mode to "delivering"
              onPress={() => goToScan("delivering", "Offload Items")}
            >
              <View style={[styles.iconCircle, { backgroundColor: "#334155" }]}>
                <FontAwesome5 name="dolly" size={24} color="#fff" />
              </View>
              <Text style={styles.btnTitle}>OFFLOAD</Text>
              <Text style={styles.btnSub}>Inbound scan</Text>
            </TouchableOpacity>
          </View>

          {/* C. Placeholder / Check */}
          <View style={styles.row}>
            <View style={styles.cardPlaceholder}>
              <FontAwesome5 name="plus" size={24} color="#334155" />
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0f172a", // Slate 900
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },

  // HEADER
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#1e293b",
  },
  profileInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(59,130,246,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  greeting: {
    color: "#94a3b8",
    fontSize: 12,
  },
  username: {
    color: "#f8fafc",
    fontWeight: "700",
    fontSize: 16,
  },
  logoutBtn: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: "rgba(239,68,68,0.1)",
  },

  // SECTIONS
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#f8fafc",
    marginBottom: 10,
  },

  // CONTROLS & FILTER
  controlsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
    marginTop: 10,
  },
  filterContainer: {
    flexDirection: "row",
    backgroundColor: "#1e293b",
    borderRadius: 8,
    padding: 2,
    borderWidth: 1,
    borderColor: "#334155",
  },
  filterTab: {
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  activeFilter: {
    backgroundColor: "#3b82f6",
  },
  filterText: {
    color: "#94a3b8",
    fontSize: 12,
    fontWeight: "600",
  },
  activeFilterText: {
    color: "#fff",
  },

  // STATS
  statsRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    backgroundColor: "#1e293b",
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#334155",
  },
  statVal: {
    fontSize: 24,
    fontWeight: "800",
    color: "#f8fafc",
    marginBottom: 4,
  },
  statLabel: {
    color: "#94a3b8",
    fontSize: 12,
    fontWeight: "600",
  },
  statSub: {
    fontSize: 10,
    color: "#64748b",
    marginBottom: 8,
    marginTop: 2,
  },
  statBar: {
    height: 4,
    borderRadius: 2,
    width: "40%",
  },

  // GRID BUTTONS
  gridContainer: {
    gap: 16,
  },
  row: {
    flexDirection: "row",
    gap: 16,
  },
  gridBtn: {
    flex: 1,
    padding: 20,
    borderRadius: 20,
    minHeight: 140,
    justifyContent: "center",
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  btnTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#fff",
    marginBottom: 4,
  },
  btnSub: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 12,
  },
  cardPlaceholder: {
    flex: 1,
    borderWidth: 2,
    borderColor: "#1e293b",
    borderStyle: "dashed",
    borderRadius: 20,
    minHeight: 140,
    alignItems: "center",
    justifyContent: "center",
  },
});
