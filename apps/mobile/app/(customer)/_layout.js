import { Tabs } from "expo-router";
import { StatusBar } from "expo-status-bar";
import AuthGuard from "../../components/auth/AuthGuard";
import { useTheme } from "../../contexts/ThemeContext";

export default function CustomerLayout() {
  const { colors, resolvedScheme } = useTheme();
  const statusStyle = resolvedScheme === "dark" ? "light" : "dark";

  return (
    <AuthGuard role="customer">
      <StatusBar style={statusStyle} backgroundColor={colors.bg} />

      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarStyle: { display: "none" },
          contentStyle: { backgroundColor: colors.bg },
        }}
      >
        <Tabs.Screen name="index" options={{ headerShown: false }} />
        <Tabs.Screen name="shipments" options={{ headerShown: false }} />
        <Tabs.Screen name="invoices" options={{ headerShown: false }} />
        <Tabs.Screen name="schedules" options={{ headerShown: false }} />
        <Tabs.Screen name="faq" options={{ headerShown: false }} />
        <Tabs.Screen name="branch-locations" options={{ headerShown: false }} />
        <Tabs.Screen name="branch" options={{ headerShown: false }} />
        <Tabs.Screen name="chat" options={{ headerShown: false }} />
        <Tabs.Screen name="profile" options={{ headerShown: false }} />
      </Tabs>
    </AuthGuard>
  );
}
