import React, { useState, useEffect } from "react";
import {
  View,
  StyleSheet,
  FlatList,
  Alert,
  ActivityIndicator,
  Text,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { getFunctions, httpsCallable } from "firebase/functions";
import {
  collection,
  onSnapshot,
  query,
  orderBy,
  doc,
} from "firebase/firestore";
import { db } from "../../firebase";
import GetLocation from "react-native-get-location";

// ✅ IMPORT NEW COMPONENTS
import TripDetailsHeader from "../../components/checker/trip-details/TripDetailsHeader";
import ShipmentControls from "../../components/checker/trip-details/ShipmentControls";
import ShipmentListItem from "../../components/checker/trip-details/ShipmentListItem";
import TripFooter from "../../components/checker/trip-details/TripFooter";
import { finishLoadingTruck } from "../../components/utilities/FirebaseFunctions";

export default function TripDetailsScreen() {
  const { tripId, plate } = useLocalSearchParams();
  const router = useRouter();

  const [search, setSearch] = useState("");
  const [shipments, setShipments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [trip, setTrip] = useState(null);

  const getCurrentLocationSafe = async () => {
    try {
      const loc = await GetLocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 15000,
      });

      if (!loc) return null;
      return {
        lat: loc.latitude,
        lng: loc.longitude,
      };
    } catch (error) {
      console.log("Location error (checker trip-details):", error);
      return null;
    }
  };

  // 1. FETCH SHIPMENTS
  useEffect(() => {
    if (!tripId) return;
    const shipmentsRef = collection(
      db,
      "truck_trips",
      tripId,
      "trip_shipments",
    );
    const q = query(shipmentsRef, orderBy("createdAt", "desc"));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedShipments = snapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          destination: data.route || "No Route Info",
          status: data.status || "ASSIGNED",
          packageCount: data.totalItems || 0,
          loadedCount: data.loadedCount || 0,
        };
      });
      setShipments(fetchedShipments);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [tripId]);

  // 2. FETCH TRIP DOC
  useEffect(() => {
    if (!tripId) return;
    const unsubscribe = onSnapshot(
      doc(db, "truck_trips", tripId),
      (docSnap) => {
        if (docSnap.exists()) {
          setTrip({ id: docSnap.id, ...docSnap.data() });
        }
      },
    );
    return () => unsubscribe();
  }, [tripId]);

  // 3. FILTER
  const filteredData = shipments.filter(
    (s) =>
      s.id.toLowerCase().includes(search.toLowerCase()) ||
      s.destination.toLowerCase().includes(search.toLowerCase()),
  );

  // 4. ACTIONS
  const updateStatus = async (ids, newStatus) => {
    if (ids.length === 0) return;
    setUpdating(true);
    try {
      const functions = getFunctions(undefined, "asia-southeast1");
      const bulkUpdateFn = httpsCallable(functions, "bulkUpdateShipmentStatus");

      const location = await getCurrentLocationSafe();
      await bulkUpdateFn({
        tripId: tripId,
        shipmentIds: ids,
        newStatus: newStatus,
        ...(location ? { location } : {}),
      });

      Alert.alert(
        "Success",
        `Updated ${ids.length} shipment(s) to ${newStatus}`,
      );
    } catch (error) {
      Alert.alert("Error", error.message);
    } finally {
      setUpdating(false);
    }
  };

  const handleSingleAction = (shipment) => {
    Alert.alert("Update Shipment", `Shipment: ${shipment.id}`, [
      {
        text: "Mark Out for Delivery",
        onPress: () => updateStatus([shipment.id], "OUT_FOR_DELIVERY"),
      },
      {
        text: "Mark Delivered",
        onPress: () => updateStatus([shipment.id], "DELIVERED"),
      },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  const handleBulkStatusChange = (newStatus) => {
    const ids = filteredData.map((s) => s.id);
    if (ids.length === 0) {
      Alert.alert("No Shipments", "No shipments found to update.");
      return;
    }
    Alert.alert(
      "Confirm Bulk Update",
      `Mark ${ids.length} shipments as ${newStatus}?`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Confirm", onPress: () => updateStatus(ids, newStatus) },
      ],
    );
  };

  const handleFinishLoading = () => {
    if (!trip) return;
    if ((trip.totalLoaded || 0) === 0) {
      Alert.alert("Empty Truck", "You must scan at least one package.");
      return;
    }

    const total = trip.totalItems || 0;
    const loaded = trip.totalLoaded || 0;
    const message =
      loaded >= total
        ? "All items loaded. Release?"
        : `Only ${loaded}/${total} loaded. Release anyway?`;

    Alert.alert("Confirm Seal", message, [
      { text: "Cancel", style: "cancel" },
      {
        text: "SEAL TRUCK",
        onPress: async () => {
          setUpdating(true);
          try {
            await finishLoadingTruck({ tripId: tripId });
            Alert.alert("Success", "Truck marked as LOADED.");
            router.back();
          } catch (err) {
            Alert.alert("Error", err.message);
          } finally {
            setUpdating(false);
          }
        },
      },
    ]);
  };

  const handleShipmentPress = (item) => {
    router.push({
      pathname: "/(checker)/shipment-details",
      params: {
        shipmentId: item.id,
        parentTripId: tripId,
        parentPlate: plate,
      },
    });
  };

  return (
    <View style={styles.container}>
      {/* 1. HEADER */}
      <TripDetailsHeader
        tripId={tripId}
        plate={plate}
        onBack={() => router.back()}
      />

      {/* 2. LOADING OVERLAY */}
      {updating && (
        <View style={styles.loaderOverlay}>
          <ActivityIndicator size="large" color="#3b82f6" />
          <Text style={styles.loaderText}>Updating...</Text>
        </View>
      )}

      {/* 3. CONTROLS */}
      <ShipmentControls
        search={search}
        onSearchChange={setSearch}
        onBulkOutForDelivery={() => handleBulkStatusChange("OUT_FOR_DELIVERY")}
        onBulkDelivered={() => handleBulkStatusChange("DELIVERED")}
      />

      {/* 4. LIST */}
      {loading ? (
        <View style={{ flex: 1, justifyContent: "center" }}>
          <ActivityIndicator size="large" color="#3b82f6" />
        </View>
      ) : (
        <FlatList
          data={filteredData}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingBottom: 100 }}
          renderItem={({ item }) => (
            <ShipmentListItem
              item={item}
              onPress={handleShipmentPress}
              onMenuPress={handleSingleAction}
            />
          )}
          ListEmptyComponent={
            <Text style={styles.emptyText}>No shipments assigned.</Text>
          }
        />
      )}

      {/* 5. FOOTER */}
      <TripFooter trip={trip} onFinish={handleFinishLoading} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0f172a" },
  loaderOverlay: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(15, 23, 42, 0.9)",
    zIndex: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  loaderText: { marginTop: 10, fontWeight: "bold", color: "#60a5fa" },
  emptyText: { textAlign: "center", color: "#64748b", marginTop: 40 },
});
