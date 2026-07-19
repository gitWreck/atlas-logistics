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
          headerShown: false,
          contentStyle: { backgroundColor: colors.bg },
          animation: "slide_from_right",
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="delivery-info" options={{ headerShown: false, presentation: "card" }} />
        <Stack.Screen name="delivery-scan" options={{ headerShown: false, presentation: "card" }} />
        <Stack.Screen name="trip-details" options={{ headerShown: false, presentation: "card" }} />
        <Stack.Screen name="confirm-arrival" options={{ headerShown: false, presentation: "card" }} />
        <Stack.Screen name="report-issue" options={{ headerShown: false, presentation: "card" }} />
        <Stack.Screen name="chat/[conversationId]" options={{ headerShown: false, presentation: "card" }} />

        <Stack.Screen
          name="report-delay"
          options={{
            headerShown: false,
            presentation: "modal",
          }}
        />
      </Stack>
    </AuthGuard>
  );
}
