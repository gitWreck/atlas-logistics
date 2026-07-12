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
import { addTrackedShipment } from "../../components/utilities/FirebaseFunctions";

// Imported Components
import CustomerHeader from "./CustomerHeader";
import TrackedShipmentList from "./TrackedShipmentList";
import AddTrackingModal from "./AddTrackingModal";
import FloatingAddButton from "./FloatingAddButton";
import { useTheme } from "../../contexts/ThemeContext";

export default function CustomerDashboard() {
  const router = useRouter();
  const { colors, resolvedScheme } = useTheme();
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [trackedShipments, setTrackedShipments] = useState([]);
  const [adding, setAdding] = useState(false);
  const [firstName, setFirstName] = useState("");

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

    const ref = collection(db, "users", user.uid, "trackedShipments");
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

  const handleAddTracking = async (trackingNumber) => {
    const normalizedTracking = trackingNumber.trim().toUpperCase();
    if (!normalizedTracking) return;

    try {
      setAdding(true);
      await addTrackedShipment({ trackingNumber: normalizedTracking });
      setAddModalVisible(false);
    } catch (error) {
      console.error("Failed to add tracked shipment:", error);
      const code = error?.code || "";

      if (code.endsWith("already-exists")) {
        Alert.alert(
          "Already added",
          "This shipment is already in your tracked list.",
        );
      } else if (code.endsWith("not-found")) {
        Alert.alert(
          "Shipment not found",
          "We couldn't find a shipment with that tracking number.",
        );
      } else if (code.endsWith("permission-denied")) {
        Alert.alert(
          "Not authorized",
          "Details do not match sender or receiver.",
        );
      } else {
        Alert.alert("Something went wrong", "Please try again later.");
      }
    } finally {
      setAdding(false);
    }
  };

  const handleShipmentPress = (item) => {
    router.push({
      pathname: "/(customer)/tracking/",
      params: {
        trackingId: item.trackingNumber || item.id,
      },
    });
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}>
      <StatusBar style={resolvedScheme === "dark" ? "light" : "dark"} />

      <CustomerHeader
        userName={firstName || "Customer"}
        onLogout={handleLogout}
        onProfilePress={() => router.push("/(customer)/profile")}
        onNotificationsPress={() => router.push("/(customer)/notifications")}
      />

      <View style={styles.body}>
        <TrackedShipmentList
          shipments={trackedShipments}
          onShipmentPress={handleShipmentPress}
        />
      </View>

      <FloatingAddButton onPress={() => setAddModalVisible(true)} />

      <AddTrackingModal
        visible={addModalVisible}
        onClose={() => setAddModalVisible(false)}
        onAdd={handleAddTracking}
        isAdding={adding}
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
