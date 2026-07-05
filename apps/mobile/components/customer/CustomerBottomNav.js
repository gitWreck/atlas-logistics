import React, { useCallback } from "react";
import { Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Feather from "@expo/vector-icons/Feather";
import { usePathname, useRouter } from "expo-router";
import { useTheme } from "../../contexts/ThemeContext";

export const CUSTOMER_BOTTOM_NAV_HEIGHT = 56 + 10 + (Platform.OS === "ios" ? 24 : 12);

const NAV_ITEMS = [
  { key: "home", label: "Home", icon: "home", route: "/(customer)" },
  { key: "shipments", label: "Shipments", icon: "grid", route: "/(customer)/shipments" },
  { key: "messages", label: "Messages", icon: "message-circle", route: "/(customer)/chat" },
  { key: "profile", label: "Profile", icon: "user", route: "/(customer)/profile" },
];

function normalizePath(path = "") {
  return String(path).replace(/\/+$/, "");
}

export default function CustomerBottomNav({ active = "home", unreadMessages = 0 }) {
  const router = useRouter();
  const pathname = usePathname();
  const { colors } = useTheme();
  const messageCount = unreadMessages > 9 ? "9+" : String(unreadMessages);

  const handleTabPress = useCallback(
    (route) => {
      const currentPath = normalizePath(pathname);
      const targetPath = normalizePath(route);
      const isSameRoute = currentPath === targetPath;
      const isChatSubRoute = targetPath === "/(customer)/chat" && currentPath.startsWith(`${targetPath}/`);

      if (isSameRoute || isChatSubRoute) {
        return;
      }

      router.push(targetPath);
    },
    [pathname, router],
  );

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.dashboardBg,
          borderTopColor: colors.dashboardBorder,
        },
      ]}
    >
      {NAV_ITEMS.map((item) => {
        const isActive = active === item.key;
        const isMessages = item.key === "messages";

        return (
          <TouchableOpacity
            key={item.key}
            style={styles.item}
            activeOpacity={0.75}
            onPress={() => handleTabPress(item.route)}
          >
            <View style={styles.iconWrap}>
              <Feather
                name={item.icon}
                size={22}
                color={isActive ? colors.primary : colors.iconMuted}
              />
              {isMessages && unreadMessages > 0 && (
                <View
                  style={[
                    styles.badge,
                    {
                      backgroundColor: colors.danger,
                      borderColor: colors.dashboardBg,
                    },
                  ]}
                >
                  <Text style={[styles.badgeText, { color: colors.onDanger }]}>
                    {messageCount}
                  </Text>
                </View>
              )}
            </View>
            <Text
              style={[
                styles.label,
                { color: isActive ? colors.primary : colors.textMuted },
              ]}
              numberOfLines={1}
            >
              {item.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    borderTopWidth: 1,
    paddingTop: 10,
    paddingBottom: Platform.OS === "ios" ? 24 : 12,
    paddingHorizontal: 8,
  },
  item: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    minHeight: 56,
  },
  iconWrap: {
    width: 36,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    fontSize: 11,
    fontWeight: "400",
  },
  badge: {
    position: "absolute",
    top: -9,
    right: -6,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    paddingHorizontal: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: {
    fontSize: 10,
    fontWeight: "900",
  },
});
