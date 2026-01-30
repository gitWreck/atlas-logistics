import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { FontAwesome5 } from "@expo/vector-icons";
import { doc, getDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../../firebase";
import { COLORS, GLOBAL_STYLES } from "../../components/constants/theme";

// ✅ IMPORT YOUR NEW COMPONENTS
import ShipmentHeaderCard from "../../components/driver/shipment/ShipmentHeaderCard";
import PackageItemCard from "../../components/driver/shipment/PackageItemCard";
import DeliveryActionButton from "../../components/driver/shipment/DeliveryActionButton";

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
      <View style={GLOBAL_STYLES.center}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  const packages = shipment?.packages || []; // Assume packages array exists in doc

  return (
    <SafeAreaView style={GLOBAL_STYLES.container}>
      {/* Header Bar */}
      <View style={styles.navBar}>
        <FontAwesome5
          name="arrow-left"
          size={20}
          color="#fff"
          onPress={() => router.back()}
        />
        <Text style={styles.navTitle}>Shipment Details</Text>
        <View style={{ width: 20 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* 1. Main Info Card */}
        <ShipmentHeaderCard shipment={shipment} />

        {/* 2. Package List */}
        <Text style={GLOBAL_STYLES.sectionTitle}>
          Packages ({packages.length})
        </Text>

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
        <DeliveryActionButton
          status={shipment.status}
          onPress={handleAction}
          loading={actionLoading}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  navBar: {
    padding: 20,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  navTitle: { color: "#fff", fontSize: 18, fontWeight: "bold" },
  content: { paddingHorizontal: 20, paddingBottom: 100 },
  emptyText: { color: "#64748b", fontStyle: "italic", marginTop: 10 },

  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
    backgroundColor: COLORS.background,
    borderTopWidth: 1,
    borderTopColor: "#334155",
  },
});
