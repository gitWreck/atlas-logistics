import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { FontAwesome5 } from "@expo/vector-icons";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { format, startOfDay, subDays } from "date-fns";
import { db } from "../../firebase";
import { useAuth } from "../../contexts/AuthContext";
import { useTheme } from "../../contexts/ThemeContext";
import { useCheckerLastMile } from "../../contexts/CheckerLastMileContext";
import {
  DeliveredHistoryList,
} from "../../components/checker/CheckerHomeDashboard";
import {
  getDeliveredShipments,
  getDeliveryAddress,
  getReceiverName,
  getShipmentNumber,
} from "../../components/checker/dashboardData";

const PAGE_SIZE = 20;
const DATE_FILTERS = [
  { key: "ALL", label: "All" },
  { key: "TODAY", label: "Today" },
  { key: "7D", label: "7 Days" },
];

function mergeShipmentLists(...lists) {
  const map = new Map();
  lists.flat().forEach((shipment) => {
    if (shipment?.id) map.set(shipment.id, shipment);
  });
  return [...map.values()];
}

export default function DeliveredHistoryPage() {
  const router = useRouter();
  const { colors } = useTheme();
  const { profile, user } = useAuth();
  const { shipmentsById = {} } = useCheckerLastMile();
  const checkerId = profile?.uid || user?.uid;

  const [remoteShipments, setRemoteShipments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [dateFilter, setDateFilter] = useState("ALL");
  const [sortOrder, setSortOrder] = useState("NEWEST");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  useEffect(() => {
    if (!checkerId) {
      setRemoteShipments([]);
      setLoading(false);
      return undefined;
    }

    setLoading(true);
    let assigned = [];
    let active = [];

    const publish = () => {
      setRemoteShipments(mergeShipmentLists(assigned, active));
      setLoading(false);
    };

    const shipmentsRef = collection(db, "shipments");
    const assignedQuery = query(
      shipmentsRef,
      where("assignedCheckerId", "==", String(checkerId)),
    );
    const activeQuery = query(
      shipmentsRef,
      where("activeCheckerIds", "array-contains", String(checkerId)),
    );

    const unsubAssigned = onSnapshot(
      assignedQuery,
      (snap) => {
        assigned = snap.docs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data(),
        }));
        publish();
      },
      (err) => {
        console.warn("Delivered history assigned listener failed:", err);
        setLoading(false);
      },
    );

    const unsubActive = onSnapshot(
      activeQuery,
      (snap) => {
        active = snap.docs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data(),
        }));
        publish();
      },
      (err) => {
        console.warn("Delivered history active listener failed:", err);
        setLoading(false);
      },
    );

    return () => {
      unsubAssigned();
      unsubActive();
    };
  }, [checkerId]);

  const deliveredShipments = useMemo(() => {
    const allKnown = mergeShipmentLists(
      Object.values(shipmentsById || {}),
      remoteShipments,
    );
    return getDeliveredShipments(allKnown, checkerId);
  }, [shipmentsById, remoteShipments, checkerId]);

  const filteredShipments = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const todayStart = startOfDay(new Date()).getTime();
    const weekStart = subDays(startOfDay(new Date()), 7).getTime();

    const filtered = deliveredShipments.filter((shipment) => {
      const deliveredMs = shipment.deliveredAtDate?.getTime?.() || 0;
      if (dateFilter === "TODAY" && deliveredMs < todayStart) return false;
      if (dateFilter === "7D" && deliveredMs < weekStart) return false;

      if (!needle) return true;
      const text = [
        getShipmentNumber(shipment),
        getReceiverName(shipment),
        getDeliveryAddress(shipment),
      ]
        .join(" ")
        .toLowerCase();
      return text.includes(needle);
    });

    return filtered.sort((a, b) => {
      const aMs = a.deliveredAtDate?.getTime?.() || 0;
      const bMs = b.deliveredAtDate?.getTime?.() || 0;
      return sortOrder === "NEWEST" ? bMs - aMs : aMs - bMs;
    });
  }, [deliveredShipments, search, dateFilter, sortOrder]);

  const visibleShipments = filteredShipments.slice(0, visibleCount);

  const openShipment = (shipment) =>
    router.push({
      pathname: "/(checker)/shipment-details",
      params: { shipmentId: shipment.id },
    });

  const renderShipment = ({ item }) => (
    <TouchableOpacity
      style={styles.listRow}
      onPress={() => openShipment(item)}
      activeOpacity={0.8}
    >
      <View style={styles.listIcon}>
        <FontAwesome5 name="check-circle" size={20} color="#0aa047" />
      </View>
      <View style={styles.listMain}>
        <View style={styles.listTop}>
          <Text style={styles.shipmentNumber} numberOfLines={1}>
            {getShipmentNumber(item)}
          </Text>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>Delivered</Text>
          </View>
        </View>
        <Text style={styles.receiver} numberOfLines={1}>
          {getReceiverName(item)}
        </Text>
        <Text style={styles.address} numberOfLines={2}>
          {getDeliveryAddress(item)}
        </Text>
        <Text style={styles.time}>
          {item.deliveredAtDate
            ? format(item.deliveredAtDate, "MMM d, yyyy hh:mm a")
            : "Delivery time unavailable"}
        </Text>
      </View>
      <FontAwesome5 name="chevron-right" size={15} color="#17284d" />
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          activeOpacity={0.75}
        >
          <FontAwesome5 name="chevron-left" size={16} color="#10224a" />
        </TouchableOpacity>
        <View style={styles.headerCopy}>
          <Text style={styles.title}>Delivered History</Text>
          <Text style={styles.subtitle}>
            {filteredShipments.length} delivered shipment
            {filteredShipments.length === 1 ? "" : "s"}
          </Text>
        </View>
      </View>

      <View style={styles.controls}>
        <View style={styles.searchBox}>
          <FontAwesome5 name="search" size={14} color="#66758f" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search shipment, receiver, address"
            placeholderTextColor="#8a97ad"
            value={search}
            onChangeText={(text) => {
              setSearch(text);
              setVisibleCount(PAGE_SIZE);
            }}
          />
        </View>

        <View style={styles.filterRow}>
          {DATE_FILTERS.map((filter) => (
            <TouchableOpacity
              key={filter.key}
              style={[
                styles.filterChip,
                dateFilter === filter.key && styles.filterChipActive,
              ]}
              onPress={() => {
                setDateFilter(filter.key);
                setVisibleCount(PAGE_SIZE);
              }}
              activeOpacity={0.76}
            >
              <Text
                style={[
                  styles.filterText,
                  dateFilter === filter.key && styles.filterTextActive,
                ]}
              >
                {filter.label}
              </Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity
            style={styles.sortChip}
            onPress={() =>
              setSortOrder((current) =>
                current === "NEWEST" ? "OLDEST" : "NEWEST",
              )
            }
            activeOpacity={0.76}
          >
            <FontAwesome5 name="sort" size={12} color="#075de8" />
            <Text style={styles.sortText}>
              {sortOrder === "NEWEST" ? "Newest" : "Oldest"}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator size="large" color="#075de8" />
          <Text style={styles.loadingText}>Loading delivered history...</Text>
        </View>
      ) : (
        <FlatList
          data={visibleShipments}
          keyExtractor={(item) => item.id}
          renderItem={renderShipment}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <DeliveredHistoryList
              shipments={[]}
              title="NO DELIVERED MATCHES"
            />
          }
          onEndReachedThreshold={0.3}
          onEndReached={() => {
            if (visibleCount < filteredShipments.length) {
              setVisibleCount((current) => current + PAGE_SIZE);
            }
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f7fbff",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#e5edf8",
  },
  backButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#eef5ff",
  },
  headerCopy: {
    flex: 1,
  },
  title: {
    color: "#101a33",
    fontSize: 21,
    fontWeight: "900",
  },
  subtitle: {
    color: "#66758f",
    fontSize: 13,
    fontWeight: "600",
    marginTop: 3,
  },
  controls: {
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 10,
    gap: 12,
  },
  searchBox: {
    minHeight: 48,
    borderRadius: 14,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#dce7f7",
  },
  searchInput: {
    flex: 1,
    color: "#101a33",
    fontSize: 14,
    fontWeight: "600",
    paddingVertical: 0,
  },
  filterRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  filterChip: {
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#dce7f7",
  },
  filterChipActive: {
    backgroundColor: "#075de8",
    borderColor: "#075de8",
  },
  filterText: {
    color: "#66758f",
    fontSize: 12,
    fontWeight: "800",
  },
  filterTextActive: {
    color: "#ffffff",
  },
  sortChip: {
    marginLeft: "auto",
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: "#eef5ff",
    borderWidth: 1,
    borderColor: "#cfe0ff",
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  sortText: {
    color: "#075de8",
    fontSize: 12,
    fontWeight: "900",
  },
  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  loadingText: {
    color: "#66758f",
    fontSize: 13,
    fontWeight: "700",
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 28,
    gap: 12,
  },
  listRow: {
    borderRadius: 18,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e5edf8",
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  listIcon: {
    width: 42,
    height: 42,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#e0f7e9",
  },
  listMain: {
    flex: 1,
    gap: 4,
  },
  listTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  shipmentNumber: {
    color: "#101a33",
    fontSize: 15,
    fontWeight: "900",
    flex: 1,
  },
  receiver: {
    color: "#3a4660",
    fontSize: 13,
    fontWeight: "800",
  },
  address: {
    color: "#66758f",
    fontSize: 12,
    fontWeight: "600",
    lineHeight: 17,
  },
  time: {
    color: "#075de8",
    fontSize: 12,
    fontWeight: "800",
    marginTop: 2,
  },
  badge: {
    borderRadius: 7,
    backgroundColor: "#dff5e7",
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  badgeText: {
    color: "#0aa047",
    fontSize: 11,
    fontWeight: "900",
  },
});

