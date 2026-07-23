import { View, ActivityIndicator } from "react-native";
import { Redirect } from "expo-router";
import { useAuth } from "../../contexts/AuthContext";
import { COLORS, GLOBAL_STYLES } from "../constants/theme";

/**
 * Protects role-based routes. Shows loading, redirects to login if unauthorized,
 * or renders children when user has the allowed role.
 * @param {"checker" | "driver" | "customer" | "staff"} role - Allowed role (lowercase).
 * @param {React.ReactNode} children - Layout content to render when allowed.
 * @param {string} [loaderColor] - ActivityIndicator color (default: theme primary).
 */
export default function AuthGuard({ role, children, loaderColor = COLORS.primary }) {
  const { user, isChecker, isDriver, isCustomer, isStaff, loading, isReady } =
    useAuth();

  let allowed = false;
  if (role === "checker") {
    allowed = isChecker;
  } else if (role === "driver") {
    allowed = isDriver;
  } else if (role === "customer") {
    allowed = isCustomer;
  } else if (role === "staff") {
    allowed = isStaff;
  }

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
