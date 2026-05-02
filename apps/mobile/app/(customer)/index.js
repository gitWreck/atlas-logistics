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

export default function CustomerDashboard() {
  const router = useRouter();
  const [shipments, setShipments] = useState([]);
  const [userData, setUserData] = useState(null);
  const [pickupModalVisible, setPickupModalVisible] = useState(false);
  const [requesting, setRequesting] = useState(false);

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

  // 2. Subscribe to Shipments
  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;

    if (auth.currentUser?.displayName) {
      setUserName(auth.currentUser.displayName);
    }

    const ref = collection(db, "shipments");
    const q = query(
      ref,
      where("visibilityUserIds", "array-contains", user.uid),
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const items = snapshot.docs
          .map((docSnap) => {
            const data = docSnap.data();
            const updatedAt =
              data.updatedAt?.toDate?.() || data.createdAt?.toDate?.() || null;

            return {
              id: docSnap.id,
              ...data,
              trackingNumber:
                data.trackingNumber || data.shipmentId || docSnap.id,
              rawUpdatedAt: data.updatedAt || data.createdAt || null,
              updatedAt: updatedAt
                ? updatedAt.toLocaleDateString()
                : "Recently updated",
              sortTime: updatedAt ? updatedAt.getTime() : 0,
            };
          })
          .sort((a, b) => b.sortTime - a.sortTime);

        setShipments(items);
      },
      (error) => console.error("Subscription error:", error),
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
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />

      <CustomerHeader
        userName={userName}
        // firstName={firstName}
        onLogout={handleLogout}
        onProfilePress={() => router.push("/(customer)/profile")}
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
