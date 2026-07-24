import { StyleSheet, View } from "react-native";
import { Tabs } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Feather from "@expo/vector-icons/Feather";
import { useTheme } from "../../../contexts/ThemeContext";

export default function ManagerTabsLayout() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarHideOnKeyboard: true,
          tabBarActiveTintColor: "#4f46e5",
          tabBarInactiveTintColor: colors.textMuted,
          tabBarStyle: {
            minHeight: 68,
            height: 68 + insets.bottom,
            paddingTop: 8,
            paddingBottom: Math.max(insets.bottom, 9),
            backgroundColor: colors.surface,
            borderTopColor: colors.border,
            borderTopWidth: StyleSheet.hairlineWidth,
          },
          tabBarLabelStyle: { fontSize: 10, lineHeight: 14, fontWeight: "700", marginTop: 3 },
          tabBarItemStyle: { minHeight: 54 },
        }}
      >
        <Tabs.Screen name="index" options={{ title: "Home", tabBarIcon: ({ color }) => <Feather name="home" size={22} color={color} /> }} />
        <Tabs.Screen name="trips" options={{ title: "Trips", tabBarIcon: ({ color }) => <Feather name="map" size={22} color={color} /> }} />
        <Tabs.Screen name="shipments" options={{ title: "Shipments", tabBarIcon: ({ color }) => <Feather name="package" size={22} color={color} /> }} />
        <Tabs.Screen name="messages" options={{ title: "Messages", tabBarIcon: ({ color }) => <Feather name="message-circle" size={22} color={color} /> }} />
        <Tabs.Screen name="profile" options={{ title: "Profile", tabBarIcon: ({ color }) => <Feather name="user" size={22} color={color} /> }} />
      </Tabs>
    </View>
  );
}

const styles = StyleSheet.create({ container: { flex: 1 } });
