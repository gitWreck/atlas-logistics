import React from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { FontAwesome5 } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useTheme } from "../../contexts/ThemeContext";
import { useAuth } from "../../contexts/AuthContext";

const ACCESS_ITEMS = [
  {
    label: "Trips",
    icon: "route",
    route: "/(manager)/(tabs)/trips",
    staffRoute: "/(checker)/(tabs)/quick/trips",
    color: "#1769ff",
  },
  {
    label: "Shipments",
    icon: "boxes",
    route: "/(manager)/(tabs)/shipments",
    staffRoute: "/(checker)/(tabs)/quick/shipments",
    color: "#8b5cf6",
  },
  {
    label: "Trucks",
    icon: "truck",
    route: "/(manager)/management/trucks",
    staffRoute: "/(checker)/(tabs)/quick/management/trucks",
    color: "#06a9c8",
  },
  {
    label: "Invoices",
    icon: "file-invoice-dollar",
    route: "/(manager)/management/invoices",
    staffRoute: "/(checker)/(tabs)/quick/management/invoices",
    color: "#16b85b",
  },
  {
    label: "Customers",
    icon: "user-friends",
    route: "/(manager)/management/customers",
    staffRoute: "/(checker)/(tabs)/quick/management/customers",
    color: "#f59e0b",
  },
  {
    label: "User Management",
    icon: "users-cog",
    route: "/(manager)/management/staff",
    staffRoute: "/(checker)/(tabs)/quick/management/staff",
    color: "#f5a000",
  },
  {
    id: "customer-notification-history",
    label: "Customer Notification History",
    icon: "bell",
    route: { pathname: "/(manager)/notifications", params: { view: "customer" } },
    staffRoute: {
      pathname: "/(checker)/(tabs)/quick/notifications",
      params: { view: "customer" },
    },
    color: "#12b8c4",
  },
  {
    id: "all-customer-notification-history",
    label: "Customer Notification History",
    icon: "history",
    route: { pathname: "/(manager)/notifications", params: { view: "history" } },
    staffRoute: {
      pathname: "/(checker)/(tabs)/quick/notifications",
      params: { view: "history" },
    },
    color: "#5b6ff7",
  },
  {
    label: "Recent Delays\n& Alerts",
    icon: "exclamation-triangle",
    route: { pathname: "/(manager)/notifications", params: { view: "alerts" } },
    staffRoute: {
      pathname: "/(checker)/(tabs)/quick/notifications",
      params: { view: "alerts" },
    },
    color: "#ec4899",
  },
  {
    label: "Settings",
    icon: "cog",
    route: "/(manager)/management/settings",
    staffRoute: "/(checker)/(tabs)/quick/management/settings",
    color: "#78909c",
  },
];

export default function ManagerQuickAccess({
  inset = true,
  preserveStaffTabs = false,
}) {
  const router = useRouter();
  const { colors } = useTheme();
  const { role } = useAuth();
  const isManager = String(role || "").toLowerCase() === "manager";
  const accessItems = isManager
    ? ACCESS_ITEMS.filter(
        (item) => !["User Management", "Settings"].includes(item.label),
      )
    : ACCESS_ITEMS;

  return (
    <View
      style={[
        styles.section,
        !inset && styles.sectionEmbedded,
      ]}
    >
      <View style={styles.heading}>
        <View style={styles.headingCopy}>
          <FontAwesome5 name="th-large" size={15} color={colors.primary} />
          <Text style={[styles.headingText, { color: colors.text }]}>
            Quick Access
          </Text>
        </View>
      </View>

      <View style={styles.grid}>
        {accessItems.map((item) => (
          <Pressable
            key={item.id || item.label}
            accessibilityRole="button"
            accessibilityLabel={`Open ${item.label}`}
            onPress={() =>
              router.push(
                preserveStaffTabs ? item.staffRoute || item.route : item.route,
              )
            }
            style={({ pressed }) => [
              styles.item,
              isManager && styles.managerItem,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
                shadowColor: colors.shadow || "#0f172a",
              },
              pressed && styles.pressed,
            ]}
          >
            <View
              style={[
                styles.itemIcon,
                { backgroundColor: `${item.color}18` },
              ]}
            >
              <FontAwesome5 name={item.icon} size={24} color={item.color} />
            </View>
            <Text
              style={[styles.itemLabel, { color: colors.text }]}
              numberOfLines={3}
              adjustsFontSizeToFit
              minimumFontScale={0.8}
            >
              {item.label}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginHorizontal: 14,
    marginTop: 13,
    paddingBottom: 4,
  },
  sectionEmbedded: { marginHorizontal: 0, marginTop: 0 },
  heading: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  headingCopy: { flexDirection: "row", alignItems: "center", gap: 13 },
  headingText: { fontSize: 17, fontWeight: "700" },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: 7,
  },
  item: {
    width: "18.4%",
    minWidth: 0,
    minHeight: 94,
    borderWidth: 1,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 1,
    paddingVertical: 8,
    shadowOpacity: 0.04,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  managerItem: { width: "23.5%" },
  itemIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  itemLabel: {
    width: "100%",
    minHeight: 33,
    marginTop: 6,
    textAlign: "center",
    fontSize: 8.5,
    lineHeight: 10.5,
    fontWeight: "700",
  },
  pressed: { opacity: 0.72, transform: [{ scale: 0.97 }] },
});
