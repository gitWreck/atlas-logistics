import React, { useEffect, useMemo, useRef } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useLocalSearchParams, useSegments } from "expo-router";
import { useAuth } from "../../contexts/AuthContext";
import {
  createPersistedRoute,
  getNavigationScope,
  getNavigationStorageKey,
} from "../utilities/navigationPersistence";

export default function NavigationPersistence() {
  const segments = useSegments();
  const params = useLocalSearchParams();
  const {
    user,
    profile,
    isReady,
    isStaff,
    isChecker,
    isDriver,
    isCustomer,
  } = useAuth();
  const lastSerializedRef = useRef(null);
  const uid = profile?.uid || user?.uid || null;
  const scope = getNavigationScope({
    isStaff,
    isChecker,
    isDriver,
    isCustomer,
  });
  const segmentsKey = segments.join("/");
  const paramsKey = useMemo(() => JSON.stringify(params || {}), [params]);

  useEffect(() => {
    if (!isReady || !uid || !scope) return;

    const record = createPersistedRoute({
      scope,
      segments,
      params,
    });
    const storageKey = getNavigationStorageKey(uid);
    if (!record || !storageKey) return;

    const serialized = JSON.stringify(record);
    if (serialized === lastSerializedRef.current) return;
    lastSerializedRef.current = serialized;

    void AsyncStorage.setItem(storageKey, serialized).catch((error) => {
      console.warn("Navigation state save skipped", error);
    });
  }, [isReady, uid, scope, segmentsKey, paramsKey]);

  return null;
}
