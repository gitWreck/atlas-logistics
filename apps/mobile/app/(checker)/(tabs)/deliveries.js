import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { FontAwesome5 } from "@expo/vector-icons";
import { useAuth } from "../../../contexts/AuthContext";
import { useTheme } from "../../../contexts/ThemeContext";
import StatusBadge from "../../../components/ui/StatusBadge";
import {
  canCheckerContactCustomer,
  getCallableErrorMessage,
  getCheckerDeliveryNextAction,
  reportCheckerFailedDelivery,
  returnCheckerShipmentsToWarehouse,
} from "../../../components/utilities/checkerDelivery";
import CustomerCommsBar from "../../../components/shipments/CustomerCommsBar";
import { useCheckerLastMile } from "../../../contexts/CheckerLastMileContext";
import {
  SectionHeader,
  Card,
  StatPillRow,
  PrimaryButton,
} from "../../../components/checker/design/primitives";
import { SECTION } from "../../../components/checker/design/checkerTheme";

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
  const { colors, resolvedScheme } = useTheme();
  const isDark = resolvedScheme === "dark";
  const [refreshing, setRefreshing] = useState(false);
  const [actionShipmentId, setActionShipmentId] = useState(null);

  const checkerId = profile?.uid;
  const { myRouteShipments, summary, loading } = useCheckerLastMile();

  const routeStats = useMemo(() => {
    let onVan = 0;
    let delivered = 0;
    myRouteShipments.forEach((s) => {
      onVan += s.poolStats?.mine || 0;
      delivered += s.poolStats?.delivered || 0;
    });
    const failed = summary?.failed || 0;
    return {
      onVan: onVan + delivered + failed,
      delivered,
      failed,
      remaining: onVan,
    };
  }, [myRouteShipments, summary]);

  const runShipmentAction = async (shipmentId, action) => {
    if (actionShipmentId) return;

    setActionShipmentId(shipmentId);

    try {
      if (action === "failed") {
        await reportCheckerFailedDelivery({
          shipmentIds: [shipmentId],
          profile,
          reasonCode: "DELIVERY_FAILED",
          remarks: "Failed delivery reported from My Deliveries.",
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
          "Shipment returned to warehouse and removed from your deliveries.",
        );
      }
    } catch (error) {
      console.error("My Deliveries action failed:", error);
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
      presetScanStatus === "DELIVERED" ||
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

  const accent = SECTION.route.accent;

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <SectionHeader
        sectionKey="route"
        title="MY DELIVERIES"
        subtitle="Deliver each loaded piece and keep your deliveries up to date."
        rightIcon="warehouse"
        onRightPress={() =>
          router.push("/(checker)/(tabs)/available-to-load")
        }
      />

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
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
        <StatPillRow
          items={[
            { label: "On Van", value: routeStats.onVan, color: colors.text },
            { label: "Delivered", value: routeStats.delivered, color: "#16a34a" },
            { label: "Failed", value: routeStats.failed, color: "#dc2626" },
            { label: "Remaining", value: routeStats.remaining, color: "#2563eb" },
          ]}
        />

        {loading ? (
          <View style={styles.emptyState}>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>
              Loading your deliveries...
            </Text>
          </View>
        ) : myRouteShipments.length === 0 ? (
          <View style={styles.emptyStateCentered}>
            <View style={[styles.emptyIcon, { backgroundColor: `${accent}18` }]}>
              <FontAwesome5 name="route" size={22} color={accent} />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>
              No active deliveries yet
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
            const mine = shipment.poolStats?.mine || 0;
            const delivered = shipment.poolStats?.delivered || 0;

            return (
              <Card key={shipment.id} style={styles.card}>
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
                    <Text
                      style={[styles.shipmentId, { color: colors.text }]}
                      numberOfLines={1}
                    >
                      {shipment.shipmentId || shipment.id}
                    </Text>
                    <FontAwesome5
                      name="chevron-right"
                      size={13}
                      color={colors.textMuted}
                    />
                  </View>

                  <View style={styles.badgeRow}>
                    <StatusBadge
                      status={shipment.displayStatus || shipment.status}
                    />
                  </View>

                  <Text style={[styles.customer, { color: colors.text }]}>
                    {shipment.recipient?.name ||
                      shipment.customerName ||
                      "Unknown recipient"}
                  </Text>

                  <View style={styles.pieceRow}>
                    <FontAwesome5
                      name="users"
                      size={11}
                      color={colors.textMuted}
                    />
                    <Text
                      style={[styles.pieceText, { color: colors.textMuted }]}
                    >
                      {mine} on van · {delivered} delivered
                    </Text>
                  </View>

                  <Text style={[styles.metaText, { color: colors.textMuted }]}>
                    Vehicle: {shipment.deliveryVehicleName || "—"} · Updated{" "}
                    {getTimeLabel(shipment.updatedAt)}
                  </Text>
                </TouchableOpacity>

                {nextAction === "deliver" && (
                  <PrimaryButton
                    label="SCAN DELIVERY"
                    icon="qrcode"
                    color={accent}
                    onPress={() => goToDeliveryScan(shipment.id, "DELIVERED")}
                    style={{ marginTop: 14 }}
                  />
                )}

                {nextAction === "return" && (
                  <PrimaryButton
                    label="SCAN RETURN TO WAREHOUSE"
                    icon="undo"
                    color={SECTION.return.accent}
                    onPress={() =>
                      goToDeliveryScan(shipment.id, "RETURNED_TO_WAREHOUSE")
                    }
                    style={{ marginTop: 14 }}
                  />
                )}

                {canCheckerContactCustomer(shipment, checkerId) && (
                  <CustomerCommsBar
                    shipment={shipment}
                    colors={colors}
                    isDark={isDark}
                    variant="compact"
                  />
                )}
              </Card>
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
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 24,
    gap: 12,
  },
  shortcutRow: {
    flexDirection: "row",
    gap: 12,
  },
  shortcutBtn: {
    flex: 1,
    paddingVertical: 10,
  },
  card: {
    padding: 16,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  shipmentId: {
    fontSize: 15,
    fontWeight: "800",
    flex: 1,
  },
  badgeRow: {
    flexDirection: "row",
    marginTop: 10,
  },
  customer: {
    fontSize: 16,
    fontWeight: "800",
    marginTop: 10,
  },
  pieceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    marginTop: 6,
  },
  pieceText: {
    fontSize: 13,
    fontWeight: "600",
  },
  metaText: {
    fontSize: 11,
    marginTop: 8,
  },
  emptyState: {
    marginTop: 18,
    borderRadius: 14,
    padding: 16,
  },
  emptyStateCentered: {
    marginTop: 40,
    alignItems: "center",
    paddingHorizontal: 12,
  },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 8,
    textAlign: "center",
  },
  emptySub: {
    fontSize: 13,
    lineHeight: 18,
    textAlign: "center",
  },
});
