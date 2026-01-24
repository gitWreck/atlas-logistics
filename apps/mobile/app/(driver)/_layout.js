import { Tabs } from "expo-router";
import { FontAwesome5 } from "@expo/vector-icons";

export default function DriverLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: "#0f172a",
          borderTopColor: "#334155",
          height: 60,
          paddingBottom: 8,
          paddingTop: 8,
        },
        tabBarActiveTintColor: "#3b82f6",
        tabBarInactiveTintColor: "#64748b",
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "My Trip",
          tabBarIcon: ({ color }) => (
            <FontAwesome5 name="truck-moving" size={20} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="delays"
        options={{
          title: "Report Delay",
          tabBarIcon: ({ color }) => (
            <FontAwesome5 name="clock" size={24} color={color} />
          ),
        }}
      />

      {/* Hide Scanner from Tabs */}
      <Tabs.Screen
        name="scan"
        options={{
          href: null,
          tabBarStyle: { display: "none" },
        }}
      />
    </Tabs>
  );
}
