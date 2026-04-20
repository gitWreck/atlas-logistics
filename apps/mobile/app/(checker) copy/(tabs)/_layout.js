import { Tabs } from "expo-router";
import { FontAwesome5 } from "@expo/vector-icons";

export default function CheckerTabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: "#ffffff",
          borderTopColor: "#cbd5e1",
          height: 60,
          paddingBottom: 8,
          paddingTop: 8,
        },
        tabBarActiveTintColor: "#07B9F4",
        tabBarInactiveTintColor: "#475569",
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
