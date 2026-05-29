import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { FontAwesome5 } from "@expo/vector-icons";
import { useTheme } from "../../contexts/ThemeContext";

export default function CustomerHeader({
  userName,
  onLogout,
  onProfilePress,
  onNotificationsPress,
  onMessagesPress,
  unreadCount = 0,
  unreadMessages = 0,
}) {
  const { colors, resolvedScheme } = useTheme();
  const displayCount = unreadCount > 9 ? "9+" : String(unreadCount);
  const displayMessages = unreadMessages > 9 ? "9+" : String(unreadMessages);
  const isDark = resolvedScheme === "dark";

  return (
    <View
      style={[
        styles.header,
        { backgroundColor: colors.surface, borderBottomColor: colors.border },
      ]}
    >
      {/* Profile Info wrapped in TouchableOpacity to match Checker style */}
      <TouchableOpacity
        style={styles.profileInfo}
        onPress={onProfilePress}
        activeOpacity={0.7}
      >
        <View
          style={[
            styles.avatar,
            { backgroundColor: isDark ? "#1e3a8a" : "#eff6ff" },
          ]}
        >
          {/* Changed icon to 'user' to represent a Customer */}
          <FontAwesome5 name="user" size={18} color="#3b82f6" />
        </View>
        <View>
          <Text style={[styles.greeting, { color: colors.textMuted }]}>
            Hello,
          </Text>
          <Text style={[styles.username, { color: colors.text }]}>
            {userName || "Customer"}
          </Text>
        </View>
      </TouchableOpacity>

      <View style={styles.actions}>
        {onMessagesPress && (
          <TouchableOpacity
            style={[
              styles.iconBtn,
              { backgroundColor: colors.cardMuted, borderColor: colors.border },
            ]}
            onPress={onMessagesPress}
            activeOpacity={0.75}
          >
            <FontAwesome5 name="comments" size={15} color={colors.textMuted} />
            {unreadMessages > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{displayMessages}</Text>
              </View>
            )}
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[
            styles.iconBtn,
            { backgroundColor: colors.cardMuted, borderColor: colors.border },
          ]}
          onPress={onNotificationsPress}
          activeOpacity={0.75}
        >
          <FontAwesome5 name="bell" size={15} color={colors.textMuted} />
          {unreadCount > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{displayCount}</Text>
            </View>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.iconBtn,
            { backgroundColor: colors.cardMuted, borderColor: colors.border },
          ]}
          onPress={onLogout}
        >
          <FontAwesome5 name="sign-out-alt" size={16} color={colors.textMuted} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#cbd5e1",
    backgroundColor: "#ffffff",
  },
  profileInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
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
  actions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    backgroundColor: "#f8fafc",
    alignItems: "center",
    justifyContent: "center",
  },
  badge: {
    position: "absolute",
    top: -4,
    right: -3,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ef4444",
    borderWidth: 2,
    borderColor: "#ffffff",
  },
  badgeText: {
    color: "#ffffff",
    fontSize: 9,
    fontWeight: "800",
  },
});
