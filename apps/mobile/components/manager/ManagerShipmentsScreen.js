import React, { useMemo, useState } from "react";
import {
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import Feather from "@expo/vector-icons/Feather";
import { useRouter } from "expo-router";
import { useTheme } from "../../contexts/ThemeContext";
import StatusBadge from "../ui/StatusBadge";
import { listManagerMobileShipments } from "../utilities/FirebaseFunctions";
import useManagerRequest from "./useManagerRequest";
import ManagerCreateShipmentModal from "./ManagerCreateShipmentModal";
import {
  EmptyState,
  ErrorState,
  LoadingState,
  ManagerCard,
  ManagerHeader,
  formatDate,
} from "./ManagerUI";

const STATUS_FILTERS = [
  "ALL",
  "AVAILABLE",
  "LOADED",
  "IN_TRANSIT",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
  "FAILED_DELIVERY",
  "RETURNED",
];

function searchText(shipment = {}) {
  return [
    shipment.id,
    shipment.shipmentId,
    shipment.trackingNumber,
    shipment.customerName,
    shipment.sender?.name,
    shipment.recipient?.name,
    shipment.municipality,
    shipment.recipient?.city,
    shipment.recipient?.address?.city,
    shipment.status,
    shipment.checkerName,
    shipment.assignedCheckerName,
    shipment.driverName,
    shipment.assignedDriverName,
    shipment.truckPlateNumber,
    shipment.vehiclePlate,
    shipment.truckDetails?.truckPlate,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function dateValue(shipment = {}) {
  const date = new Date(shipment.updatedAt || shipment.createdAt || 0);
  return Number.isFinite(date.getTime()) ? date : null;
}

export default function ManagerShipmentsScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("ALL");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [municipality, setMunicipality] = useState("");
  const [checker, setChecker] = useState("");
  const [driver, setDriver] = useState("");
  const [createVisible, setCreateVisible] = useState(false);
  const { data, loading, refreshing, error, reload } = useManagerRequest(
    listManagerMobileShipments,
    { limit: 500 },
  );

  const shipments = useMemo(() => {
    const term = search.trim().toLowerCase();
    const start = startDate ? new Date(`${startDate}T00:00:00`) : null;
    const end = endDate ? new Date(`${endDate}T23:59:59`) : null;
    return (data?.shipments || []).filter((shipment) => {
      if (term && !searchText(shipment).includes(term)) return false;
      const municipalityText = [
        shipment.municipality,
        shipment.recipient?.city,
        shipment.recipient?.address?.city,
      ].filter(Boolean).join(" ").toLowerCase();
      const checkerText = [shipment.checkerName, shipment.assignedCheckerName]
        .filter(Boolean).join(" ").toLowerCase();
      const driverText = [shipment.driverName, shipment.assignedDriverName]
        .filter(Boolean).join(" ").toLowerCase();
      if (municipality.trim() && !municipalityText.includes(municipality.trim().toLowerCase())) return false;
      if (checker.trim() && !checkerText.includes(checker.trim().toLowerCase())) return false;
      if (driver.trim() && !driverText.includes(driver.trim().toLowerCase())) return false;
      const normalizedStatus = String(shipment.status || "").toUpperCase();
      if (status !== "ALL") {
        if (status === "RETURNED" && normalizedStatus.startsWith("RETURNED")) {
          // Include all returned lifecycle variants.
        } else if (normalizedStatus !== status) return false;
      }
      const date = dateValue(shipment);
      if (start && date && date < start) return false;
      if (end && date && date > end) return false;
      return true;
    });
  }, [data, search, status, startDate, endDate, municipality, checker, driver]);

  if (loading) return <LoadingState label="Loading authorized shipments…" />;
  if (error) return <ErrorState message={error.message} onRetry={() => reload()} />;

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <ManagerHeader
        title="Shipments"
        subtitle={`${shipments.length} authorized record${shipments.length === 1 ? "" : "s"}`}
        actionIcon="plus"
        onAction={() => setCreateVisible(true)}
      />
      <View style={[styles.filters, { backgroundColor: colors.surface }]}>
        <View style={[styles.search, { backgroundColor: colors.cardMuted }]}>
          <Feather name="search" size={18} color={colors.textMuted} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Tracking, customer, area, staff, vehicle"
            placeholderTextColor={colors.textMuted}
            style={[styles.searchInput, { color: colors.text }]}
          />
          {search ? (
            <Pressable onPress={() => setSearch("")}>
              <Feather name="x-circle" size={18} color={colors.textMuted} />
            </Pressable>
          ) : null}
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.chips}>
            {STATUS_FILTERS.map((value) => {
              const active = status === value;
              return (
                <Pressable
                  key={value}
                  onPress={() => setStatus(value)}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: active ? "#4f46e5" : colors.cardMuted,
                      borderColor: active ? "#4f46e5" : colors.border,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.chipText,
                      { color: active ? "#fff" : colors.textMuted },
                    ]}
                  >
                    {value.replace(/_/g, " ")}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </ScrollView>
        <View style={styles.dateRow}>
          <View style={[styles.dateInput, { borderColor: colors.border }]}>
            <Text style={[styles.dateLabel, { color: colors.textMuted }]}>FROM</Text>
            <TextInput
              value={startDate}
              onChangeText={setStartDate}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={colors.textMuted}
              style={[styles.dateText, { color: colors.text }]}
              keyboardType="numbers-and-punctuation"
            />
          </View>
          <View style={[styles.dateInput, { borderColor: colors.border }]}>
            <Text style={[styles.dateLabel, { color: colors.textMuted }]}>TO</Text>
            <TextInput
              value={endDate}
              onChangeText={setEndDate}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={colors.textMuted}
              style={[styles.dateText, { color: colors.text }]}
              keyboardType="numbers-and-punctuation"
            />
          </View>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.advancedFilters}>
            <FilterInput label="MUNICIPALITY" value={municipality} onChangeText={setMunicipality} colors={colors} />
            <FilterInput label="CHECKER" value={checker} onChangeText={setChecker} colors={colors} />
            <FilterInput label="DRIVER" value={driver} onChangeText={setDriver} colors={colors} />
          </View>
        </ScrollView>
      </View>

      <FlatList
        data={shipments}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => reload({ refresh: true })}
            tintColor="#4f46e5"
          />
        }
        contentContainerStyle={shipments.length ? styles.list : styles.emptyList}
        renderItem={({ item }) => (
          <Pressable
            onPress={() =>
              router.push({
                pathname: "/(manager)/shipment-details",
                params: { shipmentId: item.id },
              })
            }
          >
            <ManagerCard>
              <View style={styles.cardTop}>
                <View style={styles.cardCopy}>
                  <Text style={[styles.tracking, { color: colors.text }]} numberOfLines={1}>
                    {item.trackingNumber || item.shipmentId || item.id}
                  </Text>
                  <Text style={[styles.customer, { color: colors.textMuted }]} numberOfLines={1}>
                    {item.recipient?.name || item.customerName || "Customer not listed"}
                  </Text>
                </View>
                <StatusBadge status={item.status} />
                <Pressable
                  accessibilityLabel={`Actions for ${item.trackingNumber || item.id}`}
                  hitSlop={8}
                  onPress={(event) => {
                    event.stopPropagation?.();
                    router.push({
                      pathname: "/(manager)/shipment-details",
                      params: { shipmentId: item.id },
                    });
                  }}
                  style={[styles.moreButton, { backgroundColor: colors.cardMuted }]}
                >
                  <Feather name="more-vertical" size={20} color={colors.text} />
                </Pressable>
              </View>
              <View style={[styles.divider, { backgroundColor: colors.border }]} />
              <View style={styles.metaGrid}>
                <Meta
                  icon="map-pin"
                  label="Municipality"
                  value={
                    item.municipality ||
                    item.recipient?.address?.city ||
                    item.recipient?.city ||
                    "Not listed"
                  }
                  colors={colors}
                />
                <Meta
                  icon="users"
                  label="Assignment"
                  value={
                    item.checkerName ||
                    item.assignedCheckerName ||
                    item.driverName ||
                    item.assignedDriverName ||
                    "Unassigned"
                  }
                  colors={colors}
                />
                <Meta
                  icon="truck"
                  label="Vehicle"
                  value={
                    item.truckPlateNumber ||
                    item.vehiclePlate ||
                    item.truckDetails?.truckPlate ||
                    "Unassigned"
                  }
                  colors={colors}
                />
                <Meta
                  icon="clock"
                  label="Updated"
                  value={formatDate(item.updatedAt)}
                  colors={colors}
                />
              </View>
            </ManagerCard>
          </Pressable>
        )}
        ListEmptyComponent={
          <EmptyState
            icon="package"
            title="No shipments found"
            message="Try changing your search, status, or date filters."
          />
        }
      />
      <ManagerCreateShipmentModal
        visible={createVisible}
        scope={data?.scope}
        onClose={() => setCreateVisible(false)}
        onCreated={() => reload({ refresh: true })}
      />
    </View>
  );
}

function FilterInput({ label, value, onChangeText, colors }) {
  return (
    <View style={[styles.advancedInput, { borderColor: colors.border }]}>
      <Text style={[styles.dateLabel, { color: colors.textMuted }]}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder="All"
        placeholderTextColor={colors.textMuted}
        style={[styles.dateText, { color: colors.text }]}
      />
    </View>
  );
}

function Meta({ icon, label, value, colors }) {
  return (
    <View style={styles.meta}>
      <Feather name={icon} size={14} color={colors.textMuted} />
      <View style={styles.metaCopy}>
        <Text style={[styles.metaLabel, { color: colors.textMuted }]}>{label}</Text>
        <Text style={[styles.metaValue, { color: colors.text }]} numberOfLines={2}>
          {value}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  filters: {
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 12,
    gap: 10,
  },
  search: {
    minHeight: 46,
    borderRadius: 14,
    paddingHorizontal: 13,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
  },
  searchInput: { flex: 1, padding: 0, fontSize: 14 },
  chips: { flexDirection: "row", gap: 8 },
  chip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 8,
  },
  chipText: { fontSize: 10, fontWeight: "800" },
  dateRow: { flexDirection: "row", gap: 9 },
  dateInput: {
    flex: 1,
    minHeight: 51,
    borderWidth: 1,
    borderRadius: 13,
    paddingHorizontal: 11,
    paddingVertical: 6,
  },
  dateLabel: { fontSize: 9, fontWeight: "900" },
  dateText: { flex: 1, padding: 0, fontSize: 13 },
  advancedFilters: { flexDirection: "row", gap: 8 },
  advancedInput: { width: 145, minHeight: 51, borderWidth: 1, borderRadius: 13, paddingHorizontal: 11, paddingVertical: 6 },
  list: { padding: 14, paddingBottom: 28, gap: 11 },
  emptyList: { flexGrow: 1 },
  cardTop: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  cardCopy: { flex: 1, minWidth: 0 },
  moreButton: { width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  tracking: { fontSize: 15, fontWeight: "900" },
  customer: { fontSize: 12, marginTop: 4 },
  divider: { height: StyleSheet.hairlineWidth, marginVertical: 13 },
  metaGrid: { flexDirection: "row", flexWrap: "wrap", rowGap: 12 },
  meta: { width: "50%", flexDirection: "row", alignItems: "flex-start", gap: 7 },
  metaCopy: { flex: 1, minWidth: 0 },
  metaLabel: { fontSize: 9, fontWeight: "800", textTransform: "uppercase" },
  metaValue: { fontSize: 11, lineHeight: 16, fontWeight: "600", marginTop: 2 },
});
