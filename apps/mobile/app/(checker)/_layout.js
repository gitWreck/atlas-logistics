import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import AuthGuard from "../../components/auth/AuthGuard"; // Adjust path
import { useTheme } from "../../contexts/ThemeContext";
import { OfflineSyncProvider } from "../../contexts/OfflineSyncContext";
import { CheckerLastMileProvider } from "../../contexts/CheckerLastMileContext";
import OfflineStatusBar from "../../components/checker/OfflineStatusBar";

export default function CheckerStackLayout() {
  const { colors, resolvedScheme } = useTheme();

  return (
    <AuthGuard role="checker" loaderColor="#3b82f6">
      <OfflineSyncProvider>
        <CheckerLastMileProvider>
      <StatusBar
        style={resolvedScheme === "dark" ? "light" : "dark"}
        backgroundColor={colors.surface}
      />
      <OfflineStatusBar />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.bg },
          animation: "slide_from_right",
        }}
      >
        {/* 1. The Tabs (Dashboard & Trips) */}
        {/* This points to app/(checker)/(tabs)/_layout.js */}
        <Stack.Screen name="(tabs)" />

        {/* 2. Full Screen Pages (These cover the tabs) */}
        <Stack.Screen name="trip-details" />
        <Stack.Screen name="shipment-details" />
        <Stack.Screen name="delivery-manifest" />

        <Stack.Screen
          name="scan"
          options={{
            presentation: "fullScreenModal",
            animation: "fade_from_bottom",
          }}
        />
      </Stack>
        </CheckerLastMileProvider>
      </OfflineSyncProvider>
    </AuthGuard>
  );
}
