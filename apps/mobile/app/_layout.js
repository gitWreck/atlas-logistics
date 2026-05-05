import { Stack } from "expo-router";
import { AuthProvider } from "../contexts/AuthContext";
import CustomerNotificationProvider from "../components/notifications/CustomerNotificationProvider";

export default function RootLayout() {
  return (
    <AuthProvider>
      <CustomerNotificationProvider>
        <Stack screenOptions={{ headerShown: false }} />
      </CustomerNotificationProvider>
    </AuthProvider>
  );
}
