import React, { useMemo, useState } from "react";
import {
  Alert,
  FlatList,
  Modal,
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
import { useAuth } from "../../contexts/AuthContext";
import StatusBadge from "../ui/StatusBadge";
import {
  deleteShipment,
  listManagerMobileShipments,
} from "../utilities/FirebaseFunctions";
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
  "CREATED",
  "PENDING_PICKUP",
  "PICKED_UP",
  "RECEIVED",
  "AVAILABLE",
  "ASSIGNED",
  "LOADED",
  "IN_TRANSIT",
  "ARRIVED_AT_ODIONGAN",
  "READY_FOR_DELIVERY",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
  "DELAYED",
  "FAILED_DELIVERY",
  "RETURNED",
  "CANCELLED",
];

const BOARD_TABS = [
  ["ALL", "All Shipments", "list"],
  ["DIVISORIA", "Divisoria", "home"],
  ["ODIONGAN", "Odiongan", "home"],
  ["DELIVERY", "Delivery Operations", "truck"],
  ["PICKUPS", "Pickups", "map-pin"],
];

const PICKUP_STATUSES = new Set([
  "PENDING_PICKUP",
  "PICKUP_APPROVED",
  "PICKUP_ASSIGNED",
  "PICKED_UP",
]);

function shipmentLocationText(shipment = {}) {
  return [
    shipment.origin,
    shipment.originCode,
    shipment.destination,
    shipment.destinationCode,
    shipment.currentLocation,
    shipment.currentLocationState,
    shipment.warehouse,
    shipment.warehouseCode,
    shipment.custodyOwnerId,
  ]
    .filter(Boolean)
    .join(" ")
    .toUpperCase();
}

function matchesBoardTab(shipment, tab) {
  if (tab === "ALL") return true;
  if (tab === "PICKUPS") {
    const status = String(shipment.status || "").toUpperCase();
    const shipmentType = String(
      shipment.shipmentType ||
        shipment.serviceType ||
        shipment.requestType ||
        shipment.fulfillmentType ||
        "",
    ).toUpperCase();
    return (
      PICKUP_STATUSES.has(status) ||
      shipmentType.includes("PICKUP") ||
      shipment.pickupRequested === true ||
      Boolean(
        shipment.pickupRequestId ||
          shipment.pickupRequestedAt ||
          shipment.pickupAddress ||
          shipment.pickupSchedule,
      )
    );
  }
  if (tab === "DELIVERY") {
    return (
      Array.isArray(shipment.deliveryOperationPieces) &&
      shipment.deliveryOperationPieces.length > 0
    );
  }
  return shipmentLocationText(shipment).includes(tab);
}

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

function deliveryCheckerKey(piece = {}) {
  return String(piece.checkerId || piece.checkerName || "checker")
    .trim()
    .toLowerCase();
}

function deliveryPieceBucket(piece = {}) {
  const status = String(piece.status || "").trim().toUpperCase();
  if (["DELIVERED", "COMPLETED"].includes(status)) return "delivered";
  if (
    [
      "FAILED_DELIVERY",
      "RETURNED_TO_WAREHOUSE",
      "RETURNED_RECEIVED_AT_HUB",
      "RETURNED_RECEIVED_AT_ODIONGAN",
    ].includes(status)
  ) {
    return "returnedFailed";
  }
  return "outForDelivery";
}

export default function ManagerShipmentsScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { role } = useAuth();
  const canDelete = role === "admin";
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("ALL");
  const [boardTab, setBoardTab] = useState("ALL");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [municipality, setMunicipality] = useState("");
  const [checker, setChecker] = useState("");
  const [driver, setDriver] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [deliveryChecker, setDeliveryChecker] = useState("all");
  const [createVisible, setCreateVisible] = useState(false);
  const [selectedShipment, setSelectedShipment] = useState(null);
  const { data, loading, refreshing, error, reload } = useManagerRequest(
    listManagerMobileShipments,
    { limit: 500 },
  );

  const shipments = useMemo(() => {
    const term = search.trim().toLowerCase();
    const start = startDate ? new Date(`${startDate}T00:00:00`) : null;
    const end = endDate ? new Date(`${endDate}T23:59:59`) : null;
    return (data?.shipments || []).filter((shipment) => {
      if (!matchesBoardTab(shipment, boardTab)) return false;
      if (
        boardTab === "DELIVERY" &&
        deliveryChecker !== "all" &&
        !(shipment.deliveryOperationPieces || []).some(
          (piece) => deliveryCheckerKey(piece) === deliveryChecker,
        )
      ) {
        return false;
      }
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
  }, [data, boardTab, deliveryChecker, search, status, startDate, endDate, municipality, checker, driver]);

  const boardCounts = useMemo(
    () =>
      Object.fromEntries(
        BOARD_TABS.map(([value]) => [
          value,
          (data?.shipments || []).filter((shipment) =>
            matchesBoardTab(shipment, value),
          ).length,
        ]),
      ),
    [data],
  );
  const deliveryCheckerTabs = useMemo(() => {
    const checkerMap = new Map();
    let total = 0;
    (data?.shipments || []).forEach((shipment) => {
      (shipment.deliveryOperationPieces || []).forEach((piece) => {
        const quantity = Math.max(Number(piece.quantity) || 1, 1);
        const key = deliveryCheckerKey(piece);
        const label = piece.checkerName || piece.checkerId || "Checker";
        total += quantity;
        const current = checkerMap.get(key) || { key, label, count: 0 };
        current.count += quantity;
        checkerMap.set(key, current);
      });
    });
    return [
      { key: "all", label: "All Checkers", count: total },
      ...Array.from(checkerMap.values()).sort(
        (left, right) => right.count - left.count,
      ),
    ];
  }, [data?.shipments]);
  const deliveryStats = useMemo(() => {
    const stats = { total: 0, delivered: 0, outForDelivery: 0, returnedFailed: 0 };
    (data?.shipments || []).forEach((shipment) => {
      (shipment.deliveryOperationPieces || []).forEach((piece) => {
        if (
          deliveryChecker !== "all" &&
          deliveryCheckerKey(piece) !== deliveryChecker
        ) {
          return;
        }
        const quantity = Math.max(Number(piece.quantity) || 1, 1);
        const bucket = deliveryPieceBucket(piece);
        stats.total += quantity;
        stats[bucket] += quantity;
      });
    });
    return stats;
  }, [data?.shipments, deliveryChecker]);
  const selectedDeliveryChecker = deliveryCheckerTabs.find(
    (entry) => entry.key === deliveryChecker,
  );
  const selectedDeliveryAreas = useMemo(() => {
    if (deliveryChecker === "all") return [];
    return Array.from(
      new Set(
        (data?.shipments || [])
          .filter((shipment) =>
            (shipment.deliveryOperationPieces || []).some(
              (piece) => deliveryCheckerKey(piece) === deliveryChecker,
            ),
          )
          .map(
            (shipment) =>
              shipment.municipality ||
              shipment.destinationMunicipality ||
              shipment.recipient?.address?.city ||
              shipment.recipient?.city,
          )
          .filter(Boolean),
      ),
    );
  }, [data?.shipments, deliveryChecker]);
  const boardContext = {
    ALL: {
      icon: "package",
      title: "All Shipments",
      subtitle: "Authorized shipment orders across your operational scope",
    },
    DIVISORIA: {
      icon: "home",
      title: "Divisoria Shipments",
      subtitle: "Orders currently assigned to Divisoria operations",
    },
    ODIONGAN: {
      icon: "home",
      title: "Odiongan Shipments",
      subtitle: "Orders currently assigned to Odiongan operations",
    },
    DELIVERY: {
      icon: "truck",
      title: "Delivery Operations",
      subtitle:
        "Show only items scanned and loaded into delivery trucks by checkers.",
    },
    PICKUPS: {
      icon: "map-pin",
      title: "Pickup Shipments",
      subtitle: "Pending, assigned, and completed pickup requests",
    },
  }[boardTab];

  const openDetails = (shipment, activeTab = "status") => {
    setSelectedShipment(null);
    router.push({
      pathname: "/(manager)/shipment-details",
      params: { shipmentId: shipment.id, tab: activeTab },
    });
  };

  const confirmDelete = (shipment) => {
    const label = shipment.trackingNumber || shipment.shipmentId || shipment.id;
    Alert.alert(
      "Delete Shipment",
      `Permanently delete ${label}? This also removes its trip manifest entry and cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteShipment({
                shipmentId: shipment.id,
                reason: "Deleted from Admin mobile shipment board",
              });
              setSelectedShipment(null);
              await reload({ refresh: true });
              Alert.alert("Shipment deleted", `${label} was removed.`);
            } catch (nextError) {
              Alert.alert(
                "Shipment not deleted",
                nextError.message || "Please try again.",
              );
            }
          },
        },
      ],
    );
  };

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
      <FlatList
        style={styles.boardScroll}
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
        ListHeaderComponent={
          <>
      <View
        style={[
          styles.toolbar,
          {
            backgroundColor: colors.surface,
          },
        ]}
      >
        <View
          style={[
            styles.boardTabsWrap,
            { backgroundColor: colors.cardMuted },
          ]}
        >
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.boardTabs}>
            {BOARD_TABS.map(([value, label]) => {
              const active = boardTab === value;
              return (
                <Pressable
                  key={value}
                  onPress={() => setBoardTab(value)}
                  style={[
                    styles.boardTab,
                    active && styles.boardTabActive,
                  ]}
                >
                  <Text style={[styles.boardTabText, { color: active ? "#fff" : colors.textMuted }]}>
                    {label} {boardCounts[value] || 0}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </ScrollView>
      </View>
        <View style={styles.boardSectionTitle}>
          <View style={[styles.boardSectionIcon, { backgroundColor: colors.cardMuted }]}>
            <Feather name={boardContext.icon} size={18} color="#0f766e" />
          </View>
          <View style={styles.cardCopy}>
            <Text style={[styles.boardSectionHeading, { color: colors.text }]}>
              {boardContext.title}
            </Text>
            <Text style={[styles.boardSectionSubtitle, { color: colors.textMuted }]}>
              {boardContext.subtitle}
            </Text>
          </View>
        </View>
        {boardTab === "DELIVERY" ? (
          <View style={[styles.deliveryDashboard, { borderColor: colors.border }]}>
            <View style={styles.deliveryActions}>
              <Pressable
                onPress={() => reload({ refresh: true })}
                style={[styles.deliveryActionButton, { borderColor: colors.border }]}
              >
                <Feather name="refresh-cw" size={14} color="#2563eb" />
                <Text style={[styles.deliveryActionText, { color: colors.text }]}>
                  Refresh
                </Text>
              </Pressable>
              <Pressable
                onPress={() =>
                  router.push(
                    role === "manager"
                      ? "/(manager)/management/municipalities"
                      : "/(checker)/(tabs)/quick/management/municipalities",
                  )
                }
                style={[styles.deliveryActionButton, styles.assignAreasButton, { borderColor: colors.border }]}
              >
                <Feather name="map" size={14} color="#2563eb" />
                <Text style={[styles.deliveryActionText, { color: colors.text }]}>
                  Assign checker municipalities
                </Text>
              </Pressable>
            </View>
            <View style={styles.checkerFilterHeading}>
              <Feather name="user-check" size={14} color={colors.textMuted} />
              <Text style={[styles.checkerFilterLabel, { color: colors.textMuted }]}>
                FILTER BY CHECKER
              </Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={[styles.checkerTabs, { backgroundColor: colors.cardMuted }]}>
                {deliveryCheckerTabs.map((entry) => {
                  const active = deliveryChecker === entry.key;
                  return (
                    <Pressable
                      key={entry.key}
                      onPress={() => setDeliveryChecker(entry.key)}
                      style={[
                        styles.checkerTab,
                        {
                          backgroundColor: active ? colors.surface : "transparent",
                          borderColor: active ? "#93c5fd" : "transparent",
                        },
                      ]}
                    >
                      <Text style={[styles.checkerTabText, { color: active ? colors.text : colors.textMuted }]}>
                        {entry.label}
                      </Text>
                      <View style={styles.checkerCount}>
                        <Text style={styles.checkerCountText}>{entry.count}</Text>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            </ScrollView>
            <Text style={[styles.deliveryAreaCopy, { color: colors.textMuted }]}>
              {deliveryChecker === "all"
                ? "Select a checker above to view their assigned delivery areas."
                : `${selectedDeliveryChecker?.label || "Checker"} delivery areas: ${
                    selectedDeliveryAreas.join(", ") || "No assigned areas found"
                  }`}
            </Text>
            <View style={styles.deliveryStatsGrid}>
              {[
                ["TOTAL PACKAGES", deliveryStats.total, "#2563eb", "package"],
                ["DELIVERED", deliveryStats.delivered, "#059669", "check"],
                ["OUT FOR DELIVERY", deliveryStats.outForDelivery, "#d97706", "truck"],
                ["RETURNED / FAILED", deliveryStats.returnedFailed, "#7c3aed", "rotate-ccw"],
              ].map(([label, value, color, icon]) => (
                <View
                  key={label}
                  style={[
                    styles.deliveryStat,
                    { backgroundColor: `${color}12`, borderColor: `${color}35` },
                  ]}
                >
                  <View style={styles.deliveryStatTop}>
                    <Text style={[styles.deliveryStatLabel, { color }]}>{label}</Text>
                    <Feather name={icon} size={17} color={color} />
                  </View>
                  <Text style={[styles.deliveryStatValue, { color }]}>{value}</Text>
                  <Text style={[styles.deliveryStatPercent, { color }]}>
                    {label === "TOTAL PACKAGES"
                      ? "Packages"
                      : `${deliveryStats.total ? ((Number(value) / deliveryStats.total) * 100).toFixed(1) : "0.0"}% of total`}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}
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
          <Pressable
            accessibilityLabel="Shipment filters"
            onPress={() => setFiltersOpen((current) => !current)}
            style={[
              styles.filterButton,
              filtersOpen && styles.filterButtonActive,
            ]}
          >
            <Feather
              name="sliders"
              size={17}
              color={filtersOpen ? "#fff" : colors.textMuted}
            />
          </Pressable>
        </View>
        {filtersOpen ? (
          <View
            style={[
              styles.filterPanel,
              { borderColor: colors.border, backgroundColor: colors.cardMuted },
            ]}
          >
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
            <Pressable
              onPress={() => {
                setStatus("ALL");
                setStartDate("");
                setEndDate("");
                setMunicipality("");
                setChecker("");
                setDriver("");
              }}
              style={styles.clearFilters}
            >
              <Text style={styles.clearFiltersText}>Clear filters</Text>
            </Pressable>
          </View>
        ) : null}
      </View>
          </>
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() =>
              openDetails(item)
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
                    setSelectedShipment(item);
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
      <ShipmentActionSheet
        shipment={selectedShipment}
        colors={colors}
        onClose={() => setSelectedShipment(null)}
        onOpen={(tabName) => selectedShipment && openDetails(selectedShipment, tabName)}
        canDelete={canDelete}
        onDelete={() => selectedShipment && confirmDelete(selectedShipment)}
      />
    </View>
  );
}

function ShipmentActionSheet({ shipment, colors, onClose, onOpen, canDelete, onDelete }) {
  const actions = [
    ["status", "View shipment details", "file-text", "Status, customer, route, custody, and timeline"],
    ["items", "View items and pieces", "package", "Package breakdown and piece statuses"],
    ["actions", "Shipment actions", "tool", "Status override, returns, release, reconcile, print, and edit"],
  ];
  return (
    <Modal visible={Boolean(shipment)} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.sheetBackdrop} onPress={onClose}>
        <Pressable style={[styles.sheet, { backgroundColor: colors.surface }]} onPress={() => {}}>
          <View style={styles.sheetHandle} />
          <Text style={[styles.sheetTitle, { color: colors.text }]} numberOfLines={1}>
            {shipment?.trackingNumber || shipment?.shipmentId || shipment?.id}
          </Text>
          <Text style={[styles.sheetSubtitle, { color: colors.textMuted }]}>
            Select the same shipment workspace used by the web board.
          </Text>
          {actions.map(([tabName, label, icon, description]) => (
            <Pressable
              key={tabName}
              onPress={() => onOpen(tabName)}
              style={[styles.sheetAction, { borderTopColor: colors.border }]}
            >
              <View style={[styles.sheetIcon, { backgroundColor: colors.primarySoft }]}>
                <Feather name={icon} size={19} color="#2563eb" />
              </View>
              <View style={styles.cardCopy}>
                <Text style={[styles.sheetActionTitle, { color: colors.text }]}>{label}</Text>
                <Text style={[styles.sheetActionCopy, { color: colors.textMuted }]}>{description}</Text>
              </View>
              <Feather name="chevron-right" size={20} color={colors.textMuted} />
            </Pressable>
          ))}
          {canDelete ? (
            <Pressable
              onPress={onDelete}
              style={[styles.deleteAction, { borderTopColor: colors.border }]}
            >
              <View style={styles.deleteIcon}>
                <Feather name="trash-2" size={19} color="#dc2626" />
              </View>
              <View style={styles.cardCopy}>
                <Text style={styles.deleteTitle}>Delete Shipment</Text>
                <Text style={[styles.sheetActionCopy, { color: colors.textMuted }]}>
                  Permanently remove this shipment and its manifest reference.
                </Text>
              </View>
            </Pressable>
          ) : null}
        </Pressable>
      </Pressable>
    </Modal>
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
  boardScroll: { flex: 1, minHeight: 0 },
  toolbar: { padding: 13, gap: 10 },
  filters: {
    paddingHorizontal: 0,
    paddingTop: 10,
    paddingBottom: 12,
    gap: 10,
  },
  boardTabsWrap: { borderRadius: 13, padding: 4, overflow: "hidden" },
  boardTabs: { flexDirection: "row", gap: 3 },
  boardTab: { minWidth: 110, minHeight: 38, borderRadius: 10, paddingHorizontal: 10, alignItems: "center", justifyContent: "center" },
  boardTabActive: { backgroundColor: "#0f766e" },
  boardTabText: { fontSize: 11, fontWeight: "900" },
  boardSectionTitle: { minHeight: 52, flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 2, paddingVertical: 4 },
  boardSectionIcon: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  boardSectionHeading: { fontSize: 14, fontWeight: "900" },
  boardSectionSubtitle: { fontSize: 9, lineHeight: 14, marginTop: 2 },
  deliveryDashboard: { borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, paddingVertical: 11, gap: 11 },
  deliveryActions: { flexDirection: "row", gap: 7 },
  deliveryActionButton: { minHeight: 38, borderWidth: 1, borderRadius: 10, paddingHorizontal: 10, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
  assignAreasButton: { flex: 1 },
  deliveryActionText: { fontSize: 9, fontWeight: "900" },
  checkerFilterHeading: { flexDirection: "row", alignItems: "center", gap: 7 },
  checkerFilterLabel: { fontSize: 9, fontWeight: "900", letterSpacing: 0.5 },
  checkerTabs: { flexDirection: "row", borderRadius: 12, padding: 4, gap: 4 },
  checkerTab: { minWidth: 128, minHeight: 42, borderWidth: 1, borderRadius: 10, paddingHorizontal: 10, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7 },
  checkerTabText: { maxWidth: 92, fontSize: 10, fontWeight: "900" },
  checkerCount: { minWidth: 25, height: 20, borderRadius: 10, paddingHorizontal: 6, backgroundColor: "#dbeafe", alignItems: "center", justifyContent: "center" },
  checkerCountText: { color: "#1d4ed8", fontSize: 9, fontWeight: "900" },
  deliveryAreaCopy: { fontSize: 9, lineHeight: 14 },
  deliveryStatsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  deliveryStat: { width: "48.7%", minHeight: 112, borderWidth: 1, borderRadius: 14, padding: 12 },
  deliveryStatTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 7 },
  deliveryStatLabel: { flex: 1, fontSize: 8, fontWeight: "900" },
  deliveryStatValue: { fontSize: 25, lineHeight: 30, fontWeight: "900", marginTop: 10 },
  deliveryStatPercent: { fontSize: 9, marginTop: 4 },
  search: {
    minHeight: 45,
    borderRadius: 13,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
  },
  searchInput: { flex: 1, padding: 0, fontSize: 13 },
  filterButton: { width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  filterButtonActive: { backgroundColor: "#0f766e" },
  filterPanel: { borderWidth: 1, borderRadius: 14, padding: 11, gap: 10 },
  clearFilters: { alignSelf: "flex-end", paddingVertical: 5 },
  clearFiltersText: { color: "#0f766e", fontSize: 10, fontWeight: "900" },
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
  emptyList: { flexGrow: 1, padding: 14, gap: 11 },
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
  sheetBackdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(15,23,42,0.55)" },
  sheet: { borderTopLeftRadius: 26, borderTopRightRadius: 26, paddingHorizontal: 18, paddingTop: 10, paddingBottom: 28 },
  sheetHandle: { alignSelf: "center", width: 42, height: 5, borderRadius: 3, backgroundColor: "#94a3b8", marginBottom: 14 },
  sheetTitle: { fontSize: 17, fontWeight: "900" },
  sheetSubtitle: { fontSize: 11, lineHeight: 16, marginTop: 3, marginBottom: 10 },
  sheetAction: { minHeight: 76, borderTopWidth: StyleSheet.hairlineWidth, flexDirection: "row", alignItems: "center", gap: 11 },
  sheetIcon: { width: 42, height: 42, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  sheetActionTitle: { fontSize: 13, fontWeight: "900" },
  sheetActionCopy: { fontSize: 10, lineHeight: 15, marginTop: 3 },
  deleteAction: { minHeight: 72, borderTopWidth: StyleSheet.hairlineWidth, flexDirection: "row", alignItems: "center", gap: 11 },
  deleteIcon: { width: 42, height: 42, borderRadius: 13, backgroundColor: "#fef2f2", alignItems: "center", justifyContent: "center" },
  deleteTitle: { color: "#dc2626", fontSize: 13, fontWeight: "900" },
});
