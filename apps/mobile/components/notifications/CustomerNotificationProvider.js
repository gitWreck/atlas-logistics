import React, { useCallback, useEffect, useRef } from "react";
import { Platform } from "react-native";
import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import { useRouter } from "expo-router";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";

import { db } from "../../firebase";
import { useAuth } from "../../contexts/AuthContext";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

function getProjectId() {
  return (
    Constants.expoConfig?.extra?.eas?.projectId ||
    Constants.easConfig?.projectId ||
    null
  );
}

function getTokenDocId(token) {
  return String(token || "").replace(/[^a-zA-Z0-9_-]/g, "_");
}

function getRouteFromNotificationData(data = {}) {
  const trackingId = data.trackingId || data.shipmentId || data.entityId;

  if (data.screen === "tracking" && trackingId) {
    return {
      pathname: "/(customer)/tracking/",
      params: { trackingId },
    };
  }

  if (data.screen === "chat" && data.conversationId) {
    return {
      pathname: "/(customer)/chat/[conversationId]",
      params: { conversationId: data.conversationId },
    };
  }

  return null;
}

export default function CustomerNotificationProvider({ children }) {
  const router = useRouter();
  const { user, isCustomer, isReady } = useAuth();
  const registeredUidRef = useRef(null);
  const attemptedUidRef = useRef(null);

  const registerPushToken = useCallback(async () => {
    if (!isReady || !isCustomer || !user?.uid) return;
    if (attemptedUidRef.current === user.uid) return;
    if (registeredUidRef.current === user.uid) return;
    attemptedUidRef.current = user.uid;

    const { status: existingStatus } =
      await Notifications.getPermissionsAsync();

    let finalStatus = existingStatus;
    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== "granted") return;

    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "Default",
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#2563eb",
      });
    }

    const projectId = getProjectId();
    const tokenResult = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined,
    );
    const token = tokenResult?.data;
    if (!token) return;

    const tokenDocId = getTokenDocId(token);
    await setDoc(
      doc(db, "users", user.uid, "pushTokens", tokenDocId),
      {
        token,
        provider: "expo",
        platform: Platform.OS,
        enabled: true,
        updatedAt: serverTimestamp(),
        createdAt: serverTimestamp(),
      },
      { merge: true },
    );

    registeredUidRef.current = user.uid;
  }, [isCustomer, isReady, user?.uid]);

  useEffect(() => {
    registerPushToken().catch((error) => {
      console.warn("Push notification registration skipped:", error);
    });
  }, [registerPushToken]);

  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const data = response.notification.request.content.data || {};
        const route = getRouteFromNotificationData(data);
        if (route) router.push(route);
      },
    );

    return () => subscription.remove();
  }, [router]);

  useEffect(() => {
    let mounted = true;

    Notifications.getLastNotificationResponseAsync()
      .then((response) => {
        if (!mounted || !response) return;
        const data = response.notification.request.content.data || {};
        const route = getRouteFromNotificationData(data);
        if (route) router.push(route);
      })
      .catch(() => {});

    return () => {
      mounted = false;
    };
  }, [router]);

  return children;
}
