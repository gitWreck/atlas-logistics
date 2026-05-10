import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { FontAwesome5 } from "@expo/vector-icons";
import { useTheme } from "../../contexts/ThemeContext";

export default function DriverHeader({
  title = "My Trips",
  userName,
  onLogout,
  onProfilePress,
}) {
  const { colors, resolvedScheme } = useTheme();

  return (
    <View
      style={[
        styles.header,
        { backgroundColor: colors.surface, borderBottomColor: colors.border },
      ]}
    >
      <TouchableOpacity
        style={styles.profileInfo}
        onPress={onProfilePress}
        activeOpacity={0.7}
      >
        <View
          style={[
            styles.avatar,
            { backgroundColor: resolvedScheme === "dark" ? "#1e3a8a" : "#eff6ff" },
          ]}
        >
          <FontAwesome5 name="user-check" size={18} color="#3b82f6" />
        </View>
        <View>
          {userName ? (
            <>
              <Text style={[styles.greeting, { color: colors.textMuted }]}>
                Hello,
              </Text>
              <Text style={[styles.username, { color: colors.text }]}>
                {userName}
              </Text>
            </>
          ) : (
            <Text style={[styles.username, { color: colors.text }]}>{title}</Text>
          )}
        </View>
      </TouchableOpacity>

      <TouchableOpacity
        style={[
          styles.logoutBtn,
          { backgroundColor: colors.cardMuted, borderColor: colors.border },
        ]}
        onPress={onLogout}
      >
        <FontAwesome5 name="sign-out-alt" size={16} color={colors.textMuted} />
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
    // paddingTop: 40, // Kept at 50 for your safe area spacing
    paddingTop: 10,
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
