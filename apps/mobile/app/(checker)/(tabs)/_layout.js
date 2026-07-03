import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets as useSAInsets } from "react-native-safe-area-context";
import { Tabs, useRouter } from "expo-router";
import { FontAwesome5 } from "@expo/vector-icons";
import { signOut } from "firebase/auth";
import { auth } from "../../../firebase";

import CheckerHeader from "../../../components/checker/CheckerHeader";
import { useAuth } from "../../../contexts/AuthContext";
import { useTheme } from "../../../contexts/ThemeContext";

export default function CheckerTabsLayout() {
  const router = useRouter();
  const { user } = useAuth();
  const { colors } = useTheme();
  const insets = useSAInsets();

  const handleLogout = async () => {
    try {
      await signOut(auth);
      router.replace("/(auth)/login");
    } catch (err) {
      console.error("Logout failed:", err);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}> 
      <View style={[styles.inner, { backgroundColor: colors.surface }]}> 
        {/* ✅ SHARED HEADER FOR ALL TAB SCREENS */}
        <CheckerHeader
          userName={user?.name || user?.fullName || "Checker"}
          onLogout={handleLogout}
          onProfilePress={() => router.push("/(checker)/profile")}
        />

        <Tabs
          screenOptions={{
            headerShown: false,
            tabBarStyle: {
              backgroundColor: colors.surface,
              borderTopColor: colors.border,
              borderTopWidth: StyleSheet.hairlineWidth,
              minHeight: 66,
              height: "auto",
              paddingHorizontal: 10,
              paddingBottom: Math.max(insets.bottom, 10),
            },
            tabBarActiveTintColor: "#2563eb",
            tabBarInactiveTintColor: colors.textMuted,
            tabBarLabelStyle: {
              fontSize: 10,
              fontWeight: "700",
              lineHeight: 14,
              marginTop: 4,
              paddingHorizontal: 0,
            },
            tabBarItemStyle: {
              paddingVertical: 4,
              paddingHorizontal: 4,
              minHeight: 58,
            },
            tabBarIconStyle: {
              marginBottom: 4,
            },
          }}
        >
          <Tabs.Screen
            name="index"
            options={{
              title: "Home",
              tabBarIcon: ({ color }) => (
                <FontAwesome5 name="home" size={20} color={color} />
              ),
            }}
          />

          <Tabs.Screen
            name="available-to-load"
            options={{
              title: "Available",
              tabBarIcon: ({ color }) => (
                <FontAwesome5 name="box" size={20} color={color} />
              ),
            }}
          />
          <Tabs.Screen
            name="deliveries"
            options={{
              title: "Route",
              tabBarIcon: ({ color }) => (
                <FontAwesome5 name="map-marker-alt" size={20} color={color} />
              ),
            }}
          />
          <Tabs.Screen
            name="delivery-load"
            options={{
              title: "Load",
              tabBarIcon: ({ color }) => (
                <FontAwesome5 name="truck" size={20} color={color} />
              ),
            }}
          />
        </Tabs>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f1f5f9",
  },
  inner: {
    flex: 1,
  },
});
