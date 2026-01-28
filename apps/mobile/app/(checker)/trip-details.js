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
import {
  collection,
  onSnapshot,
  query,
  orderBy,
  doc,
} from "firebase/firestore";
import { db } from "../../firebase";

export default function TripDetailsScreen() {
  const { tripId, plate } = useLocalSearchParams();
  const router = useRouter();

  const [search, setSearch] = useState("");
  const [shipments, setShipments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false); // Separate loading state for actions
  const [trip, setTrip] = useState(null); // <--- ADD THIS

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

  useEffect(() => {
    if (!tripId) return;
    const tripRef = doc(db, "truck_trips", tripId);

    // Listen to the Trip Document
    const unsubscribe = onSnapshot(tripRef, (docSnap) => {
      if (docSnap.exists()) {
        setTrip({ id: docSnap.id, ...docSnap.data() });
      }
    });
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

  // 4. NEW: HANDLE FINISH LOADING
  const handleFinishLoading = () => {
    if (!trip) return;

    // Safety: Prevent empty trucks
    if ((trip.loadedCount || 0) === 0) {
      Alert.alert("Empty Truck", "You must scan at least one package.");
      return;
    }

    const total = trip.totalItems || 0;
    const loaded = trip.loadedCount || 0;

    const isFull = loaded >= total;
    const message = isFull
      ? "All items loaded. Release to driver?"
      : `Only ${loaded}/${total} items loaded. Release anyway?`;

    Alert.alert("Confirm Seal", message, [
      { text: "Cancel", style: "cancel" },
      {
        text: "SEAL TRUCK",
        onPress: async () => {
          setUpdating(true); // Reuse your existing loader state
          try {
            const functions = getFunctions(undefined, "asia-southeast1");
            const finishFn = httpsCallable(functions, "finishLoading");
            await finishFn({ tripId: tripId });

            Alert.alert("Success", "Truck marked as LOADED. Driver notified.");
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

      {/* 5. NEW: FOOTER BUTTON */}
      {/* Only show if trip exists and is NOT yet loaded/shipped */}
      {trip && (trip.status === "ASSIGNED" || trip.status === "LOADING") && (
        <View style={styles.footer}>
          <View style={styles.progressRow}>
            <Text style={styles.progressText}>
              {trip.loadedCount || 0} / {trip.totalItems || 0} Loaded
            </Text>
            {/* Visual Bar Background */}
            <View style={styles.progressBarBg}>
              {/* Visual Bar Fill */}
              <View
                style={[
                  styles.progressBarFill,
                  {
                    width: `${Math.min(((trip.loadedCount || 0) / (trip.totalItems || 1)) * 100, 100)}%`,
                  },
                ]}
              />
            </View>
          </View>

          <TouchableOpacity
            style={[
              styles.finishBtn,
              (trip.loadedCount || 0) > 0
                ? styles.btnActive
                : styles.btnDisabled,
            ]}
            onPress={handleFinishLoading}
            disabled={(trip.loadedCount || 0) === 0}
          >
            <Text style={styles.finishText}>FINISH & RELEASE</Text>
          </TouchableOpacity>
        </View>
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

  // FOOTER STYLES
  footer: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: "#334155",
    backgroundColor: "#1e293b", // Match card color
  },
  progressRow: {
    marginBottom: 15,
  },
  progressText: {
    color: "#94a3b8",
    marginBottom: 8,
    fontSize: 12,
    fontWeight: "bold",
    textAlign: "right",
  },
  progressBarBg: {
    height: 6,
    backgroundColor: "#334155",
    borderRadius: 3,
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    backgroundColor: "#10b981", // Green progress
  },
  finishBtn: {
    padding: 18,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  btnActive: {
    backgroundColor: "#3b82f6", // Bright Blue
  },
  btnDisabled: {
    backgroundColor: "#475569", // Slate 600
  },
  finishText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 16,
    letterSpacing: 1,
  },
});
