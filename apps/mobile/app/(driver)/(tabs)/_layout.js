import { Tabs } from "expo-router";
import { FontAwesome5 } from "@expo/vector-icons";
import { COLORS } from "../../../components/constants/theme"; // Check path depth

export default function DriverTabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: COLORS.card, // Dark card color
          borderTopColor: "#334155", // Subtle border
          height: 60,
          paddingBottom: 8,
          paddingTop: 8,
        },
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.textSecondary,
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: "600",
        },
      }}
    >
      {/* Tab 1: Dashboard (Your index.js) */}
      <Tabs.Screen
        name="index"
        options={{
          title: "Trips",
          tabBarIcon: ({ color, size }) => (
            <FontAwesome5 name="truck" size={20} color={color} />
          ),
        }}
      />

      {/* Tab 2: Profile (Create profile.js in (tabs) folder) */}
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color, size }) => (
            <FontAwesome5 name="user-alt" size={20} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
