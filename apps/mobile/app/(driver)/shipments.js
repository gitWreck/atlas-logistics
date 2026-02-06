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
import { StatusBar } from "expo-status-bar";
import { collection, query, onSnapshot, orderBy } from "firebase/firestore";
import { db } from "../../firebase";
import { COLORS } from "../../components/constants/theme";
import { Image } from "expo-image";
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
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      {/* Header: back | title | count (right) */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Image
            source={require("../../assets/icons/back.svg")}
            style={{ width: 20, height: 20 }}
          />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Shipments</Text>
        <Text style={styles.headerCount}>{shipments.length} Items</Text>
      </View>

      {/* Search Bar - light mode */}
      <View style={styles.searchContainer}>
        <FontAwesome5 name="search" size={16} color="#94a3b8" />
        <TextInput
          style={styles.searchInput}
          placeholder="Search address, ID, or name..."
          placeholderTextColor="#94a3b8"
          value={searchText}
          onChangeText={setSearchText}
        />
      </View>

      {/* List */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#042C83" />
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
              <FontAwesome5 name="box-open" size={40} color="#94a3b8" />
              <Text style={styles.emptyText}>No shipments found.</Text>
            </View>
          }
        />
      )}
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
    backgroundColor: "#f1f5f9",
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
  headerCount: {
    color: "#0f172a",
    fontSize: 14,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff",
    marginHorizontal: 20,
    marginTop: 16,
    paddingHorizontal: 16,
    borderRadius: 12,
    height: 50,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  searchInput: {
    flex: 1,
    color: "#0f172a",
    marginLeft: 12,
    fontSize: 16,
  },
  listContent: { paddingHorizontal: 20, paddingBottom: 40 },
  emptyBox: { alignItems: "center", marginTop: 60, gap: 12 },
  emptyText: { color: "#64748b", fontSize: 14 },
});
