import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { COLORS } from "../../components/constants/theme";
import AuthGuard from "../../components/auth/AuthGuard";

export default function DriverLayout() {
  return (
    <AuthGuard role="driver">
      <StatusBar style="light" backgroundColor={COLORS.bg} />

      <Stack
        screenOptions={{
          headerShown: false, // We use custom headers in our screens
          contentStyle: { backgroundColor: COLORS.bg }, // Dark background
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
