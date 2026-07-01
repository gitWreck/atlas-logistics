import { Stack } from "expo-router";
import { Alert, Platform } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider } from "../contexts/AuthContext";
import { ThemeProvider } from "../contexts/ThemeContext";
import CustomerNotificationProvider from "../components/notifications/CustomerNotificationProvider";

// `Alert.alert` is a no-op on react-native-web, which makes confirmation
// buttons (logout, delete, etc.) appear broken in the browser. Map it to the
// browser's native alert/confirm dialogs so those flows work on web too.
if (Platform.OS === "web" && typeof window !== "undefined") {
  Alert.alert = (title, message, buttons) => {
    const text = [title, message].filter(Boolean).join("\n\n");

    if (!buttons || buttons.length === 0) {
      window.alert(text);
      return;
    }

    if (buttons.length === 1) {
      window.alert(text);
      buttons[0]?.onPress?.();
      return;
    }

    const confirmBtn = buttons.find((b) => b.style !== "cancel") || buttons[0];
    const cancelBtn = buttons.find((b) => b.style === "cancel");

    if (window.confirm(text)) {
      confirmBtn?.onPress?.();
    } else {
      cancelBtn?.onPress?.();
    }
  };
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AuthProvider>
          <CustomerNotificationProvider>
            <Stack screenOptions={{ headerShown: false }} />
          </CustomerNotificationProvider>
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
