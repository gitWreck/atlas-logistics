import { StyleSheet, View } from "react-native";
import { Tabs } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Feather from "@expo/vector-icons/Feather";

import { useTheme } from "../../../contexts/ThemeContext";

export default function DriverTabsLayout() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const softBorder = withAlpha(colors.text, 0.08);

  return (
    <View style={[styles.container, { backgroundColor: colors.dashboardBg, paddingTop: insets.top }]}>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarHideOnKeyboard: true,
          tabBarStyle: {
            height: 78 + insets.bottom,
            paddingTop: 10,
            paddingBottom: Math.max(insets.bottom, 12),
            backgroundColor: colors.dashboardBg,
            borderTopColor: softBorder,
            borderTopWidth: StyleSheet.hairlineWidth,
            borderLeftWidth: 0,
            borderRightWidth: 0,
            borderBottomWidth: 0,
            elevation: 0,
          },
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.textMuted,
          tabBarLabelStyle: {
            fontSize: 11,
            lineHeight: 14,
            fontWeight: "400",
            marginTop: 4,
          },
          tabBarItemStyle: {
            minHeight: 56,
            alignItems: "center",
            justifyContent: "center",
          },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: "Home",
            tabBarIcon: ({ color }) => <Feather name="home" size={25} color={color} />,
          }}
        />
        <Tabs.Screen
          name="deliveries"
          options={{
            title: "Trips",
            tabBarIcon: ({ color }) => <Feather name="truck" size={25} color={color} />,
          }}
        />
        <Tabs.Screen
          name="messages"
          options={{
            title: "Messages",
            tabBarIcon: ({ color }) => <Feather name="message-square" size={25} color={color} />,
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: "Profile",
            tabBarIcon: ({ color }) => <Feather name="user" size={25} color={color} />,
          }}
        />
      </Tabs>
    </View>
  );
}

function withAlpha(color, opacity) {
  const raw = String(color || "").replace("#", "");
  if (raw.length !== 6) return color;
  const r = parseInt(raw.slice(0, 2), 16);
  const g = parseInt(raw.slice(2, 4), 16);
  const b = parseInt(raw.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

const styles = StyleSheet.create({
  container: { flex: 1 },
});
