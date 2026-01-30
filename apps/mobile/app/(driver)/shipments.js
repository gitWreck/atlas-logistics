import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { FontAwesome5 } from "@expo/vector-icons";
import { collection, query, onSnapshot, orderBy } from "firebase/firestore";
import { db } from "../../firebase";
import { COLORS, GLOBAL_STYLES } from "../../components/constants/theme";

// Import your new component
import ShipmentCard from "../../components/driver/shipment/ShipmentCard";

export default function ShipmentsListScreen() {
  const { tripId } = useLocalSearchParams();
  const router = useRouter();

  const [shipments, setShipments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState("");

  useEffect(() => {
    if (!tripId) return;

    // Listen to sub-collection: truck_trips/{id}/trip_shipments
    const q = query(
      collection(db, "truck_trips", tripId, "trip_shipments"),
      orderBy("status", "asc"), // Shows "ASSIGNED"/"LOADED" before "DELIVERED"
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setShipments(list);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [tripId]);

  // Search Logic
  const filteredData = shipments.filter((item) => {
    const term = searchText.toLowerCase();
    return (
      item.id.toLowerCase().includes(term) ||
      (item.destinationAddress || "").toLowerCase().includes(term) ||
      (item.receiverName || "").toLowerCase().includes(term)
    );
  });

  const handlePressShipment = (shipment) => {
    // Go to Detail/Action Page
    // You can reuse a general "Shipment Details" page or a specific "Scan" page
    router.push({
      pathname: "/(driver)/shipment-details",
      params: {
        mode: "delivered", // Default action is to deliver
        shipmentId: shipment.id,
        tripId: tripId,
      },
    });
  };

  return (
    <SafeAreaView style={GLOBAL_STYLES.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <FontAwesome5 name="arrow-left" size={20} color="#fff" />
        </TouchableOpacity>
        <View>
          <Text style={styles.title}>Shipments</Text>
          <Text style={styles.subtitle}>{shipments.length} Stops</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <FontAwesome5 name="search" size={16} color="#94a3b8" />
        <TextInput
          style={styles.searchInput}
          placeholder="Search address, ID, or name..."
          placeholderTextColor="#64748b"
          value={searchText}
          onChangeText={setSearchText}
        />
      </View>

      {/* List */}
      {loading ? (
        <View style={GLOBAL_STYLES.center}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : (
        <FlatList
          data={filteredData}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <ShipmentCard shipment={item} onPress={handlePressShipment} />
          )}
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <FontAwesome5 name="box-open" size={40} color="#334155" />
              <Text style={styles.emptyText}>No shipments found.</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    padding: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  backBtn: { padding: 8 },
  title: { color: "#fff", fontSize: 20, fontWeight: "bold" },
  subtitle: { color: "#94a3b8", fontSize: 12 },

  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1e293b",
    marginHorizontal: 20,
    paddingHorizontal: 16,
    borderRadius: 12,
    height: 50,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#334155",
  },
  searchInput: {
    flex: 1,
    color: "#fff",
    marginLeft: 12,
    fontSize: 16,
  },

  listContent: { paddingHorizontal: 20, paddingBottom: 40 },

  emptyBox: { alignItems: "center", marginTop: 60, gap: 12 },
  emptyText: { color: "#64748b", fontSize: 14 },
});
