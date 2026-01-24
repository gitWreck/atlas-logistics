import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { FontAwesome5, Ionicons } from "@expo/vector-icons";
import { signOut } from "firebase/auth";
import { auth } from "../../firebase";

export default function CheckerDashboard() {
  const router = useRouter();

  // Mock Stats (You can connect this to Firestore later)
  const [stats] = useState({
    received: 120,
    loaded: 45,
    pending: 75,
  });

  const handleLogout = () => {
    Alert.alert("Sign Out", "Are you sure?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign Out",
        style: "destructive",
        onPress: () => {
          signOut(auth).then(() => router.replace("/"));
        },
      },
    ]);
  };

  // Helper for Navigation
  const goToScan = (mode, title) => {
    router.push({
      pathname: "/(checker)/scan",
      params: { mode, title },
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* 1. HEADER (Profile + Logout) */}
      <View style={styles.header}>
        <View style={styles.profileInfo}>
          <View style={styles.avatar}>
            <FontAwesome5 name="user-check" size={18} color="#3b82f6" />
          </View>
          <View>
            <Text style={styles.greeting}>Hello,</Text>
            <Text style={styles.username}>Checker</Text>
          </View>
        </View>
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <FontAwesome5 name="sign-out-alt" size={18} color="#ef4444" />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* 2. STATS BOARD (New Addition) */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statVal}>{stats.received}</Text>
            <Text style={styles.statLabel}>Received</Text>
            <View style={[styles.statBar, { backgroundColor: "#3b82f6" }]} />
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statVal}>{stats.loaded}</Text>
            <Text style={styles.statLabel}>Loaded</Text>
            <View style={[styles.statBar, { backgroundColor: "#10b981" }]} />
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statVal}>{stats.pending}</Text>
            <Text style={styles.statLabel}>Pending</Text>
            <View style={[styles.statBar, { backgroundColor: "#f59e0b" }]} />
          </View>
        </View>

        {/* 3. GRID BUTTONS (Preserving your layout) */}
        <Text style={styles.sectionTitle}>Operations</Text>

        <View style={styles.gridContainer}>
          {/* ROW 1 */}
          <View style={styles.row}>
            {/* Load Truck */}
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

            {/* Unload / Receive */}
            <TouchableOpacity
              style={[
                styles.gridBtn,
                {
                  backgroundColor: "#1e293b",
                  borderWidth: 1,
                  borderColor: "#334155",
                },
              ]}
              // ⚠️ CRITICAL CHANGE HERE:
              // 1. Mode must be "delivering" (matches Cloud Function)
              // 2. Title changed to "Offload" (matches Trip Stats)
              onPress={() => goToScan("delivering", "Offload Items")}
            >
              <View style={[styles.iconCircle, { backgroundColor: "#334155" }]}>
                <FontAwesome5 name="dolly" size={24} color="#fff" />
              </View>
              <Text style={styles.btnTitle}>OFFLOAD</Text>
              <Text style={styles.btnSub}>Inbound scan</Text>
            </TouchableOpacity>
          </View>

          {/* ROW 2 */}
          <View style={styles.row}>
            {/* Single Check */}
            {/* <TouchableOpacity
              style={[
                styles.gridBtn,
                {
                  backgroundColor: "#1e293b",
                  borderWidth: 1,
                  borderColor: "#334155",
                },
              ]}
              onPress={() => goToScan("manual", "Single Check")}
            >
              <View style={[styles.iconCircle, { backgroundColor: "#334155" }]}>
                <FontAwesome5 name="search" size={24} color="#94a3b8" />
              </View>
              <Text style={[styles.btnTitle, { color: "#94a3b8" }]}>CHECK</Text>
              <Text style={styles.btnSub}>Details lookup</Text>
            </TouchableOpacity> */}

            {/* Placeholder */}
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
  container: { flex: 1, backgroundColor: "#0f172a" }, // Dark Background

  // Header
  header: {
    padding: 20,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  profileInfo: { flexDirection: "row", alignItems: "center", gap: 12 },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#1e293b",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#334155",
  },
  greeting: { color: "#94a3b8", fontSize: 12 },
  username: { color: "#fff", fontSize: 18, fontWeight: "bold" },
  logoutBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(239, 68, 68, 0.1)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.3)",
  },

  content: { padding: 20 },

  // Stats Row
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 30,
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: "#1e293b",
    padding: 16,
    borderRadius: 16,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#334155",
  },
  statVal: { color: "#fff", fontSize: 22, fontWeight: "bold", marginBottom: 4 },
  statLabel: {
    color: "#94a3b8",
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  statBar: { width: 20, height: 4, borderRadius: 2, marginTop: 10 },

  // Grid Section
  sectionTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 15,
  },
  gridContainer: { gap: 16 },
  row: { flexDirection: "row", gap: 16 },

  // The Big Buttons
  gridBtn: {
    flex: 1,
    aspectRatio: 1, // Makes it a square
    borderRadius: 24,
    padding: 20,
    justifyContent: "space-between",
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  btnTitle: { color: "#fff", fontSize: 16, fontWeight: "800", marginTop: 10 },
  btnSub: { color: "rgba(255,255,255,0.6)", fontSize: 12 },

  // Placeholder
  cardPlaceholder: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: "#1e293b",
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
  },
});
