import { View, ActivityIndicator } from "react-native";
import { Redirect } from "expo-router";
import { useAuth } from "../../contexts/AuthContext";
import { COLORS, GLOBAL_STYLES } from "../constants/theme";

/**
 * Protects checker/driver routes. Shows loading, redirects to login if unauthorized,
 * or renders children when user has the allowed role.
 * @param {"checker" | "driver"} role - Allowed role (lowercase).
 * @param {React.ReactNode} children - Layout content to render when allowed.
 * @param {string} [loaderColor] - ActivityIndicator color (default: theme primary).
 */
export default function AuthGuard({ role, children, loaderColor = COLORS.primary }) {
  const { user, isChecker, isDriver, loading, isReady } = useAuth();
  const allowed = role === "checker" ? isChecker : isDriver;

  if (!isReady || loading) {
    return (
      <View style={GLOBAL_STYLES.center}>
        <ActivityIndicator size="large" color={loaderColor} />
      </View>
    );
  }
  if (!user || !allowed) {
    return <Redirect href="/(auth)/login" />;
  }

  return children;
}
