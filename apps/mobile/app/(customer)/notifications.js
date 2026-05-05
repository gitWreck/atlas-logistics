import React, { useEffect, useState } from "react";
import {
  Platform,
  SafeAreaView,
  StyleSheet,
  StatusBar as RNStatusBar,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { useRouter } from "expo-router";
import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
} from "firebase/firestore";

import { auth, db } from "../../firebase";
import ShipmentDetailHeader from "../../components/shipments/ShipmentDetailHeader";
import CustomerNotificationsList from "../../components/notifications/CustomerNotificationsList";

export default function CustomerNotificationsScreen() {
  const router = useRouter();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) {
      setLoading(false);
      return undefined;
    }

    const q = query(
      collection(db, "users", user.uid, "notifications"),
      orderBy("createdAt", "desc"),
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        setNotifications(
          snapshot.docs.map((docSnap) => ({
            id: docSnap.id,
            ...docSnap.data(),
          })),
        );
        setLoading(false);
      },
      (error) => {
        console.error("Notifications subscription error:", error);
        setLoading(false);
      },
    );

    return unsubscribe;
  }, []);

  const handlePressNotification = async (notification) => {
    const user = auth.currentUser;

    if (user && notification.read !== true) {
      updateDoc(doc(db, "users", user.uid, "notifications", notification.id), {
        read: true,
      }).catch((error) => {
        console.warn("Failed to mark notification as read:", error);
      });
    }

    const trackingId =
      notification.data?.trackingId ||
      notification.data?.shipmentId ||
      notification.entityId;

    if (notification.data?.screen === "tracking" && trackingId) {
      router.push({
        pathname: "/(customer)/tracking/",
        params: { trackingId },
      });
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" backgroundColor="#f1f5f9" />

      <ShipmentDetailHeader
        title="Notifications"
        subtitle="Shipment and delivery updates"
        onBack={() => router.back()}
      />

      <CustomerNotificationsList
        notifications={notifications}
        loading={loading}
        onPressNotification={handlePressNotification}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f1f5f9",
    paddingTop: Platform.OS === "android" ? RNStatusBar.currentHeight || 0 : 0,
  },
});
