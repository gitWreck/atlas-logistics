import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  ActivityIndicator,
  Alert,
  TouchableOpacity,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { doc, getDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../../firebase";
import { StatusBar } from "expo-status-bar";
import { Image } from "expo-image";

// ✅ IMPORT YOUR NEW COMPONENTS
import ShipmentHeaderCard from "../../components/driver/shipment/ShipmentHeaderCard";
import PackageItemCard from "../../components/driver/shipment/PackageItemCard";
import GradientButton from "../../components/ui/figma/GradientButton";

export default function ShipmentDetailsScreen() {
  const { shipmentId, tripId } = useLocalSearchParams();
  const router = useRouter();

  const [shipment, setShipment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // 1. Fetch Full Shipment Details (including package list)
  useEffect(() => {
    if (!shipmentId) return;
    const fetchDetails = async () => {
      try {
        const docRef = doc(db, "shipments", shipmentId);
        const snap = await getDoc(docRef);

        if (snap.exists()) {
          setShipment({ id: snap.id, ...snap.data() });
        } else {
          Alert.alert("Error", "Shipment data not found");
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchDetails();
  }, [shipmentId]);

  // 2. Handle The Button Press
  const handleAction = async () => {
    if (!shipment) return;

    // CASE A: Mark Out For Delivery
    if (shipment.status === "LOADED" || shipment.status === "ASSIGNED") {
      setActionLoading(true);
      try {
        // Update Shipment
        await updateDoc(doc(db, "shipments", shipmentId), {
          status: "OUT_FOR_DELIVERY",
          updatedAt: serverTimestamp(),
        });

        // Update Trip Link (Optional, depending on your schema)
        if (tripId) {
          await updateDoc(
            doc(db, "truck_trips", tripId, "trip_shipments", shipmentId),
            {
              status: "OUT_FOR_DELIVERY",
            },
          );
        }

        Alert.alert("Success", "Shipment marked OUT FOR DELIVERY");
        // Optimistic Update
        setShipment((prev) => ({ ...prev, status: "OUT_FOR_DELIVERY" }));
      } catch (error) {
        Alert.alert("Error", error.message);
      } finally {
        setActionLoading(false);
      }
    }
    // CASE B: Complete Delivery
    else if (shipment.status === "OUT_FOR_DELIVERY") {
      // Go to proof of delivery / scan page
      router.push({
        pathname: "/(driver)/scan",
        params: {
          mode: "delivered",
          shipmentId: shipmentId,
          tripId: tripId,
        },
      });
    }
  };

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: "#f1f5f9" }]}>
        <ActivityIndicator size="large" color="#042C83" />
      </View>
    );
  }

  const packages = shipment?.packages || []; // Assume packages array exists in doc

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      {/* Header: back | title - aligned with Trip Details */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Image
            source={require("../../assets/icons/back.svg")}
            style={{ width: 20, height: 20 }}
          />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Shipment Details</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* 1. Main Info Card */}
        <ShipmentHeaderCard shipment={shipment} />

        {/* 2. Package List */}
        <Text style={styles.sectionTitle}>Packages ({packages.length})</Text>

        {packages.length > 0 ? (
          packages.map((pkg, i) => (
            <PackageItemCard key={i} pkg={pkg} index={i} />
          ))
        ) : (
          <Text style={styles.emptyText}>No package details available.</Text>
        )}
      </ScrollView>

      {/* 3. Bottom Action Button */}
      <View style={styles.footer}>
        <GradientButton
          title={
            shipment.status === "OUT_FOR_DELIVERY"
              ? "Complete Delivery"
              : "Mark Out for Delivery"
          }
          onPress={handleAction}
          loading={actionLoading}
          disabled={actionLoading}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f1f5f9",
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 15,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  backBtn: {
    padding: 0,
  },
  headerTitle: {
    color: "#0f172a",
    fontSize: 16,
    fontWeight: "bold",
    flex: 1,
    marginLeft: 12,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 120,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#0f172a",
    marginTop: 24,
    marginBottom: 8,
  },
  emptyText: { color: "#64748b", fontStyle: "italic", marginTop: 10 },

  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 34,
    backgroundColor: "#ffffff",
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
  },
});
