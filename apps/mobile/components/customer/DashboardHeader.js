import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { FontAwesome5 } from "@expo/vector-icons";
import { COLORS } from "../constants/theme"; // Adjust path as needed

export default function DashboardHeader({ firstName, onLogout }) {
  return (
    <View style={styles.header}>
      <View style={styles.headerTextWrapper}>
        <Text style={styles.headerTitle}>
          {firstName ? `Hi ${firstName}!` : "Hi!"}
        </Text>
        <Text style={styles.headerSubtitle}>
          Your shipments and activity will appear here.
        </Text>
      </View>

      <TouchableOpacity style={styles.logoutBtn} onPress={onLogout}>
        <FontAwesome5 name="sign-out-alt" size={16} color="#475569" />
        <Text style={styles.logoutText}>Log out</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  headerTextWrapper: {
    flex: 1,
  },
  headerTitle: {
    color: "#0f172a",
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 4,
  },
  headerSubtitle: {
    color: "#64748b",
    fontSize: 13,
  },
  logoutBtn: {
    marginLeft: 16,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    backgroundColor: "#f8fafc",
    gap: 6,
  },
  logoutText: {
    color: "#475569",
    fontSize: 14,
    fontWeight: "500",
  },
});
