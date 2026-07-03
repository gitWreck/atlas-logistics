import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import AuthGuard from "../../components/auth/AuthGuard";
import { useTheme } from "../../contexts/ThemeContext";

export default function CustomerLayout() {
  const { colors, resolvedScheme } = useTheme();
  const statusStyle = resolvedScheme === "dark" ? "light" : "dark";

  return (
    <AuthGuard role="customer">
      <StatusBar style={statusStyle} backgroundColor={colors.bg} />

      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.bg },
          animation: "slide_from_right",
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="shipments" options={{ headerShown: false }} />
        {/* <Stack.Screen name="tracking/index" options={{ headerShown: false }} /> */}
      </Stack>
    </AuthGuard>
  );
}
