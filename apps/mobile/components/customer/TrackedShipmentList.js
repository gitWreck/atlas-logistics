import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  TextInput,
} from "react-native";
import { FontAwesome5 } from "@expo/vector-icons";
import StatusBadge from "../ui/StatusBadge";
import { getFormattedTime } from "../utilities/helpers";
import { useTheme } from "../../contexts/ThemeContext";

const FILTER_OPTIONS = [
  { label: "All", value: "ALL" },
  { label: "Active", value: "ACTIVE" },
  { label: "Delivered", value: "DELIVERED" },
];

export default function TrackedShipmentList({ shipments, onShipmentPress }) {
  const { colors } = useTheme();
  const [searchText, setSearchText] = useState("");
  const [activeFilter, setActiveFilter] = useState("ALL");

  const filteredShipments = useMemo(() => {
    let filtered = shipments || [];

    // 1. Apply Filter Toggle
    if (activeFilter === "ACTIVE") {
      filtered = filtered.filter(
        (s) => s.status !== "DELIVERED" && s.status !== "CANCELLED",
      );
    } else if (activeFilter === "DELIVERED") {
      filtered = filtered.filter((s) => s.status === "DELIVERED");
    }

    // 2. Apply Text Search
    if (searchText.trim()) {
      const term = searchText.toLowerCase().trim();
      filtered = filtered.filter((s) => {
        const trackingText = String(
          s.trackingNumber || s.shipmentId || s.id || "",
        ).toLowerCase();
        const destText = String(
          s.destination || s.recipient?.address?.city || "",
        ).toLowerCase();
        const nameText = String(
          s.recipient?.name || s.receiverName || "",
        ).toLowerCase();

        return (
          trackingText.includes(term) ||
          destText.includes(term) ||
          nameText.includes(term)
        );
      });
    }

    return filtered;
  }, [shipments, searchText, activeFilter]);

  // List State
  return (
    <View style={styles.container}>
      <View style={styles.sectionHeaderRow}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          My Shipments
        </Text>
      </View>

      {/* Search Bar */}
      <View style={styles.searchRow}>
        <View
          style={[
            styles.searchContainer,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <FontAwesome5 name="search" size={14} color={colors.textMuted} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            placeholder="Search tracking, city, name..."
            placeholderTextColor={colors.textMuted}
            value={searchText}
            onChangeText={setSearchText}
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
      </View>

      {/* Filters Toggle */}
      <View style={styles.tabsContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabsContent}
        >
          {FILTER_OPTIONS.map((opt) => {
            const isActive = activeFilter === opt.value;
            return (
              <TouchableOpacity
                key={opt.value}
                style={[
                  styles.tabChip,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                  },
                  isActive && styles.tabChipActive,
                ]}
                onPress={() => setActiveFilter(opt.value)}
              >
                <Text
                  style={[
                    styles.tabChipText,
                    { color: colors.textMuted },
                    isActive && styles.tabChipTextActive,
                  ]}
                >
                  {opt.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <ScrollView contentContainerStyle={styles.listContent}>
        {!shipments || shipments.length === 0 ? (
          <View style={styles.emptyState}>
            <FontAwesome5
              name="box-open"
              size={40}
              color={colors.textMuted}
              style={{ marginBottom: 12 }}
            />
            <Text style={[styles.emptyText, { color: colors.textMuted }]}>
              You haven’t added any shipments yet.
            </Text>
          </View>
        ) : filteredShipments.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={[styles.emptyText, { color: colors.textMuted }]}>
              No shipments match your search.
            </Text>
          </View>
        ) : (
          filteredShipments.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={[
                styles.shipmentCard,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
              activeOpacity={0.85}
              onPress={() => onShipmentPress(item)}
            >
              {/* Header: Tracking Badge */}
              <View style={styles.cardHeader}>
                <View
                  style={[styles.idBox, { backgroundColor: colors.cardMuted }]}
                >
                  <FontAwesome5 name="box" size={12} color="#067FC6" />
                  <Text style={styles.trackingValue}>
                    {item.trackingNumber || item.shipmentId || item.id}
                  </Text>
                </View>
                <StatusBadge status={item.status} />
              </View>

              {/* Body: High-level Route/Details */}
              <View style={styles.cardBody}>
                <View style={styles.infoRow}>
                  <FontAwesome5
                    name="map-marker-alt"
                    size={12}
                    color={colors.textMuted}
                    style={styles.infoIcon}
                  />
                  <Text
                    style={[styles.infoText, { color: colors.text }]}
                    numberOfLines={1}
                  >
                    {item.origin || item.sender?.address?.city || "Origin"}
                    {" ➔ "}
                    {item.destination ||
                      item.recipient?.address?.city ||
                      "Destination"}
                  </Text>
                </View>
                <View style={styles.infoRow}>
                  <FontAwesome5
                    name="user"
                    size={12}
                    color={colors.textMuted}
                    style={styles.infoIcon}
                  />
                  <Text
                    style={[styles.infoText, { color: colors.text }]}
                    numberOfLines={1}
                  >
                    To: {item.recipient?.name || item.receiverName || "Unknown"}
                  </Text>
                </View>
                {(item.totalItems > 0 || item.packageCount > 0) && (
                  <View style={styles.infoRow}>
                    <FontAwesome5
                      name="cube"
                      size={12}
                      color={colors.textMuted}
                      style={styles.infoIcon}
                    />
                    <Text
                      style={[styles.infoText, { color: colors.text }]}
                      numberOfLines={1}
                    >
                      {item.totalItems || item.packageCount} Items
                    </Text>
                  </View>
                )}
              </View>

              {/* Bottom Row: Hint & Time */}
              <View
                style={[
                  styles.cardBottomRow,
                  { borderTopColor: colors.border },
                ]}
              >
                <Text style={[styles.trackingHint, { color: colors.textMuted }]}>
                  Tap to view live status...
                </Text>
                <Text style={[styles.timeText, { color: colors.textMuted }]}>
                  {getFormattedTime(item.rawUpdatedAt || item.updatedAt)}
                </Text>
              </View>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#0f172a",
    marginBottom: 8,
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  searchContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff",
    paddingHorizontal: 16,
    borderRadius: 12,
    height: 44,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  searchInput: {
    flex: 1,
    color: "#0f172a",
    marginLeft: 10,
    fontSize: 14,
  },
  tabsContainer: {
    marginBottom: 16,
  },
  tabsContent: {
    gap: 8,
  },
  tabChip: {
    paddingHorizontal: 16,
    height: 32,
    borderRadius: 999,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    alignItems: "center",
    justifyContent: "center",
  },
  tabChipActive: {
    backgroundColor: "#0f172a",
    borderColor: "#0f172a",
  },
  tabChipText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#475569",
  },
  tabChipTextActive: {
    color: "#ffffff",
  },
  emptyState: {
    alignItems: "center",
    marginTop: 40,
    paddingHorizontal: 12,
  },
  emptyText: {
    color: "#64748b",
    fontSize: 14,
    textAlign: "center",
    marginBottom: 4,
  },
  emptyTextMuted: {
    color: "#94a3b8",
    fontSize: 13,
    textAlign: "center",
  },
  listContent: {
    paddingBottom: 24,
  },
  shipmentCard: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    marginBottom: 12,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  idBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#f0f9ff",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  trackingValue: {
    fontSize: 14,
    fontWeight: "700",
    color: "#067FC6",
  },
  cardBody: {
    marginBottom: 12,
    gap: 6,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  infoIcon: {
    width: 16,
    textAlign: "center",
    marginRight: 6,
  },
  infoText: {
    fontSize: 13,
    color: "#334155",
    flex: 1,
  },
  trackingHint: {
    fontSize: 12,
    color: "#64748b",
  },
  cardBottomRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
    paddingTop: 12,
  },
  timeText: {
    fontSize: 11,
    color: "#94a3b8",
    fontWeight: "600",
  },
});
