import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import AuthGuard from "../../components/auth/AuthGuard"; // Adjust path

export default function CheckerStackLayout() {
  return (
    <AuthGuard role="checker" loaderColor="#3b82f6">
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: "#0f172a" },
          animation: "slide_from_right",
        }}
      >
        {/* 1. The Tabs (Dashboard & Trips) */}
        {/* This points to app/(checker)/(tabs)/_layout.js */}
        <Stack.Screen name="(tabs)" />

        {/* 2. Full Screen Pages (These cover the tabs) */}
        <Stack.Screen name="trip-details" />
        <Stack.Screen name="shipment-details" />

        <Stack.Screen
          name="scan"
          options={{
            presentation: "fullScreenModal",
            animation: "fade_from_bottom",
          }}
        />
      </Stack>
    </AuthGuard>
  );
}
