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
import { Ionicons, FontAwesome5 } from "@expo/vector-icons";
import { getFunctions, httpsCallable } from "firebase/functions";
// 1. IMPORT FIREBASE
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../../firebase";
import StatusBadge from "../../components/ui/StatusBadge";

export default function ShipmentDetailsScreen() {
  // Get params passed from previous screen
  const { shipmentId, parentTripId, parentPlate } = useLocalSearchParams();
  const router = useRouter();

  const [search, setSearch] = useState("");
  const [packages, setPackages] = useState([]); // Real data
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false); // For button presses

  // 2. FETCH REAL PACKAGES (Document Listener)
  useEffect(() => {
    if (!shipmentId) return;

    // Listen to the specific Shipment Document
    const shipmentRef = doc(db, "shipments", shipmentId);

    const unsubscribe = onSnapshot(
      shipmentRef,
      (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          // Packages are an array inside the document
          const pkgList = data.packages || [];
          setPackages(pkgList);
        } else {
          Alert.alert("Error", "Shipment not found!");
          router.back();
        }
        setLoading(false);
      },
      (error) => {
        console.error("Error fetching shipment:", error);
        setLoading(false);
      },
    );

    return () => unsubscribe();
  }, [shipmentId]);

  // Filter Logic
  const filtered = packages.filter((p) =>
    (p.trackingNumber || "").toLowerCase().includes(search.toLowerCase()),
  );

  // --- ACTIONS ---

  const updateStatus = async (pkg, newMode) => {
    setActionLoading(true);
    try {
      const functions = getFunctions(undefined, "asia-southeast1");
      const scanPackages = httpsCallable(functions, "scanPackages");

      // Reuse the existing Scan function
      const result = await scanPackages({
        barcode: pkg.trackingNumber,
        mode: newMode, // "out_for_delivery" or "delivered"
      });

      // NOTE: We do NOT need to manually update state here.
      // The 'onSnapshot' listener above will see the change in DB
      // and update the UI automatically.

      Alert.alert("Success", result.data.message);
    } catch (error) {
      console.error(error);
      Alert.alert("Error", error.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handlePackagePress = (pkg) => {
    Alert.alert(
      "Update Package",
      `ID: ${pkg.trackingNumber}\nStatus: ${pkg.status}`,
      [
        {
          text: "Mark Out for Delivery",
          onPress: () => updateStatus(pkg, "out_for_delivery"),
        },
        {
          text: "Mark Delivered",
          onPress: () => updateStatus(pkg, "delivered"),
        },
        { text: "Cancel", style: "cancel" },
      ],
    );
  };

  // Safe Back Navigation
  const handleBack = () => {
    if (parentTripId) {
      router.push({
        pathname: "/(checker)/trip-details",
        params: { tripId: parentTripId, plate: parentPlate },
      });
    } else {
      router.back();
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#f8fafc" />
        </TouchableOpacity>
        <View>
          <Text style={styles.title}>Shipment Contents</Text>
          <Text style={styles.subtitle}>ID: {shipmentId}</Text>
        </View>
      </View>

      {/* Loading Overlay (For Actions) */}
      {actionLoading && (
        <View style={styles.loaderOverlay}>
          <ActivityIndicator size="large" color="#3b82f6" />
        </View>
      )}

      {/* Search */}
      <View style={styles.controls}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search Tracking Number..."
          value={search}
          onChangeText={setSearch}
        />
      </View>

      {/* Main Content */}
      {loading ? (
        <View style={{ flex: 1, justifyContent: "center" }}>
          <ActivityIndicator size="large" color="#3b82f6" />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.trackingNumber} // Use unique tracking number
          contentContainerStyle={{ paddingBottom: 100 }}
          ListEmptyComponent={
            <Text style={styles.emptyText}>No packages in this shipment.</Text>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[
                styles.listItem,
                item.status === "DELIVERED" && { borderColor: "#bbf7d0" }, // Green border if done
              ]}
              onPress={() => handlePackagePress(item)}
            >
              {/* Icon */}
              <View
                style={[
                  styles.iconCircle,
                  item.status === "DELIVERED" && { backgroundColor: "#dcfce7" },
                ]}
              >
                <FontAwesome5
                  name={item.status === "DELIVERED" ? "check" : "box-open"}
                  size={16}
                  color={item.status === "DELIVERED" ? "#166534" : "#64748b"}
                />
              </View>

              {/* Text Info */}
              <View style={{ flex: 1 }}>
                <Text style={styles.itemTitle}>{item.trackingNumber}</Text>
                <Text style={styles.itemSub}>Tap to update</Text>
              </View>

              {/* Status Badge */}
              <StatusBadge status={item.status} />
            </TouchableOpacity>
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
    backgroundColor: "#0f172a", // Matches container
    flexDirection: "row",
    alignItems: "center",
    gap: 15,
    borderBottomWidth: 1,
    borderColor: "#334155", // Dark Border
  },
  backBtn: { padding: 8 },

  // 2. TEXT COLORS
  title: { fontSize: 18, fontWeight: "800", color: "#f8fafc" }, // White
  subtitle: { color: "#94a3b8", fontSize: 12 }, // Light Gray

  // 3. LOADER OVERLAY (Dark Fade)
  loaderOverlay: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(15, 23, 42, 0.9)", // Dark fade
    zIndex: 20,
    justifyContent: "center",
    alignItems: "center",
  },

  controls: { padding: 16 },

  // 4. SEARCH INPUT (Slate 800)
  searchInput: {
    backgroundColor: "#1e293b",
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#334155", // Subtle dark border
    color: "#f8fafc", // Text color inside input
  },

  emptyText: { textAlign: "center", color: "#64748b", marginTop: 40 },

  // 5. LIST ITEM CARDS (Slate 800)
  listItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 16,
    backgroundColor: "#1e293b", // Dark Card
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 12,
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderColor: "#334155", // Dark Border
  },

  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#334155", // Dark Circle
    alignItems: "center",
    justifyContent: "center",
  },

  itemTitle: { fontWeight: "700", color: "#f8fafc" }, // White Title
  itemSub: { color: "#94a3b8", fontSize: 10 }, // Gray Subtitle

  // 6. STATUS BADGE
  statusBadge: {
    backgroundColor: "#334155", // Dark background for badge
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#475569",
  },
  statusText: { fontSize: 10, fontWeight: "700", color: "#cbd5e1" }, // Light text
});
