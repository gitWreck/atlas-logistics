import { StyleSheet, View } from "react-native";
import { Tabs } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Feather from "@expo/vector-icons/Feather";

import { useTheme } from "../../../contexts/ThemeContext";

export default function DriverTabsLayout() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { backgroundColor: colors.dashboardBg, paddingTop: insets.top }]}>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarHideOnKeyboard: true,
          tabBarStyle: {
            backgroundColor: colors.dashboardBg,
            borderTopColor: colors.dashboardBorder,
            borderTopWidth: 1,
            height: 78 + insets.bottom,
            paddingBottom: Math.max(insets.bottom, 12),
            paddingTop: 10,
            elevation: 0,
          },
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.textMuted,
          tabBarLabelStyle: {
            fontSize: 11,
            lineHeight: 15,
            fontWeight: "400",
            marginTop: 4,
          },
          tabBarItemStyle: { minHeight: 56 },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: "Home",
            tabBarIcon: ({ color }) => <Feather name="home" size={22} color={color} />,
          }}
        />
        <Tabs.Screen
          name="deliveries"
          options={{
            title: "Trips",
            tabBarIcon: ({ color }) => <Feather name="truck" size={22} color={color} />,
          }}
        />
        <Tabs.Screen
          name="messages"
          options={{
            title: "Messages",
            tabBarIcon: ({ color }) => <Feather name="message-square" size={22} color={color} />,
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: "Profile",
            tabBarIcon: ({ color }) => <Feather name="user" size={22} color={color} />,
          }}
        />
      </Tabs>
    </View>
  );
}

const styles = StyleSheet.create({ container: { flex: 1 } });
