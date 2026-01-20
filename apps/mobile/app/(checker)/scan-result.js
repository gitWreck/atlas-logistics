import { Stack } from "expo-router";

export default function CheckerLayout() {
  return (
    <Stack>
      <Stack.Screen name="dashboard" options={{ title: "Checker Dashboard" }} />
      <Stack.Screen name="scan-result" options={{ title: "Package Details" }} />
    </Stack>
  );
}
