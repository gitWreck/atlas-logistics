import { Stack } from "expo-router";

/**
 * Driver main screen layout (no bottom tab bar).
 * Index is the My Trips dashboard.
 */
export default function DriverTabsLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen name="index" />
    </Stack>
  );
}
