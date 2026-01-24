import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ActivityIndicator } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { doc, getDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../../firebase";
import AtlasButton from "../../components/ui/AtlasButton";

export default function ScanResultScreen() {
  const { packageId } = useLocalSearchParams();
  const [pkg, setPkg] = useState(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    fetchPackage();
  }, []);

  const fetchPackage = async () => {
    const docRef = doc(db, "shipments", packageId);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      setPkg(snap.data());
    }
    setLoading(false);
  };

  const updateStatus = async (status) => {
    setLoading(true);
    const docRef = doc(db, "shipments", packageId);
    await updateDoc(docRef, {
      status: status,
      lastUpdate: serverTimestamp(),
    });
    alert(`Marked as ${status}`);
    router.back(); // Go back to scanner
  };

  if (loading)
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  if (!pkg)
    return (
      <View style={styles.center}>
        <Text>Package Not Found</Text>
      </View>
    );

  return (
    <View style={styles.container}>
      <Text style={styles.label}>TRACKING ID</Text>
      <Text style={styles.id}>{packageId}</Text>

      <View style={styles.card}>
        <Text style={styles.status}>Current Status: {pkg.status}</Text>
        <Text>Receiver: {pkg.receiverName}</Text>
        <Text>Address: {pkg.destination}</Text>
      </View>

      <Text style={styles.label}>MANUAL ACTIONS</Text>

      <AtlasButton
        title="MARK DELIVERED"
        style={{ backgroundColor: "#16a34a" }} // Green
        onPress={() => updateStatus("Delivered")}
      />

      <AtlasButton
        title="MARK OUT FOR DELIVERY"
        style={{ marginTop: 10 }}
        onPress={() => updateStatus("Out for Delivery")}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: "#f8fafc" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  label: { color: "#64748b", fontWeight: "bold", marginTop: 20 },
  id: { fontSize: 24, fontWeight: "bold", marginBottom: 20 },
  card: {
    backgroundColor: "white",
    padding: 20,
    borderRadius: 12,
    marginBottom: 20,
  },
  status: {
    fontSize: 18,
    color: "#2563eb",
    fontWeight: "bold",
    marginBottom: 10,
  },
});
