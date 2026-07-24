import { Redirect } from "expo-router";
import { View, ActivityIndicator } from "react-native";
import { useAuth } from "../contexts/AuthContext";
import { COLORS, GLOBAL_STYLES } from "../components/constants/theme";

export default function Index() {
  const {
    user,
    loading,
    isReady,
    isAllowedRole,
    isChecker,
    isDriver,
    isCustomer,
    isStaff,
    signOut,
  } = useAuth();

  if (!isReady || loading) {
    return (
      <View style={GLOBAL_STYLES.center}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  if (!user) {
    return <Redirect href="/(auth)/login" />;
  }

  // Admin/manager use the same last-mile app as checkers (all municipalities).
  if (isStaff || isChecker) {
    return <Redirect href="/(checker)" />;
  }

  if (isDriver) {
    return <Redirect href="/(driver)/" />;
  }

  if (isCustomer) {
    return <Redirect href="/(customer)/" />;
  }

  if (!isAllowedRole) {
    signOut();
    return <Redirect href="/(auth)/login" />;
  }

  return (
    <View style={GLOBAL_STYLES.center}>
      <ActivityIndicator size="large" color={COLORS.primary} />
    </View>
  );
}
