import {
  SafeAreaView,
  StyleSheet,
  Platform,
  StatusBar as RNStatusBar,
} from "react-native";
import { Tabs, useRouter } from "expo-router";
import { FontAwesome5 } from "@expo/vector-icons";
import { signOut } from "firebase/auth";
import { auth } from "../../../firebase";

import CheckerHeader from "../../../components/checker/CheckerHeader";
import { useAuth } from "../../../contexts/AuthContext";
import { CheckerLastMileProvider } from "../../../contexts/CheckerLastMileContext";
import { useTheme } from "../../../contexts/ThemeContext";

export default function CheckerTabsLayout() {
  const router = useRouter();
  const { user } = useAuth();
  const { colors } = useTheme();

  const handleLogout = async () => {
    try {
      await signOut(auth);
      router.replace("/(auth)/login");
    } catch (err) {
      console.error("Logout failed:", err);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}>
      {/* ✅ SHARED HEADER FOR ALL TAB SCREENS */}
      <CheckerHeader
        userName={user?.name || user?.fullName || "Checker"}
        onLogout={handleLogout}
        onProfilePress={() => router.push("/(checker)/profile")}
      />

      <CheckerLastMileProvider>
      <Tabs
        screenOptions={{
          headerShown: false, // still false because we use custom header
          tabBarStyle: {
            backgroundColor: colors.surface,
            borderTopColor: colors.border,
            height: 60,
            paddingBottom: 8,
            paddingTop: 8,
          },
          tabBarActiveTintColor: "#07B9F4",
          tabBarInactiveTintColor: colors.textMuted,
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
        <Tabs.Screen
          name="available-to-load"
          options={{
            title: "Available",
            tabBarIcon: ({ color }) => (
              <FontAwesome5 name="warehouse" size={20} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="deliveries"
          options={{
            title: "My Route",
            tabBarIcon: ({ color }) => (
              <FontAwesome5 name="clipboard-list" size={20} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="delivery-load"
          options={{
            title: "My Load",
            tabBarIcon: ({ color }) => (
              <FontAwesome5 name="shipping-fast" size={20} color={color} />
            ),
          }}
        />
      </Tabs>
      </CheckerLastMileProvider>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f1f5f9", // match your screens

    // ✅ Fix for Android status bar overlap
    paddingTop: Platform.OS === "android" ? RNStatusBar.currentHeight || 0 : 0,
  },
});
