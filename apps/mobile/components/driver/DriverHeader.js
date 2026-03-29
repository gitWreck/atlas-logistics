import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { FontAwesome5 } from "@expo/vector-icons";

export default function DriverHeader({
  title = "My Trips",
  userName,
  onLogout,
  onProfilePress,
}) {
  return (
    <View style={styles.header}>
      <TouchableOpacity
        style={styles.profileInfo}
        onPress={onProfilePress}
        activeOpacity={0.7}
      >
        <View style={styles.avatar}>
          <FontAwesome5 name="user-check" size={18} color="#3b82f6" />
        </View>
        <View>
          {userName ? (
            <>
              <Text style={styles.greeting}>Hello,</Text>
              <Text style={styles.username}>{userName}</Text>
            </>
          ) : (
            <Text style={styles.username}>{title}</Text>
          )}
        </View>
      </TouchableOpacity>

      <TouchableOpacity style={styles.logoutBtn} onPress={onLogout}>
        <FontAwesome5 name="sign-out-alt" size={16} color="#475569" />
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
    paddingTop: 40, // Kept at 50 for your safe area spacing
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#cbd5e1",
    backgroundColor: "#ffffff",
  },
  profileInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1, // Allow it to take up available space
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#eff6ff",
    alignItems: "center",
    justifyContent: "center",
  },
  greeting: {
    color: "#475569",
    fontSize: 12,
  },
  username: {
    color: "#0f172a",
    fontWeight: "700",
    fontSize: 16,
  },
  logoutBtn: {
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
});
