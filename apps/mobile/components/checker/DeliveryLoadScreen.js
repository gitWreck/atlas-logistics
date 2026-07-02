import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Platform,
  StatusBar,
  TouchableOpacity,
  TextInput,
} from "react-native";
import { useRouter } from "expo-router";
import { FontAwesome5 } from "@expo/vector-icons";
import { useAuth } from "../../contexts/AuthContext";
import { useTheme } from "../../contexts/ThemeContext";
import { useDeliveryManifests } from "../../hooks/useDeliveryManifests";
import DeliveryManifestCard from "../../components/checker/DeliveryManifestCard";

const FILTER_TABS = [
  { value: "all", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "out", label: "Out" },
  { value: "completed", label: "Completed" },
  { value: "failed", label: "Failed" },
];

const SORT_MODES = [
  { value: "newest", label: "Newest", icon: "arrow-down" },
  { value: "oldest", label: "Oldest", icon: "arrow-up" },
  { value: "status", label: "Status", icon: "layer-group" },
];

const STATUS_SORT_ORDER = {
  OUT_FOR_DELIVERY: 0,
  LOADED: 1,
  RELEASED: 2,
  RECEIVED: 3,
  FAILED_DELIVERY: 4,
  COMPLETED: 5,
};

function normalizeStatus(status) {
  return String(status || "").trim().toUpperCase();
}

function getManifestTimeMs(manifest) {
  const value = manifest?.loadedAt || manifest?.releasedAt || manifest?.updatedAt;
  if (!value) return 0;
  if (typeof value?.toMillis === "function") return value.toMillis();
  if (value?._seconds) return value._seconds * 1000;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

function matchesFilter(manifest, filter) {
  if (filter === "all") return true;
  const status = normalizeStatus(manifest.displayStatus || manifest.status);
  if (filter === "out") return status === "OUT_FOR_DELIVERY";
  if (filter === "completed") return status === "COMPLETED";
  if (filter === "failed") return status === "FAILED_DELIVERY";
  if (filter === "pending") {
    return (
      status !== "OUT_FOR_DELIVERY" &&
      status !== "COMPLETED" &&
      status !== "FAILED_DELIVERY"
    );
  }
  return true;
}

function matchesSearch(manifest, term) {
  if (!term) return true;
  const haystack = [
    manifest.id,
    manifest.checkerName,
    manifest.deliveryVehicleName,
    manifest.deliveryVehicleId,
    manifest.releasedByName,
    manifest.updatedBy,
    ...(Array.isArray(manifest.shipments)
      ? manifest.shipments.map((s) => s?.id)
      : []),
    ...(Array.isArray(manifest.shipmentIds) ? manifest.shipmentIds : []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return haystack.includes(term);
}

export default function DeliveryLoadScreen({ showBackButton = false }) {
  const router = useRouter();
  const { profile } = useAuth();
  const { colors } = useTheme();
  const [refreshing, setRefreshing] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");
  const [sortMode, setSortMode] = useState("newest");

  const { manifests, summary, loading } = useDeliveryManifests();

  const onRefresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 600);
  };

  const openShipment = (shipmentId) => {
    router.push({
      pathname: "/(checker)/shipment-details",
      params: { shipmentId },
    });
  };

  const filterCounts = useMemo(() => {
    const counts = { all: manifests.length };
    FILTER_TABS.forEach((tab) => {
      if (tab.value === "all") return;
      counts[tab.value] = manifests.filter((m) =>
        matchesFilter(m, tab.value),
      ).length;
    });
    return counts;
  }, [manifests]);

  const visibleManifests = useMemo(() => {
    const term = searchText.trim().toLowerCase();
    const filtered = manifests
      .filter((m) => matchesFilter(m, activeFilter))
      .filter((m) => matchesSearch(m, term));

    const sorted = [...filtered];
    if (sortMode === "newest") {
      sorted.sort((a, b) => getManifestTimeMs(b) - getManifestTimeMs(a));
    } else if (sortMode === "oldest") {
      sorted.sort((a, b) => getManifestTimeMs(a) - getManifestTimeMs(b));
    } else if (sortMode === "status") {
      sorted.sort((a, b) => {
        const aOrder =
          STATUS_SORT_ORDER[
            normalizeStatus(a.displayStatus || a.status)
          ] ?? 99;
        const bOrder =
          STATUS_SORT_ORDER[
            normalizeStatus(b.displayStatus || b.status)
          ] ?? 99;
        if (aOrder !== bOrder) return aOrder - bOrder;
        return getManifestTimeMs(b) - getManifestTimeMs(a);
      });
    }
    return sorted;
  }, [manifests, activeFilter, searchText, sortMode]);

  const cycleSort = () => {
    const idx = SORT_MODES.findIndex((s) => s.value === sortMode);
    const next = SORT_MODES[(idx + 1) % SORT_MODES.length];
    setSortMode(next.value);
  };

  const activeSort =
    SORT_MODES.find((s) => s.value === sortMode) || SORT_MODES[0];

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      {showBackButton && (
        <View style={styles.backRow}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => router.back()}
            activeOpacity={0.8}
          >
            <FontAwesome5 name="arrow-left" size={14} color={colors.text} />
            <Text style={[styles.backText, { color: colors.text }]}>Back</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={[styles.headerTitle, { color: "#2563eb" }]}>
            MY LOAD
          </Text>
          <Text style={[styles.headerSub, { color: colors.textMuted }]}>
            {summary.manifestCount} load
            {summary.manifestCount === 1 ? "" : "s"} · {summary.totalPackages}{" "}
            pieces
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.scanBtn, { backgroundColor: "#2563eb" }]}
          onPress={() =>
            router.push({
              pathname: "/(checker)/scan",
              params: {
                mode: "offloading",
                title: "Deliver Piece",
                presetScanStatus: "DELIVERED",
              },
            })
          }
          activeOpacity={0.85}
        >
          <FontAwesome5 name="qrcode" size={13} color="#ffffff" />
          <Text style={[styles.scanBtnText, { color: "#ffffff" }]}>Scan</Text>
        </TouchableOpacity>
      </View>

      {/* Search + Sort */}
      <View style={styles.controlsRow}>
        <View
          style={[
            styles.searchContainer,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <FontAwesome5 name="search" size={13} color={colors.textMuted} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            placeholder="Search load, vehicle, package..."
            placeholderTextColor={colors.textMuted}
            value={searchText}
            onChangeText={setSearchText}
            returnKeyType="search"
          />
          {searchText.length > 0 && (
            <TouchableOpacity onPress={() => setSearchText("")}>
              <FontAwesome5
                name="times-circle"
                size={14}
                color={colors.textMuted}
              />
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity
          style={[
            styles.sortBtn,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
          onPress={cycleSort}
          activeOpacity={0.8}
        >
          <FontAwesome5
            name={activeSort.icon}
            size={12}
            color={colors.textMuted}
          />
          <Text style={[styles.sortText, { color: colors.text }]}>
            {activeSort.label}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Filter tabs */}
      <View style={styles.tabsWrap}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabsContent}
        >
          {FILTER_TABS.map((tab) => {
            const isActive = activeFilter === tab.value;
            const count = filterCounts[tab.value] || 0;
            return (
              <TouchableOpacity
                key={tab.value}
                style={[
                  styles.tabChip,
                  isActive
                    ? { backgroundColor: colors.text, borderColor: colors.text }
                    : {
                        backgroundColor: colors.surface,
                        borderColor: colors.border,
                      },
                ]}
                onPress={() => setActiveFilter(tab.value)}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    styles.tabText,
                    { color: isActive ? colors.bg : colors.textMuted },
                  ]}
                >
                  {tab.label}
                </Text>
                <View
                  style={[
                    styles.tabCount,
                    {
                      backgroundColor: isActive ? colors.bg : colors.cardMuted,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.tabCountText,
                      { color: isActive ? colors.text : colors.textMuted },
                    ]}
                  >
                    {count}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.text}
            colors={[colors.text]}
          />
        }
      >
        {loading ? (
          <View style={styles.emptyState}>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>
              Loading delivery manifests...
            </Text>
          </View>
        ) : manifests.length === 0 ? (
          <View style={styles.emptyState}>
            <FontAwesome5
              name="dolly-flatbed"
              size={28}
              color={colors.textMuted}
              style={styles.emptyIcon}
            />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>
              No active delivery load yet
            </Text>
            <Text style={[styles.emptySub, { color: colors.textMuted }]}>
              When you load pieces from the available pool, your delivery
              manifest will appear here.
            </Text>
          </View>
        ) : visibleManifests.length === 0 ? (
          <View style={styles.emptyState}>
            <FontAwesome5
              name="search"
              size={24}
              color={colors.textMuted}
              style={styles.emptyIcon}
            />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>
              No matching loads
            </Text>
            <Text style={[styles.emptySub, { color: colors.textMuted }]}>
              Try a different filter or search term.
            </Text>
          </View>
        ) : (
          visibleManifests.map((manifest) => (
            <DeliveryManifestCard
              key={manifest.id}
              manifest={manifest}
              colors={colors}
              onPressShipment={openShipment}
            />
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
  backRow: {
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  backBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    alignSelf: "flex-start",
    paddingVertical: 6,
  },
  backText: {
    fontSize: 14,
    fontWeight: "700",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 4,
    gap: 12,
  },
  headerText: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: -0.3,
  },
  headerSub: {
    marginTop: 2,
    fontSize: 12,
    fontWeight: "600",
  },
  scanBtn: {
    borderRadius: 10,
    paddingVertical: 9,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  scanBtnText: {
    fontSize: 13,
    fontWeight: "800",
  },
  controlsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  searchContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 40,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    fontWeight: "500",
    paddingVertical: 0,
  },
  sortBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 40,
  },
  sortText: {
    fontSize: 12,
    fontWeight: "700",
  },
  tabsWrap: {
    paddingTop: 10,
  },
  tabsContent: {
    paddingHorizontal: 20,
    gap: 8,
  },
  tabChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 7,
    paddingHorizontal: 14,
  },
  tabText: {
    fontSize: 13,
    fontWeight: "700",
  },
  tabCount: {
    minWidth: 20,
    paddingHorizontal: 6,
    height: 20,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  tabCountText: {
    fontSize: 11,
    fontWeight: "800",
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 24,
    gap: 12,
  },
  emptyState: {
    marginTop: 40,
    alignItems: "center",
    paddingHorizontal: 24,
  },
  emptyIcon: {
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 6,
    textAlign: "center",
  },
  emptySub: {
    fontSize: 12,
    lineHeight: 18,
    textAlign: "center",
  },
});
