import React, { useState } from "react";
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
import { useAuth } from "../../../contexts/AuthContext";
import { useTheme } from "../../../contexts/ThemeContext";
import StatusBadge from "../../../components/ui/StatusBadge";
import {
  getCallableErrorMessage,
  getCheckerDeliveryNextAction,
  reportCheckerFailedDelivery,
  returnCheckerShipmentsToWarehouse,
} from "../../../components/utilities/checkerDelivery";
import { useCheckerLastMile } from "../../../contexts/CheckerLastMileContext";
import { formatPoolCountLine } from "../../../components/utilities/checkerDeliveryPool";

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
  const [refreshing, setRefreshing] = useState(false);
  const [actionShipmentId, setActionShipmentId] = useState(null);

  const checkerId = profile?.uid;
  const { myRouteShipments, routeSummary, loading } = useCheckerLastMile();

  const runShipmentAction = async (shipmentId, action) => {
    if (actionShipmentId) return;

    setActionShipmentId(shipmentId);

    try {
      if (action === "failed") {
        await reportCheckerFailedDelivery({
          shipmentIds: [shipmentId],
          profile,
          reasonCode: "DELIVERY_FAILED",
          remarks: "Failed delivery reported from My Route.",
        });
        Alert.alert(
          "Failed Delivery",
          "Your loaded pieces were marked failed. Return them to Odiongan warehouse.",
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
      console.error("My Route action failed:", error);
      Alert.alert(
        "Action Failed",
        getCallableErrorMessage(error, "Could not update shipment."),
      );
    } finally {
      setActionShipmentId(null);
    }
  };

  const goToDeliveryScan = (shipmentId = null, presetScanStatus = null) => {
    const isOffloadAction =
      presetScanStatus === "FAILED_DELIVERY" ||
      presetScanStatus === "RETURNED_TO_WAREHOUSE";
    const title =
      presetScanStatus === "FAILED_DELIVERY"
        ? "Failed Delivery"
        : presetScanStatus === "RETURNED_TO_WAREHOUSE"
          ? "Return to Warehouse"
          : "Deliver Piece";

    router.push({
      pathname: "/(checker)/scan",
      params: {
        mode: isOffloadAction ? "offloading" : "delivery",
        title,
        ...(shipmentId ? { focusShipmentId: shipmentId } : {}),
        ...(presetScanStatus ? { presetScanStatus } : {}),
      },
    });
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              setTimeout(() => setRefreshing(false), 400);
            }}
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
            My Route
          </Text>
          <Text style={[styles.summaryText, { color: colors.textMuted }]}>
            {routeSummary.total} active · {routeSummary.outForDelivery} out for
            delivery · {routeSummary.onVan} on van
          </Text>
          <TouchableOpacity
            style={[styles.loadBtn, { borderColor: colors.border }]}
            onPress={() => router.push("/(checker)/(tabs)/available-to-load")}
            activeOpacity={0.85}
          >
            <FontAwesome5 name="warehouse" size={12} color={colors.text} />
            <Text style={[styles.scanBtnText, { color: colors.text }]}>
              Load from warehouse pool
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.scanBtn, { borderColor: colors.border }]}
            onPress={() => goToDeliveryScan(null, "DELIVERED")}
            activeOpacity={0.85}
          >
            <FontAwesome5 name="qrcode" size={12} color={colors.text} />
            <Text style={[styles.scanBtnText, { color: colors.text }]}>
              Scan last-mile delivery
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.loadBtn, { borderColor: colors.border }]}
            onPress={() => router.push("/(checker)/(tabs)/delivery-load")}
            activeOpacity={0.85}
          >
            <FontAwesome5 name="shipping-fast" size={12} color={colors.text} />
            <Text style={[styles.scanBtnText, { color: colors.text }]}>
              Open My Load
            </Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.emptyState}>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>
              Loading your route...
            </Text>
          </View>
        ) : myRouteShipments.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>
              No active route yet
            </Text>
            <Text style={[styles.emptySub, { color: colors.textMuted }]}>
              Load pieces from the Available tab first. Each scan marks them out
              for delivery and they will appear here for last-mile delivery.
            </Text>
          </View>
        ) : (
          myRouteShipments.map((shipment) => {
            const nextAction = getCheckerDeliveryNextAction(
              shipment,
              checkerId,
            );

            return (
              <View
                key={shipment.id}
                style={[
                  styles.card,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                  },
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
                      <FontAwesome5
                        name="box"
                        size={12}
                        color={colors.textMuted}
                      />
                      <Text style={[styles.shipmentId, { color: colors.text }]}>
                        {shipment.shipmentId || shipment.id}
                      </Text>
                    </View>
                    <StatusBadge
                      status={shipment.displayStatus || shipment.status}
                    />
                  </View>

                  <Text style={[styles.poolLine, { color: colors.text }]}>
                    {formatPoolCountLine(shipment.poolStats)}
                  </Text>

                  <Text style={[styles.customer, { color: colors.text }]}>
                    {shipment.recipient?.name ||
                      shipment.customerName ||
                      "Unknown recipient"}
                  </Text>

                  <Text style={[styles.metaText, { color: colors.textMuted }]}>
                    Vehicle: {shipment.deliveryVehicleName || "—"}
                  </Text>

                  <Text style={[styles.timeText, { color: colors.textMuted }]}>
                    Updated: {getTimeLabel(shipment.updatedAt)}
                  </Text>
                </TouchableOpacity>

                {nextAction === "deliver" && (
                  <>
                    <TouchableOpacity
                      style={[styles.actionBtn, { backgroundColor: "#16a34a" }]}
                      onPress={() =>
                        goToDeliveryScan(shipment.id, "DELIVERED")
                      }
                    >
                      <Text style={styles.actionBtnText}>Scan to deliver</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.actionBtn, styles.actionBtnSecondary]}
                      onPress={() =>
                        goToDeliveryScan(shipment.id, "FAILED_DELIVERY")
                      }
                    >
                      <Text style={styles.actionBtnText}>
                        Scan failed delivery
                      </Text>
                    </TouchableOpacity>
                  </>
                )}

                {nextAction === "return" && (
                  <>
                  <TouchableOpacity
                    style={[styles.actionBtn, { backgroundColor: "#dc2626" }]}
                    onPress={() =>
                      goToDeliveryScan(shipment.id, "RETURNED_TO_WAREHOUSE")
                    }
                  >
                    <Text style={styles.actionBtnText}>
                      Scan return to warehouse
                    </Text>
                    </TouchableOpacity>
                  </>
                )}
              </View>
            );
          })
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
  poolLine: {
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 8,
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
  loadBtn: {
    marginTop: 8,
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
  metaText: {
    fontSize: 12,
    fontWeight: "500",
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
