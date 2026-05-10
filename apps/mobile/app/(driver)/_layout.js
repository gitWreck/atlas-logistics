import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import AuthGuard from "../../components/auth/AuthGuard";
import { useTheme } from "../../contexts/ThemeContext";

export default function DriverLayout() {
  const { colors, resolvedScheme } = useTheme();

  return (
    <AuthGuard role="driver">
      <StatusBar
        style={resolvedScheme === "dark" ? "light" : "dark"}
        backgroundColor={colors.bg}
      />

      <Stack
        screenOptions={{
          headerShown: false, // We use custom headers in our screens
          contentStyle: { backgroundColor: colors.bg },
          animation: "slide_from_right", // Smooth transitions
        }}
      >
        {/* 1. The Tab Bar (Main Dashboard) */}
        {/* This points to app/(driver)/(tabs)/_layout.js */}
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />

        {/* 2. Full Screen Pages (These cover the tabs) */}
        <Stack.Screen
          name="trip-details"
          options={{
            headerShown: false,
            presentation: "card",
          }}
        />

        <Stack.Screen
          name="shipments"
          options={{
            headerShown: false,
            presentation: "card",
          }}
        />

        <Stack.Screen
          name="report-delay"
          options={{
            headerShown: false,
            presentation: "modal", // Modals look nice for reporting issues
          }}
        />
      </Stack>
    </AuthGuard>
  );
}
