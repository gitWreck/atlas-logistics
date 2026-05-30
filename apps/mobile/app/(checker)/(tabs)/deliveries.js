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
  Alert,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { FontAwesome5 } from "@expo/vector-icons";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "../../../firebase";
import { useAuth } from "../../../contexts/AuthContext";
import { useTheme } from "../../../contexts/ThemeContext";
import StatusBadge from "../../../components/ui/StatusBadge";
import {
  getCallableErrorMessage,
  loadAssignedShipmentsToVehicle,
  markShipmentOutForDelivery,
  reportCheckerFailedDelivery,
  returnCheckerShipmentsToWarehouse,
} from "../../../components/utilities/checkerDelivery";

const ACTIVE_ASSIGNED_STATUSES = new Set([
  "ASSIGNED",
  "READY_FOR_DELIVERY",
  "OUT_FOR_DELIVERY",
  "FAILED_DELIVERY",
  "LOADED",
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
  const [actionShipmentId, setActionShipmentId] = useState(null);

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

  const runShipmentAction = async (shipmentId, action) => {
    if (actionShipmentId) return;

    setActionShipmentId(shipmentId);

    try {
      if (action === "load") {
        await loadAssignedShipmentsToVehicle({
          shipmentIds: [shipmentId],
          profile,
        });
        Alert.alert("Loaded", "Shipment loaded onto your delivery vehicle.");
      } else if (action === "out_for_delivery") {
        await markShipmentOutForDelivery({
          shipmentId,
          profile,
        });
        Alert.alert("Success", "Shipment marked out for delivery.");
      } else if (action === "failed") {
        await reportCheckerFailedDelivery({
          shipmentIds: [shipmentId],
          profile,
          reasonCode: "DELIVERY_FAILED",
          remarks: "Failed delivery reported from assigned list.",
        });
        Alert.alert(
          "Failed Delivery",
          "Marked as failed. Return the package to Odiongan warehouse.",
        );
      } else if (action === "return") {
        await returnCheckerShipmentsToWarehouse({
          shipmentIds: [shipmentId],
          profile,
        });
        Alert.alert(
          "Returned",
          "Shipment returned to warehouse and removed from your route.",
        );
      }
    } catch (error) {
      console.error("Assigned delivery action failed:", error);
      Alert.alert(
        "Action Failed",
        getCallableErrorMessage(error, "Could not update shipment."),
      );
    } finally {
      setActionShipmentId(null);
    }
  };

  const goToDeliveryScan = () => {
    router.push({
      pathname: "/(checker)/scan",
      params: { mode: "delivery", title: "Last-Mile Delivery" },
    });
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
        <View
          style={[
            styles.summaryCard,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <Text style={[styles.summaryTitle, { color: colors.text }]}>
            My Assigned Deliveries
          </Text>
          <Text style={[styles.summaryText, { color: colors.textMuted }]}>
            {summary.total} assigned • {summary.outForDelivery} out for delivery
            • {summary.delivered} delivered
          </Text>
          <TouchableOpacity
            style={[styles.scanBtn, { borderColor: colors.border }]}
            onPress={goToDeliveryScan}
            activeOpacity={0.85}
          >
            <FontAwesome5 name="qrcode" size={12} color={colors.text} />
            <Text style={[styles.scanBtnText, { color: colors.text }]}>
              Scan last-mile delivery
            </Text>
          </TouchableOpacity>
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
              Once your warehouse manager releases packages to you, they will
              appear here in real time.
            </Text>
          </View>
        ) : (
          items.map((shipment) => (
            <View
              key={shipment.id}
              style={[
                styles.card,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <TouchableOpacity
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

              {String(shipment.status || "").toUpperCase() === "ASSIGNED" && (
                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: "#042C83" }]}
                  onPress={() => runShipmentAction(shipment.id, "load")}
                  disabled={actionShipmentId === shipment.id}
                >
                  {actionShipmentId === shipment.id ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={styles.actionBtnText}>Load to vehicle</Text>
                  )}
                </TouchableOpacity>
              )}

              {String(shipment.status || "").toUpperCase() ===
                "READY_FOR_DELIVERY" && (
                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: "#f59e0b" }]}
                  onPress={() =>
                    runShipmentAction(shipment.id, "out_for_delivery")
                  }
                  disabled={actionShipmentId === shipment.id}
                >
                  {actionShipmentId === shipment.id ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={styles.actionBtnText}>
                      Mark out for delivery
                    </Text>
                  )}
                </TouchableOpacity>
              )}

              {String(shipment.status || "").toUpperCase() ===
                "OUT_FOR_DELIVERY" && (
                <>
                  <TouchableOpacity
                    style={[styles.actionBtn, { backgroundColor: "#16a34a" }]}
                    onPress={() =>
                      router.push({
                        pathname: "/(checker)/shipment-details",
                        params: { shipmentId: shipment.id },
                      })
                    }
                  >
                    <Text style={styles.actionBtnText}>Complete delivery</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionBtn, styles.actionBtnSecondary]}
                    onPress={() => runShipmentAction(shipment.id, "failed")}
                    disabled={actionShipmentId === shipment.id}
                  >
                    <Text style={styles.actionBtnText}>Report failed</Text>
                  </TouchableOpacity>
                </>
              )}

              {String(shipment.status || "").toUpperCase() ===
                "FAILED_DELIVERY" && (
                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: "#dc2626" }]}
                  onPress={() => runShipmentAction(shipment.id, "return")}
                  disabled={actionShipmentId === shipment.id}
                >
                  {actionShipmentId === shipment.id ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={styles.actionBtnText}>
                      Return to warehouse
                    </Text>
                  )}
                </TouchableOpacity>
              )}
            </View>
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
  scanBtn: {
    marginTop: 12,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  scanBtnText: {
    fontSize: 13,
    fontWeight: "700",
  },
  actionBtn: {
    marginTop: 12,
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 42,
  },
  actionBtnText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "800",
  },
  actionBtnSecondary: {
    marginTop: 8,
    backgroundColor: "#b45309",
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
