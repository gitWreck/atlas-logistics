import React, { memo, useCallback, useMemo, useState } from "react";
import {
  FlatList,
  Platform,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { FontAwesome5 } from "@expo/vector-icons";
import { useAuth } from "../../../contexts/AuthContext";
import { useTheme } from "../../../contexts/ThemeContext";
import StatusBadge from "../../../components/ui/StatusBadge";
import {
  canCheckerContactCustomer,
  getCheckerDeliveryNextAction,
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

const DeliveryShipmentCard = memo(function DeliveryShipmentCard({
  shipment,
  checkerId,
  colors,
  isDark,
  accent,
  onOpen,
  onScan,
}) {
  const nextAction = getCheckerDeliveryNextAction(shipment, checkerId);
  const mine = shipment.poolStats?.mine || 0;
  const delivered = shipment.poolStats?.delivered || 0;

  return (
    <Card style={styles.card}>
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={() => onOpen(shipment.id)}
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
          <StatusBadge status={shipment.displayStatus || shipment.status} />
        </View>

        <Text style={[styles.customer, { color: colors.text }]}>
          {shipment.recipient?.name ||
            shipment.customerName ||
            "Unknown recipient"}
        </Text>

        <View style={styles.pieceRow}>
          <FontAwesome5 name="users" size={11} color={colors.textMuted} />
          <Text style={[styles.pieceText, { color: colors.textMuted }]}>
            {mine} on van · {delivered} delivered
          </Text>
        </View>

        <Text style={[styles.metaText, { color: colors.textMuted }]}>
          Vehicle: {shipment.deliveryVehicleName || "—"} · Updated{" "}
          {getTimeLabel(shipment.updatedAt)}
        </Text>
      </TouchableOpacity>

      {nextAction === "deliver" ? (
        <PrimaryButton
          label="SCAN DELIVERY"
          icon="qrcode"
          color={accent}
          onPress={() => onScan(shipment.id, "DELIVERED")}
          style={styles.actionButton}
        />
      ) : null}

      {nextAction === "return" ? (
        <PrimaryButton
          label="SCAN RETURN TO WAREHOUSE"
          icon="undo"
          color={SECTION.return.accent}
          onPress={() => onScan(shipment.id, "RETURNED_TO_WAREHOUSE")}
          style={styles.actionButton}
        />
      ) : null}

      {canCheckerContactCustomer(shipment, checkerId) ? (
        <CustomerCommsBar
          shipment={shipment}
          colors={colors}
          isDark={isDark}
          variant="compact"
        />
      ) : null}
    </Card>
  );
});

export default function CheckerDeliveriesTab() {
  const router = useRouter();
  const { profile } = useAuth();
  const { colors, resolvedScheme } = useTheme();
  const [refreshing, setRefreshing] = useState(false);
  const checkerId = profile?.uid;
  const isDark = resolvedScheme === "dark";
  const accent = SECTION.route.accent;
  const { myRouteShipments, summary, loading } = useCheckerLastMile();

  const routeStats = useMemo(() => {
    let onVan = 0;
    let delivered = 0;
    myRouteShipments.forEach((shipment) => {
      onVan += shipment.poolStats?.mine || 0;
      delivered += shipment.poolStats?.delivered || 0;
    });
    const failed = summary?.failed || 0;
    return {
      onVan: onVan + delivered + failed,
      delivered,
      failed,
      remaining: onVan,
    };
  }, [myRouteShipments, summary]);

  const openShipment = useCallback(
    (shipmentId) =>
      router.push({
        pathname: "/(checker)/shipment-details",
        params: { shipmentId },
      }),
    [router],
  );

  const goToDeliveryScan = useCallback(
    (shipmentId = null, presetScanStatus = null) => {
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
    },
    [router],
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 400);
  }, []);

  const statsHeader = useMemo(
    () => (
      <View style={styles.statsHeader}>
        <StatPillRow
          items={[
            { label: "On Van", value: routeStats.onVan, color: colors.text },
            { label: "Delivered", value: routeStats.delivered, color: "#16a34a" },
            { label: "Failed", value: routeStats.failed, color: "#dc2626" },
            { label: "Remaining", value: routeStats.remaining, color: "#2563eb" },
          ]}
        />
      </View>
    ),
    [colors.text, routeStats],
  );

  const emptyState = useMemo(
    () =>
      loading ? (
        <View style={styles.emptyState}>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>
            Loading your deliveries...
          </Text>
        </View>
      ) : (
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
      ),
    [accent, colors, loading],
  );

  const renderShipment = useCallback(
    ({ item }) => (
      <DeliveryShipmentCard
        shipment={item}
        checkerId={checkerId}
        colors={colors}
        isDark={isDark}
        accent={accent}
        onOpen={openShipment}
        onScan={goToDeliveryScan}
      />
    ),
    [accent, checkerId, colors, goToDeliveryScan, isDark, openShipment],
  );

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

      <FlatList
        data={loading ? [] : myRouteShipments}
        keyExtractor={(shipment) => String(shipment.id)}
        renderItem={renderShipment}
        ListHeaderComponent={statsHeader}
        ListEmptyComponent={emptyState}
        ItemSeparatorComponent={() => <View style={styles.listGap} />}
        contentContainerStyle={[
          styles.content,
          myRouteShipments.length === 0 && styles.contentGrow,
        ]}
        showsVerticalScrollIndicator={false}
        initialNumToRender={5}
        maxToRenderPerBatch={5}
        windowSize={7}
        updateCellsBatchingPeriod={50}
        removeClippedSubviews={Platform.OS !== "web"}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.text}
            colors={[colors.text]}
          />
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 20, paddingBottom: 24 },
  contentGrow: { flexGrow: 1 },
  statsHeader: { marginBottom: 12 },
  listGap: { height: 12 },
  card: { padding: 16 },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  shipmentId: { fontSize: 15, fontWeight: "800", flex: 1 },
  badgeRow: { flexDirection: "row", marginTop: 10 },
  customer: { fontSize: 16, fontWeight: "800", marginTop: 10 },
  pieceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    marginTop: 6,
  },
  pieceText: { fontSize: 13, fontWeight: "600" },
  metaText: { fontSize: 11, marginTop: 8 },
  actionButton: { marginTop: 14 },
  emptyState: { marginTop: 18, borderRadius: 14, padding: 16 },
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
  emptySub: { fontSize: 13, lineHeight: 18, textAlign: "center" },
});
