// components/checker/CheckerHeader.js
import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { FontAwesome5 } from "@expo/vector-icons";

export default function CheckerHeader({ userName, onLogout }) {
  return (
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
      <TouchableOpacity style={styles.logoutBtn} onPress={onLogout}>
        <FontAwesome5 name="sign-out-alt" size={18} color="#ef4444" />
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
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#1e293b",
  },
  profileInfo: { flexDirection: "row", alignItems: "center", gap: 12 },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(59,130,246,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  greeting: { color: "#94a3b8", fontSize: 12 },
  username: { color: "#f8fafc", fontWeight: "700", fontSize: 16 },
  logoutBtn: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: "rgba(239,68,68,0.1)",
  },
});
