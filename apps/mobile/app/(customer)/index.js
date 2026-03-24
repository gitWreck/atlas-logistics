import React, { useEffect, useState } from "react";
import { SafeAreaView, View, Alert, StyleSheet } from "react-native";
import { StatusBar } from "expo-status-bar";
import { useRouter } from "expo-router";
import { signOut } from "firebase/auth";
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
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
  const [trackedShipments, setTrackedShipments] = useState([]);
  const [firstName, setFirstName] = useState("");
  const [pickupModalVisible, setPickupModalVisible] = useState(false);
  const [requesting, setRequesting] = useState(false);

  // 1. Fetch User Data
  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;

    getDoc(doc(db, "users", user.uid))
      .then((snap) => {
        if (snap.exists()) {
          const name = (snap.data().name || "").trim();
          setFirstName(name.split(/\s+/)[0] || "");
        }
      })
      .catch(() => {});
  }, []);

  // 2. Subscribe to Shipments
  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;

    const ref = collection(db, "users", user.uid, "tracked_shipments");
    const q = query(ref, orderBy("createdAt", "desc"));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const items = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data(),
        }));
        setTrackedShipments(items);
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
      // We will define this Firebase function later
      // await createPickupRequest(pickupData);
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

      <CustomerHeader firstName={firstName} onLogout={handleLogout} />

      <View style={styles.body}>
        <TrackedShipmentList
          shipments={trackedShipments}
          onShipmentPress={handleShipmentPress}
        />
      </View>

      {/* <FloatingAddButton onPress={() => setAddModalVisible(true)} /> */}
      <FloatingAddButton onPress={() => setPickupModalVisible(true)} />

      <RequestPickupModal
        visible={pickupModalVisible}
        onClose={() => setPickupModalVisible(false)}
        onSubmit={handleRequestPickup}
        isSubmitting={requesting}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f1f5f9",
  },
  body: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
});
