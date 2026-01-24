import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { FontAwesome5, Ionicons, MaterialIcons } from "@expo/vector-icons";
import { getFunctions, httpsCallable } from "firebase/functions";
// 1. IMPORT FIREBASE
import { collection, onSnapshot, query, orderBy } from "firebase/firestore";
import { db } from "../../firebase";

export default function TripDetailsScreen() {
  const { tripId, plate } = useLocalSearchParams();
  const router = useRouter();

  const [search, setSearch] = useState("");
  const [shipments, setShipments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false); // Separate loading state for actions

  // 2. FETCH REAL SHIPMENTS (Sub-collection Listener)
  useEffect(() => {
    if (!tripId) return;

    // Listen to: truck_trips/{tripId}/trip_shipments
    const shipmentsRef = collection(
      db,
      "truck_trips",
      tripId,
      "trip_shipments",
    );

    // Optional: Sort by last updated or created time
    const q = query(shipmentsRef, orderBy("createdAt", "desc"));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const fetchedShipments = snapshot.docs.map((doc) => {
          const data = doc.data();
          return {
            id: doc.id, // This matches the Shipment Doc ID
            destination: data.route || "No Route Info", // Using the 'route' field we saved earlier
            status: data.status || "ASSIGNED",
            packageCount: data.totalItems || 0,
            loadedCount: data.loadedCount || 0, // Useful to show progress per shipment
          };
        });
        setShipments(fetchedShipments);
        setLoading(false);
      },
      (error) => {
        console.error("Error fetching trip shipments:", error);
        setLoading(false);
      },
    );

    return () => unsubscribe();
  }, [tripId]);

  // Filter Logic (Search by ID or Route)
  const filteredData = shipments.filter(
    (s) =>
      s.id.toLowerCase().includes(search.toLowerCase()) ||
      s.destination.toLowerCase().includes(search.toLowerCase()),
  );

  // --- ACTIONS ---

  const updateStatus = async (ids, newStatus) => {
    if (ids.length === 0) return;
    setUpdating(true);

    try {
      const functions = getFunctions(undefined, "asia-southeast1");
      const bulkUpdateFn = httpsCallable(functions, "bulkUpdateShipmentStatus");

      await bulkUpdateFn({
        tripId: tripId,
        shipmentIds: ids,
        newStatus: newStatus,
      });

      // No need to manually update state; onSnapshot will handle it automatically!
      Alert.alert(
        "Success",
        `Updated ${ids.length} shipment(s) to ${newStatus}`,
      );
    } catch (error) {
      console.error(error);
      Alert.alert("Error", error.message);
    } finally {
      setUpdating(false);
    }
  };

  const handleSingleAction = (shipment) => {
    Alert.alert(
      "Update Shipment",
      `Shipment: ${shipment.id}\n${shipment.destination}`,
      [
        {
          text: "Mark Out for Delivery",
          onPress: () => updateStatus([shipment.id], "OUT_FOR_DELIVERY"),
        },
        {
          text: "Mark Delivered",
          onPress: () => updateStatus([shipment.id], "DELIVERED"),
        },
        { text: "Cancel", style: "cancel" },
      ],
    );
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

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.push("/(checker)/trips")}
          style={styles.backBtn}
        >
          <Ionicons name="arrow-back" size={24} color="#f8fafc" />
        </TouchableOpacity>
        <View>
          <Text style={styles.title}>{tripId}</Text>
          <Text style={styles.subtitle}>{plate}</Text>
        </View>
      </View>

      {/* Loading Overlay (For Updates) */}
      {updating && (
        <View style={styles.loaderOverlay}>
          <ActivityIndicator size="large" color="#3b82f6" />
          <Text style={styles.loaderText}>Updating...</Text>
        </View>
      )}

      {/* Controls */}
      <View style={styles.controls}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search shipment ID or route..."
          value={search}
          onChangeText={setSearch}
        />
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[styles.smallBtn, { backgroundColor: "#8b5cf6" }]}
            onPress={() => handleBulkStatusChange("OUT_FOR_DELIVERY")}
          >
            <Text style={styles.btnText}>Set All Out for Delivery</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.smallBtn, { backgroundColor: "#10b981" }]}
            onPress={() => handleBulkStatusChange("DELIVERED")}
          >
            <Text style={styles.btnText}>Set All Delivered</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* List */}
      {loading ? (
        <View style={{ flex: 1, justifyContent: "center" }}>
          <ActivityIndicator size="large" color="#3b82f6" />
        </View>
      ) : (
        <FlatList
          data={filteredData}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingBottom: 100 }}
          ListEmptyComponent={
            <Text style={styles.emptyText}>No shipments assigned.</Text>
          }
          renderItem={({ item }) => (
            <View style={styles.listItem}>
              {/* Main Click Area */}
              <TouchableOpacity
                style={styles.itemContent}
                onPress={() =>
                  router.push({
                    pathname: "/(checker)/shipment-details",
                    params: {
                      shipmentId: item.id,
                      parentTripId: tripId,
                      parentPlate: plate,
                    },
                  })
                }
              >
                <View style={styles.iconCircle}>
                  <FontAwesome5 name="box" size={16} color="#64748b" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemTitle}>{item.id}</Text>
                  <Text style={styles.itemSub}>{item.destination}</Text>

                  {/* Status Badge Text */}
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 6,
                      marginTop: 4,
                    }}
                  >
                    <Text
                      style={[
                        styles.statusText,
                        item.status === "DELIVERED" && { color: "#10b981" },
                        item.status === "OUT_FOR_DELIVERY" && {
                          color: "#8b5cf6",
                        },
                      ]}
                    >
                      {item.status.replace(/_/g, " ")}
                    </Text>
                    {/* Small progress indicator */}
                    <Text style={styles.countText}>
                      ({item.loadedCount}/{item.packageCount})
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>

              {/* 3-Dot Menu */}
              <TouchableOpacity
                style={styles.menuBtn}
                onPress={() => handleSingleAction(item)}
              >
                {/* <MaterialIcons name="more-vert" size={24} color="#94a3b8" /> */}
                <FontAwesome5 name="ellipsis-v" size={20} color="#94a3b8" />
              </TouchableOpacity>
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  // 1. MAIN BACKGROUND (Slate 900)
  container: { flex: 1, backgroundColor: "#0f172a" },

  header: {
    padding: 20,
    paddingTop: 50,
    flexDirection: "row",
    alignItems: "center",
    gap: 15,
  },
  backBtn: { padding: 8 },

  // 2. TEXT COLORS (White/Light Gray)
  title: { fontSize: 20, fontWeight: "800", color: "#f8fafc" },
  subtitle: { color: "#94a3b8" },

  // 3. LOADER (Dark Overlay)
  loaderOverlay: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(15, 23, 42, 0.9)", // Dark Fade
    zIndex: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  loaderText: { marginTop: 10, fontWeight: "bold", color: "#60a5fa" }, // Light Blue

  controls: { padding: 16, gap: 10 },

  // 4. INPUT FIELDS (Slate 800)
  searchInput: {
    backgroundColor: "#1e293b",
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#334155", // Subtle Border
    color: "#f8fafc", // Text Input Color
  },
  actionRow: { flexDirection: "row", gap: 10 },
  smallBtn: { flex: 1, padding: 10, borderRadius: 8, alignItems: "center" },
  btnText: { color: "#fff", fontWeight: "700", fontSize: 12 },

  emptyText: { textAlign: "center", color: "#64748b", marginTop: 40 },

  // 5. LIST ITEMS (Card Style)
  listItem: {
    flexDirection: "row",
    backgroundColor: "#1e293b", // Slate 800
    marginHorizontal: 16,
    marginBottom: 8, // Added spacing between items
    borderRadius: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#334155",
  },
  itemContent: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    gap: 12,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#334155", // Darker Circle
    alignItems: "center",
    justifyContent: "center",
  },
  itemTitle: { fontWeight: "700", color: "#f8fafc" }, // White Text
  itemSub: { color: "#94a3b8", fontSize: 12 },

  statusText: { fontSize: 10, fontWeight: "700", color: "#60a5fa" }, // Lighter Blue for contrast
  countText: { fontSize: 10, color: "#64748b" },

  menuBtn: {
    padding: 16,
    borderLeftWidth: 1,
    borderLeftColor: "#334155", // Dark Border
    height: "100%",
    justifyContent: "center",
  },
});
