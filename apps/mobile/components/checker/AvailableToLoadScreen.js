import React, { memo, useCallback, useMemo, useState } from "react";
import {
  FlatList,
  Platform,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { FontAwesome5 } from "@expo/vector-icons";
import { useTheme } from "../../contexts/ThemeContext";
import { useCheckerLastMile } from "../../contexts/CheckerLastMileContext";
import { formatPoolCountLine } from "../utilities/checkerDeliveryPool";
import { SectionHeader, Card, PrimaryButton } from "./design/primitives";
import { SECTION } from "./design/checkerTheme";

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

const AvailableShipmentCard = memo(function AvailableShipmentCard({
  shipment,
  accent,
  colors,
  onOpen,
  onLoad,
}) {
  return (
    <Card style={styles.card}>
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={() => onOpen(shipment.id)}
      >
        <View style={styles.cardHeader}>
          <View style={styles.idWrap}>
            <View style={[styles.cardIcon, { backgroundColor: `${accent}18` }]}>
              <FontAwesome5 name="clipboard-list" size={14} color={accent} />
            </View>
            <View style={styles.idText}>
              <Text
                style={[styles.shipmentId, { color: colors.text }]}
                numberOfLines={1}
              >
                {shipment.shipmentId || shipment.id}
              </Text>
              {shipment.recipient?.name ? (
                <Text
                  style={[styles.customer, { color: colors.textMuted }]}
                  numberOfLines={1}
                >
                  {shipment.recipient.name}
                </Text>
              ) : null}
            </View>
          </View>
          <View style={[styles.availBadge, { backgroundColor: `${accent}18` }]}>
            <Text style={[styles.availBadgeText, { color: accent }]}>
              {shipment.poolStats?.available || 0} Available
            </Text>
          </View>
        </View>

        <View style={[styles.metaRow, { borderTopColor: colors.border }]}>
          <Text style={[styles.metaLabel, { color: colors.textMuted }]}>
            {formatPoolCountLine(shipment.poolStats)}
            {shipment.shipmentMunicipality
              ? ` · ${shipment.shipmentMunicipality}`
              : ""}
          </Text>
        </View>
        <Text style={[styles.releasedText, { color: colors.textMuted }]}>
          Released {getTimeLabel(shipment.updatedAt)}
        </Text>
      </TouchableOpacity>

      <PrimaryButton
        label="LOAD"
        icon="dolly"
        color={accent}
        onPress={onLoad}
        style={styles.loadButton}
      />
    </Card>
  );
});

export default function AvailableToLoadScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const accent = SECTION.available.accent;

  const {
    availableShipments,
    loading,
    municipalityLabel,
    hasMunicipalityAssignment,
  } = useCheckerLastMile();

  const summary = useMemo(
    () =>
      availableShipments.reduce(
        (acc, item) => {
          acc.shipments += 1;
          acc.available += item.poolStats?.available || 0;
          acc.mine += item.poolStats?.mine || 0;
          acc.others += item.poolStats?.others || 0;
          return acc;
        },
        { shipments: 0, available: 0, mine: 0, others: 0 },
      ),
    [availableShipments],
  );

  const filteredShipments = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return availableShipments;
    return availableShipments.filter((shipment) => {
      const id = String(shipment.shipmentId || shipment.id || "").toLowerCase();
      const name = String(shipment.recipient?.name || "").toLowerCase();
      return id.includes(q) || name.includes(q);
    });
  }, [availableShipments, search]);

  const openLoadScan = useCallback(() => {
    router.push({
      pathname: "/(checker)/scan",
      params: {
        mode: "delivery",
        title: "Load",
        presetScanStatus: "LOAD_TO_VEHICLE",
      },
    });
  }, [router]);

  const openShipment = useCallback(
    (shipmentId) =>
      router.push({
        pathname: "/(checker)/shipment-details",
        params: { shipmentId },
      }),
    [router],
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 400);
  }, []);

  const listHeader = useMemo(
    () => (
      <>
        <View
          style={[
            styles.searchBar,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <FontAwesome5 name="search" size={13} color={colors.textMuted} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            placeholder="Search shipment or customer..."
            placeholderTextColor={colors.textMuted}
            value={search}
            onChangeText={setSearch}
            returnKeyType="search"
          />
          {search ? (
            <TouchableOpacity onPress={() => setSearch("")} hitSlop={8}>
              <FontAwesome5
                name="times-circle"
                size={15}
                color={colors.textMuted}
              />
            </TouchableOpacity>
          ) : null}
        </View>

        {municipalityLabel ? (
          <Text style={[styles.routeLabel, { color: colors.textMuted }]}>
            <FontAwesome5 name="map-marker-alt" size={11} color={accent} />{" "}
            {municipalityLabel} · {summary.available} piece
            {summary.available === 1 ? "" : "s"} ready
          </Text>
        ) : null}
      </>
    ),
    [accent, colors, municipalityLabel, search, summary.available],
  );

  const emptyState = useMemo(() => {
    if (loading) {
      return (
        <View style={styles.emptyState}>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>
            Loading available inventory...
          </Text>
        </View>
      );
    }
    if (!hasMunicipalityAssignment) {
      return (
        <View style={styles.emptyState}>
          <View style={[styles.emptyIcon, { backgroundColor: `${accent}18` }]}>
            <FontAwesome5 name="map-marked-alt" size={22} color={accent} />
          </View>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>
            No municipalities assigned
          </Text>
          <Text style={[styles.emptySub, { color: colors.textMuted }]}>
            Ask Rose or your manager to assign delivery municipalities to your
            account before loading packages.
          </Text>
        </View>
      );
    }
    return (
      <View style={styles.emptyState}>
        <View style={[styles.emptyIcon, { backgroundColor: `${accent}18` }]}>
          <FontAwesome5 name="box-open" size={22} color={accent} />
        </View>
        <Text style={[styles.emptyTitle, { color: colors.text }]}>
          {search ? "No matches found" : "Nothing available to load"}
        </Text>
        <Text style={[styles.emptySub, { color: colors.textMuted }]}>
          {search
            ? "Try a different shipment ID or customer name."
            : "When Rose releases shipments for your municipalities, they will appear here."}
        </Text>
        {!search ? (
          <TouchableOpacity
            style={[styles.linkBtn, { borderColor: colors.border }]}
            onPress={() => router.push("/(checker)/(tabs)/deliveries")}
            activeOpacity={0.85}
          >
            <Text style={[styles.linkBtnText, { color: accent }]}>
              Open My Deliveries
            </Text>
          </TouchableOpacity>
        ) : null}
      </View>
    );
  }, [accent, colors, hasMunicipalityAssignment, loading, router, search]);

  const renderShipment = useCallback(
    ({ item }) => (
      <AvailableShipmentCard
        shipment={item}
        accent={accent}
        colors={colors}
        onOpen={openShipment}
        onLoad={openLoadScan}
      />
    ),
    [accent, colors, openLoadScan, openShipment],
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <SectionHeader
        sectionKey="available"
        title="AVAILABLE"
        subtitle="Packages released by warehouse ready for loading."
        rightIcon="qrcode"
        onRightPress={hasMunicipalityAssignment ? openLoadScan : undefined}
      />

      <FlatList
        data={loading || !hasMunicipalityAssignment ? [] : filteredShipments}
        keyExtractor={(shipment) => String(shipment.id)}
        renderItem={renderShipment}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={emptyState}
        ItemSeparatorComponent={() => <View style={styles.listGap} />}
        contentContainerStyle={[
          styles.content,
          filteredShipments.length === 0 && styles.contentGrow,
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        initialNumToRender={6}
        maxToRenderPerBatch={6}
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
  listGap: { height: 12 },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === "ios" ? 12 : 6,
    marginTop: 4,
    marginBottom: 12,
  },
  searchInput: { flex: 1, fontSize: 14, padding: 0 },
  routeLabel: { fontSize: 12, fontWeight: "600", marginBottom: 12 },
  card: { padding: 14 },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  idWrap: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
  cardIcon: {
    width: 38,
    height: 38,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  idText: { flex: 1 },
  shipmentId: { fontSize: 14, fontWeight: "800" },
  customer: { fontSize: 12, marginTop: 2 },
  availBadge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  availBadgeText: { fontSize: 11, fontWeight: "800" },
  metaRow: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  metaLabel: { fontSize: 12, fontWeight: "600", lineHeight: 17 },
  releasedText: { fontSize: 11, marginTop: 4 },
  loadButton: { marginTop: 14 },
  emptyState: { paddingVertical: 48, alignItems: "center" },
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
    paddingHorizontal: 12,
  },
  linkBtn: {
    marginTop: 16,
    borderWidth: 1.5,
    borderRadius: 12,
    paddingVertical: 11,
    paddingHorizontal: 20,
  },
  linkBtnText: { fontSize: 13, fontWeight: "800", textAlign: "center" },
});
