// components/profile/ProfileHeader.js
import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { FontAwesome5 } from "@expo/vector-icons";

export default function ProfileHeader({ user, onLogout }) {
  // Config based on role
  const roleConfig = {
    customer: {
      icon: "user",
      color: "#16a34a", // Green
      bg: "#f0fdf4",
      subtitle: user?.address 
        ? `${user.address.city}, ${user.address.province}` 
        : "Customer Account"
    },
    driver: {
      icon: "truck",
      color: "#9333ea", // Purple
      bg: "#faf5ff",
      subtitle: "Active Driver"
    },
    checker: {
      icon: "user-check",
      color: "#3b82f6", // Blue
      bg: "#eff6ff",
      subtitle: user?.warehouseName || "Warehouse Checker"
    }
  };

  const config = roleConfig[user?.role] || roleConfig.checker;

  return (
    <View style={styles.header}>
      <View style={styles.profileInfo}>
        <View style={[styles.avatar, { backgroundColor: config.bg }]}>
          <FontAwesome5 name={config.icon} size={18} color={config.color} />
        </View>
        <View>
          <Text style={styles.username}>{user?.name || "Guest User"}</Text>
          <Text style={styles.subtitle}>{config.subtitle}</Text>
        </View>
      </View>
      
      <TouchableOpacity style={styles.logoutBtn} onPress={onLogout}>
        <FontAwesome5 name="sign-out-alt" size={16} color="#ef4444" />
        <Text style={styles.logoutText}>Logout</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 20,
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  profileInfo: { flexDirection: "row", alignItems: "center", gap: 12 },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  username: { 
    color: "#0f172a", 
    fontWeight: "700", 
    fontSize: 18, 
    letterSpacing: -0.5 
  },
  subtitle: { 
    color: "#64748b", 
    fontSize: 12, 
    fontWeight: "500", 
    marginTop: 2 
  },
  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: "#fef2f2",
    gap: 6,
  },
  logoutText: {
    color: "#ef4444",
    fontSize: 13,
    fontWeight: "600",
  },
});