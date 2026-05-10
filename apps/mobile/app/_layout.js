import { Stack } from "expo-router";
import { AuthProvider } from "../contexts/AuthContext";
import { ThemeProvider } from "../contexts/ThemeContext";
import CustomerNotificationProvider from "../components/notifications/CustomerNotificationProvider";

export default function RootLayout() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <CustomerNotificationProvider>
          <Stack screenOptions={{ headerShown: false }} />
        </CustomerNotificationProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
