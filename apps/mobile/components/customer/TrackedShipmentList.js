import React, { useMemo, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import Feather from "@expo/vector-icons/Feather";

import { getFormattedTime } from "../utilities/helpers";
import { useTheme } from "../../contexts/ThemeContext";

const FILTER_OPTIONS = [
  { label: "All", value: "ALL" },
  { label: "Active", value: "ACTIVE" },
  { label: "Pending", value: "PENDING" },
  { label: "In Transit", value: "IN_TRANSIT" },
  { label: "Delivered", value: "DELIVERED" },
];

const normalizeStatus = (status) => String(status || "PENDING").toUpperCase();

function getStatusLabel(status) {
  const current = normalizeStatus(status);
  const labels = {
    PENDING_PICKUP: "PENDING PICKUP",
    IN_TRANSIT: "IN TRANSIT",
    OUT_FOR_DELIVERY: "OUT FOR DELIVERY",
    COMPLETED: "DELIVERED",
  };
  return labels[current] || current.replace(/_/g, " ");
}

function getStatusTheme(status, colors) {
  const current = normalizeStatus(status);
  if (current === "DELIVERED" || current === "COMPLETED") {
    return { bg: colors.successSoft, text: colors.success, border: colors.success };
  }
  if (current === "IN_TRANSIT" || current === "OUT_FOR_DELIVERY") {
    return { bg: colors.successSoft, text: colors.success, border: colors.success };
  }
  if (current === "CANCELLED" || current === "FAILED_DELIVERY") {
    return { bg: colors.dangerSoft, text: colors.danger, border: colors.danger };
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

export default function TrackedShipmentList({ shipments, onShipmentPress }) {
  const { colors } = useTheme();
  const [searchText, setSearchText] = useState("");
  const [activeFilter, setActiveFilter] = useState("ALL");

  const filteredShipments = useMemo(() => {
    let filtered = shipments || [];

    if (activeFilter === "ACTIVE") {
      filtered = filtered.filter((s) => {
        const status = normalizeStatus(s.status);
        return status !== "DELIVERED" && status !== "COMPLETED" && status !== "CANCELLED";
      });
    } else if (activeFilter === "DELIVERED") {
      filtered = filtered.filter((s) => {
        const status = normalizeStatus(s.status);
        return status === "DELIVERED" || status === "COMPLETED";
      });
    } else if (activeFilter === "PENDING") {
      filtered = filtered.filter((s) => normalizeStatus(s.status).includes("PENDING"));
    } else if (activeFilter === "IN_TRANSIT") {
      filtered = filtered.filter((s) => {
        const status = normalizeStatus(s.status);
        return status === "IN_TRANSIT" || status === "OUT_FOR_DELIVERY";
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

    return filtered;
  }, [shipments, searchText, activeFilter]);

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
              onPress={() => setActiveFilter(opt.value)}
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
            <Feather name="package" size={34} color={colors.iconMuted} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>
              No shipments yet
            </Text>
            <Text style={[styles.emptyText, { color: colors.textMuted }]}>
              Create a shipment and it will appear here.
            </Text>
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
              status === "DELIVERED" || status === "COMPLETED"
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
  },
  emptyState: {
    alignItems: "center",
    paddingTop: 54,
    paddingHorizontal: 24,
  },
  emptyTitle: {
    marginTop: 12,
    fontSize: 16,
    fontWeight: "700",
  },
  emptyText: {
    marginTop: 5,
    fontSize: 13,
    textAlign: "center",
    lineHeight: 18,
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
