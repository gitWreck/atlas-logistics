import { useEffect, useMemo, useState } from "react";
import { Redirect } from "expo-router";
import { View, ActivityIndicator } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "../contexts/AuthContext";
import { COLORS, GLOBAL_STYLES } from "../components/constants/theme";
import {
  getNavigationScope,
  getNavigationStorageKey,
  parsePersistedRoute,
} from "../components/utilities/navigationPersistence";

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
  const uid = user?.uid || null;
  const scope = getNavigationScope({
    isStaff,
    isChecker,
    isDriver,
    isCustomer,
  });
  const restorationKey = uid && scope ? `${uid}:${scope}` : null;
  const [restoration, setRestoration] = useState({
    key: null,
    href: null,
  });

  useEffect(() => {
    if (!isReady || loading || !uid || !scope || !restorationKey) return;

    let cancelled = false;
    const storageKey = getNavigationStorageKey(uid);
    if (!storageKey) {
      setRestoration({ key: restorationKey, href: null });
      return undefined;
    }

    void AsyncStorage.getItem(storageKey)
      .then((raw) => parsePersistedRoute(raw, { scope }))
      .then((href) => {
        if (!cancelled) setRestoration({ key: restorationKey, href });
      })
      .catch((error) => {
        console.warn("Navigation state restore skipped", error);
        if (!cancelled) setRestoration({ key: restorationKey, href: null });
      });

    return () => {
      cancelled = true;
    };
  }, [isReady, loading, uid, scope, restorationKey]);

  const restoring = useMemo(
    () => Boolean(restorationKey && restoration.key !== restorationKey),
    [restorationKey, restoration.key],
  );

  if (!isReady || loading || restoring) {
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
    return <Redirect href={restoration.href || "/(checker)"} />;
  }

  if (isDriver) {
    return <Redirect href={restoration.href || "/(driver)/"} />;
  }

  if (isCustomer) {
    return <Redirect href={restoration.href || "/(customer)/"} />;
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
