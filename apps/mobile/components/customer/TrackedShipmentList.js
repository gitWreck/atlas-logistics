import React, { useMemo, useState } from "react";
import {
  ScrollView,
  Image,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Feather from "@expo/vector-icons/Feather";

import { getFormattedTime } from "../utilities/helpers";
import { useTheme } from "../../contexts/ThemeContext";

const emptyShipmentArt = require("../../assets/customer/empty-active-shipment.png");

const FILTER_OPTIONS = [
  { label: "All", value: "ALL" },
  { label: "Active", value: "ACTIVE" },
  { label: "Pending", value: "PENDING" },
  { label: "In Transit", value: "IN_TRANSIT" },
  { label: "Delivered", value: "DELIVERED" },
];

const normalizeStatus = (status) => String(status || "PENDING").toUpperCase();

const INACTIVE_SHIPMENT_STATUSES = new Set([
  "DELIVERED",
  "COMPLETED",
  "CANCELLED",
  "RECEIVED",
  "RECEIVED_AT_DIVISORIA",
]);

function getStatusLabel(status) {
  const current = normalizeStatus(status);
  const labels = {
    PENDING_PICKUP: "PENDING PICKUP",
    IN_TRANSIT: "IN TRANSIT",
    OUT_FOR_DELIVERY: "OUT FOR DELIVERY",
    COMPLETED: "DELIVERED",
    RECEIVED: "DELIVERED",
    RECEIVED_AT_DIVISORIA: "DELIVERED",
  };
  return labels[current] || current.replace(/_/g, " ");
}

function getStatusTheme(status, colors) {
  const current = normalizeStatus(status);
  if (current === "PENDING_PICKUP") {
    return { bg: colors.warningSoft, text: colors.warning, border: colors.warning };
  }
  if (current === "ACTIVE" || current === "IN_TRANSIT" || current === "OUT_FOR_DELIVERY") {
    return { bg: colors.successSoft, text: colors.success, border: colors.success };
  }
  if (
    current === "DELIVERED" ||
    current === "COMPLETED" ||
    current === "RECEIVED" ||
    current === "RECEIVED_AT_DIVISORIA"
  ) {
    return {
      bg: colors.neutralSoft,
      text: colors.neutral,
      border: colors.neutralBorder,
    };
  }
  if (current === "CANCELLED" || current === "FAILED_DELIVERY") {
    return { bg: colors.dangerSoft, text: colors.danger, border: colors.danger };
  }
  if (current === "RETURNED" || current.startsWith("RETURNED_")) {
    return { bg: colors.orangeSoft, text: colors.orange, border: colors.orangeBorder };
  }
  return { bg: colors.warningSoft, text: colors.warning, border: colors.warning };
}

function CompactStatusBadge({ status }) {
  const { colors } = useTheme();
  const theme = getStatusTheme(status, colors);

  return (
    <View
      style={[
        styles.statusBadge,
        { backgroundColor: theme.bg, borderColor: theme.border },
      ]}
    >
      <Text style={[styles.statusBadgeText, { color: theme.text }]} numberOfLines={1}>
        {getStatusLabel(status)}
      </Text>
    </View>
  );
}

export default function TrackedShipmentList({
  shipments,
  onShipmentPress,
  onCreateShipment,
  activeFilter = "ALL",
  onFilterChange,
  sortOrder = "LATEST",
}) {
  const { colors } = useTheme();
  const [searchText, setSearchText] = useState("");

  const filteredShipments = useMemo(() => {
    let filtered = shipments || [];

    if (activeFilter === "ACTIVE") {
      filtered = filtered.filter((s) => {
        const status = normalizeStatus(s.status);
        return !INACTIVE_SHIPMENT_STATUSES.has(status);
      });
    } else if (activeFilter === "DELIVERED") {
      filtered = filtered.filter((s) => {
        const status = normalizeStatus(s.status);
        return (
          status === "DELIVERED" ||
          status === "COMPLETED" ||
          status === "RECEIVED" ||
          status === "RECEIVED_AT_DIVISORIA"
        );
      });
    } else if (activeFilter === "PENDING") {
      filtered = filtered.filter((s) => normalizeStatus(s.status).includes("PENDING"));
    } else if (activeFilter === "IN_TRANSIT") {
      filtered = filtered.filter((s) => {
        const status = normalizeStatus(s.status);
        return status === "IN_TRANSIT" || status === "OUT_FOR_DELIVERY";
      });
    } else if (activeFilter === "CANCELLED") {
      filtered = filtered.filter((s) => {
        const status = normalizeStatus(s.status);
        return status === "CANCELLED" || status === "FAILED_DELIVERY";
      });
    }

    if (searchText.trim()) {
      const term = searchText.toLowerCase().trim();
      filtered = filtered.filter((s) => {
        const trackingText = String(
          s.trackingNumber || s.shipmentId || s.id || "",
        ).toLowerCase();
        const destText = String(
          s.destination || s.recipient?.address?.city || "",
        ).toLowerCase();
        const originText = String(
          s.origin || s.sender?.address?.city || "",
        ).toLowerCase();
        const nameText = String(
          s.recipient?.name || s.receiverName || "",
        ).toLowerCase();

        return (
          trackingText.includes(term) ||
          destText.includes(term) ||
          originText.includes(term) ||
          nameText.includes(term)
        );
      });
    }

    const getSortTime = (shipment) => {
      const raw =
        shipment.rawUpdatedAt ||
        shipment.updatedAt ||
        shipment.rawCreatedAt ||
        shipment.createdAt;
      if (!raw) return 0;
      const date = raw.toDate ? raw.toDate() : new Date(raw);
      const time = date?.getTime?.();
      return Number.isFinite(time) ? time : 0;
    };

    return [...filtered].sort((a, b) => {
      const diff = getSortTime(b) - getSortTime(a);
      return sortOrder === "OLDEST" ? -diff : diff;
    });
  }, [shipments, searchText, activeFilter, sortOrder]);

  return (
    <View style={styles.container}>
      <View
        style={[
          styles.searchContainer,
          {
            backgroundColor: colors.dashboardSurfaceMuted,
            borderColor: colors.dashboardBorder,
          },
        ]}
      >
        <Feather name="search" size={16} color={colors.iconMuted} />
        <TextInput
          style={[styles.searchInput, { color: colors.text }]}
          placeholder="Search tracking number, city, name..."
          placeholderTextColor={colors.textMuted}
          value={searchText}
          onChangeText={setSearchText}
        />
        {searchText.length > 0 && (
          <TouchableOpacity onPress={() => setSearchText("")}>
            <Feather name="x-circle" size={16} color={colors.iconMuted} />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filtersContent}
        style={styles.filtersScroll}
      >
        {FILTER_OPTIONS.map((opt) => {
          const isActive = activeFilter === opt.value;
          return (
            <TouchableOpacity
              key={opt.value}
              style={[
                styles.filterChip,
                {
                  backgroundColor: isActive ? colors.primary : colors.dashboardSurfaceMuted,
                  borderColor: isActive ? colors.primary : colors.dashboardBorder,
                },
              ]}
              onPress={() => onFilterChange?.(opt.value)}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.filterText,
                  { color: isActive ? colors.onPrimary : colors.textMuted },
                ]}
              >
                {opt.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
      >
        {!shipments || shipments.length === 0 ? (
          <View style={styles.emptyState}>
            <Image
              source={emptyShipmentArt}
              style={styles.emptyIllustration}
              resizeMode="contain"
            />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>
              No shipments yet
            </Text>
            <Text style={[styles.emptyText, { color: colors.textMuted }]}>
              You don't have any shipments.{"\n"}
              Create your first shipment to{"\n"}
              start tracking.
            </Text>
            {onCreateShipment ? (
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={onCreateShipment}
              >
                <LinearGradient
                  colors={[colors.primary, colors.primaryDeep]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.emptyButton}
                >
                  <Feather name="plus-circle" size={15} color={colors.onPrimary} />
                  <Text style={[styles.emptyButtonText, { color: colors.onPrimary }]}>
                    Create Shipment
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
            ) : null}
          </View>
        ) : filteredShipments.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>
              No matches found
            </Text>
            <Text style={[styles.emptyText, { color: colors.textMuted }]}>
              Try another tracking number, city, or name.
            </Text>
          </View>
        ) : (
          filteredShipments.map((item) => {
            const trackingNumber = item.trackingNumber || item.shipmentId || item.id;
            const origin = item.origin || item.sender?.address?.city || "Origin";
            const destination =
              item.destination || item.recipient?.address?.city || "Destination";
            const recipient = item.recipient?.name || item.receiverName || "Unknown";
            const status = normalizeStatus(item.status);
            const dateLabel =
              status === "DELIVERED" ||
              status === "COMPLETED" ||
              status === "RECEIVED" ||
              status === "RECEIVED_AT_DIVISORIA"
                ? "Delivered"
                : item.rawUpdatedAt || item.updatedAt
                  ? "Updated"
                  : "Created";

            return (
              <TouchableOpacity
                key={item.id}
                style={[
                  styles.shipmentCard,
                  {
                    backgroundColor: colors.dashboardSurface,
                    borderColor: colors.dashboardBorder,
                    shadowColor: colors.dashboardShadow,
                  },
                ]}
                activeOpacity={0.86}
                onPress={() => onShipmentPress(item)}
              >
                <View style={styles.cardHeader}>
                  <View style={styles.trackingRow}>
                    <View style={[styles.packageIcon, { backgroundColor: colors.primary }]}>
                      <Feather name="package" size={14} color={colors.onPrimary} />
                    </View>
                    <Text
                      style={[styles.trackingValue, { color: colors.primary }]}
                      numberOfLines={1}
                    >
                      {trackingNumber}
                    </Text>
                  </View>
                  <CompactStatusBadge status={item.status} />
                </View>

                <View style={styles.infoStack}>
                  <View style={styles.infoRow}>
                    <Feather name="map-pin" size={13} color={colors.iconMuted} />
                    <Text
                      style={[styles.routeText, { color: colors.text }]}
                      numberOfLines={1}
                    >
                      {origin} {"\u2192"} {destination}
                    </Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Feather name="user" size={13} color={colors.iconMuted} />
                    <Text
                      style={[styles.infoText, { color: colors.text }]}
                      numberOfLines={1}
                    >
                      To: {recipient}
                    </Text>
                  </View>
                </View>

                <View style={[styles.cardFooter, { borderTopColor: colors.dashboardBorder }]}>
                  <Text style={[styles.footerDate, { color: colors.textMuted }]} numberOfLines={1}>
                    {dateLabel}: {getFormattedTime(item.rawUpdatedAt || item.updatedAt || item.rawCreatedAt || item.createdAt)}
                  </Text>
                  <View style={styles.detailsRow}>
                    <Text style={[styles.detailsText, { color: colors.primary }]}>
                      View Details
                    </Text>
                    <Feather name="chevron-right" size={15} color={colors.iconMuted} />
                  </View>
                </View>
              </TouchableOpacity>
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
  searchContainer: {
    height: 42,
    borderRadius: 11,
    borderWidth: 1,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 11,
  },
  searchInput: {
    flex: 1,
    marginLeft: 10,
    fontSize: 13,
    fontWeight: "400",
  },
  filtersScroll: {
    flexGrow: 0,
    marginBottom: 12,
  },
  filtersContent: {
    gap: 9,
    paddingRight: 6,
  },
  filterChip: {
    height: 31,
    minWidth: 58,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  filterText: {
    fontSize: 12,
    fontWeight: "700",
  },
  listContent: {
    paddingBottom: 118,
    flexGrow: 1,
  },
  emptyState: {
    alignItems: "center",
    paddingTop: 68,
    paddingHorizontal: 24,
  },
  emptyIllustration: {
    width: 154,
    height: 142,
    marginBottom: 4,
  },
  emptyTitle: {
    marginTop: 8,
    fontSize: 18,
    fontWeight: "700",
    textAlign: "center",
  },
  emptyText: {
    marginTop: 10,
    fontSize: 14,
    textAlign: "center",
    lineHeight: 22,
    maxWidth: 280,
  },
  emptyButton: {
    marginTop: 26,
    width: 220,
    height: 42,
    borderRadius: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  emptyButtonText: {
    fontSize: 14,
    fontWeight: "700",
    textAlign: "center",
  },
  shipmentCard: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 13,
    paddingTop: 12,
    paddingBottom: 10,
    marginBottom: 10,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
    elevation: 1,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10,
    marginBottom: 10,
  },
  trackingRow: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
  },
  packageIcon: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
  },
  trackingValue: {
    flex: 1,
    fontSize: 14,
    fontWeight: "700",
  },
  statusBadge: {
    maxWidth: 94,
    minHeight: 24,
    borderRadius: 6,
    borderWidth: 1,
    paddingHorizontal: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  statusBadgeText: {
    fontSize: 9,
    fontWeight: "800",
  },
  infoStack: {
    gap: 7,
    marginBottom: 11,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  routeText: {
    flex: 1,
    fontSize: 13,
    fontWeight: "700",
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    fontWeight: "500",
  },
  cardFooter: {
    borderTopWidth: 1,
    paddingTop: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  footerDate: {
    flex: 1,
    fontSize: 11,
    fontWeight: "500",
  },
  detailsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  detailsText: {
    fontSize: 11,
    fontWeight: "700",
  },
});
