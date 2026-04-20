import {
  View,
  StyleSheet,
  Platform,
  StatusBar as RNStatusBar,
} from "react-native";
import { Tabs, useRouter } from "expo-router";
import { FontAwesome5 } from "@expo/vector-icons";
import { signOut } from "firebase/auth";
import { auth } from "../../../firebase";

import CheckerHeader from "../../../components/checker/CheckerHeader";
import { useAuth } from "../../../contexts/AuthContext"; // adjust path if needed

export default function CheckerTabsLayout() {
  const router = useRouter();
  const { user } = useAuth();

  const handleLogout = async () => {
    try {
      await signOut(auth);
      router.replace("/(auth)/login");
    } catch (err) {
      console.error("Logout failed:", err);
    }
  };

  return (
    <View style={styles.container}>
      {/* ✅ SHARED HEADER FOR ALL TAB SCREENS */}
      <CheckerHeader
        userName={user?.name || user?.fullName || "Checker"}
        onLogout={handleLogout}
        onProfilePress={() => router.push("/(checker)/profile")}
      />

      {/* ✅ TABS BELOW HEADER */}
      <Tabs
        screenOptions={{
          headerShown: false, // still false because we use custom header
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
    </View>
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
