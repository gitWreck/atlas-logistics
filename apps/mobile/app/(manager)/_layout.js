import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaView } from "react-native-safe-area-context";
import AuthGuard from "../../components/auth/AuthGuard";
import { useTheme } from "../../contexts/ThemeContext";

export default function ManagerLayout() {
  const { colors, resolvedScheme } = useTheme();
  return (
    <AuthGuard role="manager" loaderColor="#4f46e5">
      <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: colors.surface }}>
        <StatusBar
          style={resolvedScheme === "dark" ? "light" : "dark"}
          backgroundColor={colors.surface}
          translucent={false}
        />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.bg },
            animation: "slide_from_right",
          }}
        >
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="shipment-details" />
          <Stack.Screen name="trip-details" />
          <Stack.Screen name="notifications" />
          <Stack.Screen name="management/[module]" />
          <Stack.Screen name="chat/[conversationId]" />
        </Stack>
      </SafeAreaView>
    </AuthGuard>
  );
}
