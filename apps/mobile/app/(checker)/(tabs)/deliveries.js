import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Platform,
  StatusBar,
} from "react-native";
import { useRouter } from "expo-router";
import { FontAwesome5 } from "@expo/vector-icons";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "../../../firebase";
import { useAuth } from "../../../contexts/AuthContext";
import { useTheme } from "../../../contexts/ThemeContext";
import StatusBadge from "../../../components/ui/StatusBadge";

const ACTIVE_ASSIGNED_STATUSES = new Set([
  "ASSIGNED",
  "READY_FOR_DELIVERY",
  "OUT_FOR_DELIVERY",
  "LOADED",
  "RECEIVED",
  "IN_TRANSIT",
  "PARTIALLY_LOADED",
  "PARTIALLY_DELIVERED",
]);

function getTimeLabel(value) {
  if (!value) return "No recent update";
  const date =
    typeof value?.toDate === "function"
      ? value.toDate()
      : value?._seconds
        ? new Date(value._seconds * 1000)
        : new Date(value);
  if (Number.isNaN(date.getTime())) return "No recent update";
  return date.toLocaleString();
}

export default function CheckerDeliveriesTab() {
  const router = useRouter();
  const { profile } = useAuth();
  const { colors } = useTheme();

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    const checkerId = profile?.uid;
    if (!checkerId) {
      setItems([]);
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, "shipments"),
      where("assignedCheckerId", "==", String(checkerId)),
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const next = snap.docs
          .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }))
          .filter((shipment) =>
            ACTIVE_ASSIGNED_STATUSES.has(
              String(shipment.status || "").toUpperCase(),
            ),
          )
          .sort((a, b) => {
            const aMs = a?.updatedAt?.toMillis?.() || 0;
            const bMs = b?.updatedAt?.toMillis?.() || 0;
            return bMs - aMs;
          });
        setItems(next);
        setLoading(false);
        setRefreshing(false);
      },
      (error) => {
        console.error("Assigned deliveries snapshot failed:", error);
        setLoading(false);
        setRefreshing(false);
      },
    );

    return () => unsub();
  }, [profile?.uid]);

  const summary = useMemo(() => {
    const outForDelivery = items.filter(
      (item) => String(item.status || "").toUpperCase() === "OUT_FOR_DELIVERY",
    ).length;
    const delivered = items.filter(
      (item) => String(item.status || "").toUpperCase() === "DELIVERED",
    ).length;
    return {
      total: items.length,
      outForDelivery,
      delivered,
    };
  }, [items]);

  const onRefresh = () => {
    setRefreshing(true);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.text}
            colors={[colors.text]}
          />
        }
      >
        <View style={[styles.summaryCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.summaryTitle, { color: colors.text }]}>
            My Assigned Deliveries
          </Text>
          <Text style={[styles.summaryText, { color: colors.textMuted }]}>
            {summary.total} assigned • {summary.outForDelivery} out for delivery •{" "}
            {summary.delivered} delivered
          </Text>
        </View>

        {loading ? (
          <View style={styles.emptyState}>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>
              Loading assigned deliveries...
            </Text>
          </View>
        ) : items.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>
              No assigned deliveries yet
            </Text>
            <Text style={[styles.emptySub, { color: colors.textMuted }]}>
              Once your warehouse manager releases packages to you, they will appear here in real time.
            </Text>
          </View>
        ) : (
          items.map((shipment) => (
            <TouchableOpacity
              key={shipment.id}
              style={[
                styles.card,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
              activeOpacity={0.8}
              onPress={() =>
                router.push({
                  pathname: "/(checker)/shipment-details",
                  params: { shipmentId: shipment.id },
                })
              }
            >
              <View style={styles.cardHeader}>
                <View style={styles.idWrap}>
                  <FontAwesome5 name="box" size={12} color={colors.textMuted} />
                  <Text style={[styles.shipmentId, { color: colors.text }]}>
                    {shipment.id}
                  </Text>
                </View>
                <StatusBadge status={shipment.status || "ASSIGNED"} />
              </View>

              <Text style={[styles.customer, { color: colors.text }]}>
                {shipment.recipient?.name ||
                  shipment.customerName ||
                  shipment.receiverName ||
                  "Unknown recipient"}
              </Text>

              <View style={styles.metaRow}>
                <Text style={[styles.metaText, { color: colors.textMuted }]}>
                  Vehicle: {shipment.deliveryVehicleName || "Not assigned"}
                </Text>
                <Text style={[styles.metaText, { color: colors.textMuted }]}>
                  POD: {shipment.proofOfDelivery ? "Available" : "Pending"}
                </Text>
              </View>

              <Text style={[styles.timeText, { color: colors.textMuted }]}>
                Updated: {getTimeLabel(shipment.updatedAt)}
              </Text>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: Platform.OS === "android" ? StatusBar.currentHeight || 0 : 0,
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 24,
    gap: 12,
  },
  summaryCard: {
    marginTop: 8,
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: "700",
  },
  summaryText: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: "500",
  },
  card: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    marginBottom: 8,
  },
  idWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flex: 1,
  },
  shipmentId: {
    fontSize: 13,
    fontWeight: "700",
  },
  customer: {
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 8,
  },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
  },
  metaText: {
    fontSize: 12,
    fontWeight: "500",
    flex: 1,
  },
  timeText: {
    marginTop: 8,
    fontSize: 11,
    fontStyle: "italic",
  },
  emptyState: {
    marginTop: 18,
    borderRadius: 14,
    padding: 16,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 6,
  },
  emptySub: {
    fontSize: 12,
    lineHeight: 18,
  },
});
