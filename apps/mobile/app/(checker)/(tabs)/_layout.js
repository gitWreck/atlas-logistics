import { Tabs } from "expo-router";
import { FontAwesome5 } from "@expo/vector-icons";

export default function CheckerTabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: "#0f172a", // Dark Background
          borderTopColor: "#334155", // Subtle Border
          height: 60,
          paddingBottom: 8,
          paddingTop: 8,
        },
        tabBarActiveTintColor: "#3b82f6", // Blue for Checkers
        tabBarInactiveTintColor: "#64748b",
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: "600",
          marginTop: 4,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Dashboard",
          tabBarIcon: ({ color }) => (
            <FontAwesome5 name="th-large" size={20} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="trips"
        options={{
          title: "Active Loads",
          tabBarIcon: ({ color }) => (
            <FontAwesome5 name="truck-loading" size={20} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
