import { Tabs } from "expo-router";
import { FontAwesome5 } from "@expo/vector-icons"; // Removed MaterialIcons

export default function CheckerLayout() {
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
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Dashboard",
          tabBarIcon: ({ color }) => (
            // Changed "dashboard" (Material) to "th-large" (FontAwesome5)
            <FontAwesome5 name="th-large" size={20} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="trips"
        options={{
          title: "Trips",
          tabBarIcon: ({ color }) => (
            <FontAwesome5 name="truck" size={20} color={color} />
          ),
        }}
      />

      {/* Hide internal screens */}
      <Tabs.Screen
        name="scan"
        options={{ href: null, tabBarStyle: { display: "none" } }}
      />
      <Tabs.Screen
        name="scan-result"
        options={{ href: null, tabBarStyle: { display: "none" } }}
      />
      <Tabs.Screen
        name="trip-details"
        options={{ href: null, tabBarStyle: { display: "none" } }}
      />
      <Tabs.Screen
        name="shipment-details"
        options={{ href: null, tabBarStyle: { display: "none" } }}
      />
    </Tabs>
  );
}
