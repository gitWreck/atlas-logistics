import React, { useEffect, useState } from "react";
import {
  Platform,
  Alert,
  SafeAreaView,
  StyleSheet,
  StatusBar as RNStatusBar,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { useRouter } from "expo-router";
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
} from "firebase/firestore";

import { auth, db } from "../../firebase";
import ShipmentDetailHeader from "../../components/shipments/ShipmentDetailHeader";
import CustomerNotificationsList from "../../components/notifications/CustomerNotificationsList";
import { customerOwnsShipment } from "../../components/utilities/customerShipmentAccess";
import { useAuth } from "../../contexts/AuthContext";
import { useTheme } from "../../contexts/ThemeContext";

export default function CustomerNotificationsScreen() {
  const router = useRouter();
  const { profile } = useAuth();
  const { colors, resolvedScheme } = useTheme();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  const customer = {
    uid: auth.currentUser?.uid,
    email: auth.currentUser?.email || profile?.email,
    phoneNumber: profile?.phoneNumber,
    phone: profile?.phone,
    publicId: profile?.publicId,
    userCode: profile?.userCode,
    customerCode: profile?.customerCode,
  };

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
          snapshot.docs
            .map((docSnap) => ({
              id: docSnap.id,
              ...docSnap.data(),
            }))
            .filter((notification) => {
              const ownerId = notification.ownerId || user.uid;
              return ownerId === user.uid;
            }),
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
      try {
        const snap = await getDoc(
          doc(db, "shipments", String(trackingId).trim().toUpperCase()),
        );

        if (!snap.exists()) {
          Alert.alert("Unavailable", "This shipment could not be found.");
          return;
        }

        const shipmentData = { id: snap.id, ...snap.data() };
        if (!customerOwnsShipment(shipmentData, { uid: user.uid, ...customer })) {
          Alert.alert(
            "Access denied",
            "This notification is not linked to your account.",
          );
          return;
        }
      } catch (error) {
        console.error("Notification shipment ownership check failed:", error);
        Alert.alert("Unable to open", "Please try again in a moment.");
        return;
      }

      router.push({
        pathname: "/(customer)/tracking/",
        params: { trackingId },
      });
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}>
      <StatusBar
        style={resolvedScheme === "dark" ? "light" : "dark"}
        backgroundColor={colors.bg}
      />

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
