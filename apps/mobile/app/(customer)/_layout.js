import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import AuthGuard from "../../components/auth/AuthGuard";

export default function CustomerLayout() {
  return (
    <AuthGuard role="customer">
      <StatusBar style="dark" backgroundColor="#f1f5f9" />

      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: "#f1f5f9" },
          animation: "slide_from_right",
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="tracking/[trackingId]" options={{ headerShown: false }} />
      </Stack>
    </AuthGuard>
  );
}

