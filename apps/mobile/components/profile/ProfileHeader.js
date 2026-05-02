// components/profile/ProfileHeader.js
import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { FontAwesome5 } from "@expo/vector-icons";

export default function ProfileHeader({ user, onLogout }) {
  const roleConfig = {
    customer: {
      icon: "user",
      color: "#16a34a",
      bg: "#f0fdf4",
      subtitle: user?.address
        ? `${user.address.city}, ${user.address.province}`
        : "Customer Account",
    },
    driver: {
      icon: "truck",
      color: "#9333ea",
      bg: "#faf5ff",
      subtitle: "Active Driver",
    },
    checker: {
      icon: "user-check",
      color: "#3b82f6",
      bg: "#eff6ff",
      subtitle: user?.warehouseName || "Warehouse Checker",
    },
  };

  const config = roleConfig[user?.role] || roleConfig.checker;

  return (
    <View style={styles.header}>
      <View style={styles.profileInfo}>
        <View style={[styles.avatar, { backgroundColor: config.bg }]}>
          <FontAwesome5 name={config.icon} size={15} color={config.color} />
        </View>
        <View style={styles.textBlock}>
          <Text style={styles.title} numberOfLines={1}>
            {user?.name || "Guest User"}
          </Text>
          <Text style={styles.subtitle} numberOfLines={1}>
            {config.subtitle}
          </Text>
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
    paddingTop: 10,
    paddingBottom: 15,
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
    gap: 12,
  },
  profileInfo: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    alignItems: "center",
    justifyContent: "center",
  },
  textBlock: {
    flex: 1,
    marginLeft: 12,
  },
  title: {
    color: "#0f172a",
    fontWeight: "700",
    fontSize: 16,
  },
  subtitle: {
    color: "#64748b",
    fontSize: 12,
    marginTop: 2,
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
