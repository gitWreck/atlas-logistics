import React, { useEffect, useState } from "react";
import {
  SafeAreaView,
  View,
  Alert,
  StyleSheet,
  Platform,
  StatusBar as RNStatusBar,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { useRouter } from "expo-router";
import { signOut } from "firebase/auth";
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  where,
} from "firebase/firestore";

// Firebase & Utils
import { auth, db } from "../../firebase";

// Imported Components
import CustomerHeader from "../../components/customer/CustomerHeader";
import TrackedShipmentList from "../../components/customer/TrackedShipmentList";
import FloatingAddButton from "../../components/customer/FloatingAddButton";
import RequestPickupModal from "../../components/customer/RequestPickup/RequestPickupModal";
import { requestShipmentPickup } from "../../components/utilities/FirebaseFunctions";
import {
  customerOwnsShipment,
  mapShipmentDoc,
  sortShipments,
} from "../../components/utilities/customerShipmentAccess";
import { useAuth } from "../../contexts/AuthContext";
import { useTheme } from "../../contexts/ThemeContext";

export default function CustomerDashboard() {
  const router = useRouter();
  const { profile } = useAuth();
  const { colors, resolvedScheme } = useTheme();
  const [shipments, setShipments] = useState([]);
  const [userData, setUserData] = useState(null);
  const [pickupModalVisible, setPickupModalVisible] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [unreadMessages, setUnreadMessages] = useState(0);

  const [userName, setUserName] = useState("Customer");

  // 1. Fetch User Data
  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;

    getDoc(doc(db, "users", user.uid))
      .then((snap) => {
        if (snap.exists()) {
          const data = snap.data();
          const name = (data.name || "").trim();
          setUserData({ id: snap.id, ...data });
          setUserName(name || auth.currentUser?.displayName || "Customer");
        }
      })
      .catch(() => {});
  }, []);

  // 2. Subscribe to shipments owned by this customer only
  useEffect(() => {
    const user = auth.currentUser;
    if (!user || !profile?.uid) return;

    const customer = {
      uid: user.uid,
      email: user.email || profile.email,
      phoneNumber: profile.phoneNumber,
      phone: profile.phone,
      publicId: profile.publicId,
      userCode: profile.userCode,
      customerCode: profile.customerCode,
    };

    const shipmentQueries = [
      query(collection(db, "shipments"), where("sender.uid", "==", user.uid)),
      query(
        collection(db, "shipments"),
        where("recipient.uid", "==", user.uid),
      ),
      query(collection(db, "shipments"), where("customerId", "==", user.uid)),
      query(
        collection(db, "shipments"),
        where("visibilityUserIds", "array-contains", user.uid),
      ),
    ];

    const snapshotsByQuery = {};

    const mergeAndSetShipments = () => {
      const shipmentMap = new Map();

      Object.values(snapshotsByQuery).forEach((snapshot) => {
        snapshot.docs.forEach((docSnap) => {
          const item = mapShipmentDoc(docSnap);
          if (customerOwnsShipment(item, customer)) {
            shipmentMap.set(docSnap.id, item);
          }
        });
      });

      setShipments(sortShipments([...shipmentMap.values()]));
    };

    const unsubscribers = shipmentQueries.map((q, index) =>
      onSnapshot(
        q,
        (snapshot) => {
          snapshotsByQuery[index] = snapshot;
          mergeAndSetShipments();
        },
        (error) => console.error("Shipment subscription error:", error),
      ),
    );

    return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
  }, [profile?.uid, profile?.phoneNumber, profile?.email]);

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return undefined;

    const q = query(
      collection(db, "users", user.uid, "notifications"),
      where("read", "==", false),
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => setUnreadNotifications(snapshot.size),
      (error) =>
        console.error("Unread notifications subscription error:", error),
    );

    return unsubscribe;
  }, []);

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return undefined;

    const q = query(
      collection(db, "conversations"),
      where("customerId", "==", user.uid),
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const total = snapshot.docs.reduce((sum, docSnap) => {
          const data = docSnap.data() || {};
          return sum + Number(data.unreadCounts?.[user.uid] || 0);
        }, 0);
        setUnreadMessages(total);
      },
      (error) => console.error("Unread messages subscription error:", error),
    );

    return unsubscribe;
  }, []);

  // 3. Actions
  const handleLogout = () => {
    Alert.alert("Sign Out", "Are you sure?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign Out",
        style: "destructive",
        onPress: () => {
          signOut(auth);
          router.replace("/(auth)/login");
        },
      },
    ]);
  };

  const handleShipmentPress = (item) => {
    router.push({
      pathname: "/(customer)/tracking/",
      params: { trackingId: item.trackingNumber || item.id },
    });
  };

  const handleRequestPickup = async (pickupData) => {
    try {
      setRequesting(true);
      await requestShipmentPickup(pickupData);
      setPickupModalVisible(false);
      Alert.alert("Success", "Pickup request submitted successfully!");
    } catch (error) {
      Alert.alert("Error", "Failed to submit request. Please try again.");
    } finally {
      setRequesting(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}>
      <StatusBar style={resolvedScheme === "dark" ? "light" : "dark"} />

      <CustomerHeader
        userName={userName}
        // firstName={firstName}
        onLogout={handleLogout}
        onProfilePress={() => router.push("/(customer)/profile")}
        onNotificationsPress={() => router.push("/(customer)/notifications")}
        onMessagesPress={() => router.push("/(customer)/chat")}
        unreadCount={unreadNotifications}
        unreadMessages={unreadMessages}
      />

      <View style={styles.body}>
        <TrackedShipmentList
          shipments={shipments}
          onShipmentPress={handleShipmentPress}
        />
      </View>

      <FloatingAddButton onPress={() => setPickupModalVisible(true)} />

      <RequestPickupModal
        visible={pickupModalVisible}
        onClose={() => setPickupModalVisible(false)}
        onSubmit={handleRequestPickup}
        isSubmitting={requesting}
        userData={userData}
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
  body: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
});
