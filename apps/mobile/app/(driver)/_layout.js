import { Tabs } from "expo-router";
import { FontAwesome } from "@expo/vector-icons";

export default function DriverLayout() {
  return (
    <Tabs screenOptions={{ tabBarActiveTintColor: "#2563eb" }}>
      <Tabs.Screen
        name="dashboard"
        options={{
          title: "My Load",
          tabBarIcon: ({ color }) => (
            <FontAwesome name="truck" size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="scan"
        options={{
          title: "Scan QR",
          tabBarIcon: ({ color }) => (
            <FontAwesome name="qrcode" size={24} color={color} />
          ),
        }}
      />
      {/* Hide these from the tab bar, but keep them accessible via navigation */}
      <Tabs.Screen
        name="delivery-form"
        options={{
          href: null,
          title: "Confirm Delivery",
        }}
      />
      <Tabs.Screen
        name="report-delay"
        options={{
          href: null,
          title: "Report Delay",
        }}
      />
    </Tabs>
  );
}
