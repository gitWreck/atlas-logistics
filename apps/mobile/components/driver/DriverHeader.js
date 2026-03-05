import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { FontAwesome5 } from "@expo/vector-icons";
import { Image } from "expo-image";

export default function DriverHeader({ title = "My Trips", userName, onLogout }) {
  return (
    <View style={styles.header}>
      <View style={styles.titleRow}>
        <Image
          source={require("../../assets/icons/driver-icon.svg")}
          style={{ width: 45, height: 45 }}
        />
        <View>
          {userName ? (
            <>
              <Text style={styles.greeting}>Hello,</Text>
              <Text style={styles.headerTitle}>{userName}</Text>
            </>
          ) : (
            <Text style={styles.headerTitle}>{title}</Text>
          )}
        </View>
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
    paddingTop: 50,
    paddingBottom: 15,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  greeting: {
    color: "#475569",
    fontSize: 12,
  },
  headerTitle: {
    color: "#0f172a",
    fontSize: 16,
    fontWeight: "600",
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
  logoutText: {
    color: "#475569",
    fontSize: 14,
    fontWeight: "500",
  },
});
