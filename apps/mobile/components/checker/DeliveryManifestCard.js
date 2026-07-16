import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from "react-native";
import { FontAwesome5 } from "@expo/vector-icons";
import StatusBadge from "../ui/StatusBadge";

function getTimeLabel(value) {
  if (!value) return "Not loaded yet";
  const date =
    typeof value?.toDate === "function"
      ? value.toDate()
      : value?._seconds
        ? new Date(value._seconds * 1000)
        : new Date(value);
  if (Number.isNaN(date.getTime())) return "Not loaded yet";
  return date.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function MetaRow({ icon, label, value, colors }) {
  return (
    <View style={styles.metaRow}>
      <FontAwesome5 name={icon} size={11} color={colors.textMuted} />
      <Text style={[styles.metaLabel, { color: colors.textMuted }]}>
        {label}
      </Text>
      <Text style={[styles.metaValue, { color: colors.text }]} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

export default function DeliveryManifestCard({
  manifest,
  colors,
  onPressShipment,
  onPressCard,
  defaultExpanded = false,
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  const vehicleLabel =
    manifest.deliveryVehicleName ||
    manifest.deliveryVehicleId ||
    "Vehicle not assigned";
  const checkerLabel = manifest.checkerName || "Checker";
  const releasedBy = manifest.releasedByName || "Warehouse manager";
  const loadedBy = manifest.updatedBy || checkerLabel;

  const stats = manifest.stats || {};
  const total = stats.total || 0;
  const delivered = stats.delivered || 0;
  const progress = total > 0 ? Math.min(1, delivered / total) : 0;
  const progressPct = Math.round(progress * 100);

  const handlePress = () => {
    if (onPressCard) {
      onPressCard();
      return;
    }
    setExpanded((prev) => !prev);
  };

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.surface, borderColor: colors.border },
      ]}
    >
      {/* Header — always visible essentials */}
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={handlePress}
        style={styles.headerTouch}
      >
        <View style={styles.cardHeader}>
          <View style={styles.titleWrap}>
            <View style={styles.titleTextWrap}>
              <Text
                style={[styles.cardTitle, { color: colors.text }]}
                numberOfLines={1}
              >
                {checkerLabel}
              </Text>
              <View style={styles.vehicleRow}>
                <FontAwesome5 name="truck" size={10} color={colors.textMuted} />
                <Text
                  style={[styles.vehicleText, { color: colors.textMuted }]}
                  numberOfLines={1}
                >
                  {vehicleLabel}
                </Text>
              </View>
            </View>
          </View>
          <StatusBadge status={manifest.displayStatus || manifest.status} />
        </View>

        {/* Compact progress summary */}
        <View style={styles.progressWrap}>
          <View style={styles.progressLabelRow}>
            <Text style={[styles.progressLabel, { color: colors.textMuted }]}>
              {delivered} of {total} delivered
            </Text>
            <View style={styles.miniStatsRow}>
              {stats.outForDelivery > 0 && (
                <Text style={[styles.miniStat, { color: "#e879f9" }]}>
                  {stats.outForDelivery} out
                </Text>
              )}
              {stats.failed > 0 && (
                <Text style={[styles.miniStat, { color: "#f87171" }]}>
                  {stats.failed} failed
                </Text>
              )}
              {stats.remaining > 0 && (
                <Text style={[styles.miniStat, { color: "#60a5fa" }]}>
                  {stats.remaining} left
                </Text>
              )}
            </View>
          </View>
          <View
            style={[
              styles.progressTrack,
              { backgroundColor: colors.cardMuted, borderColor: colors.border },
            ]}
          >
            <View style={[styles.progressFill, { width: `${progressPct}%` }]} />
          </View>
        </View>

        {/* Expand affordance */}
        <View style={styles.expandRow}>
          <Text style={[styles.expandText, { color: colors.textMuted }]}>
            {expanded ? "Hide details" : "View details"}
          </Text>
          <FontAwesome5
            name={expanded ? "chevron-up" : "chevron-down"}
            size={11}
            color={colors.textMuted}
          />
        </View>
      </TouchableOpacity>

      {/* Expandable details */}
      {expanded && (
        <View style={styles.details}>
          <View style={styles.statsRow}>
            <StatPill label="Total" value={stats.total || 0} colors={colors} />
            <StatPill
              label="Out"
              value={stats.outForDelivery || 0}
              colors={colors}
              accent="#e879f9"
            />
            <StatPill
              label="Done"
              value={stats.delivered || 0}
              colors={colors}
              accent="#4ade80"
            />
            <StatPill
              label="Failed"
              value={stats.failed || 0}
              colors={colors}
              accent="#f87171"
            />
            <StatPill
              label="Left"
              value={stats.remaining || 0}
              colors={colors}
              accent="#60a5fa"
            />
          </View>

          <MetaRow
            icon="warehouse"
            label="Released by"
            value={releasedBy}
            colors={colors}
          />
          <MetaRow
            icon="user-check"
            label="Loaded by"
            value={loadedBy}
            colors={colors}
          />
          <MetaRow
            icon="clock"
            label="Time loaded"
            value={getTimeLabel(manifest.loadedAt || manifest.releasedAt)}
            colors={colors}
          />

          <Text style={[styles.packageHeading, { color: colors.text }]}>
            Loaded packages
          </Text>

          {manifest.shipments.length === 0 ? (
            <Text style={[styles.emptyPackages, { color: colors.textMuted }]}>
              {Array.isArray(manifest.shipmentIds) &&
              manifest.shipmentIds.length > 0
                ? "Loading package details..."
                : "No packages on this manifest yet."}
            </Text>
          ) : (
            manifest.shipments.map((shipment) => (
              <TouchableOpacity
                key={shipment.id}
                style={[
                  styles.packageRow,
                  {
                    borderColor: colors.border,
                    backgroundColor: colors.cardMuted,
                  },
                ]}
                onPress={() => onPressShipment?.(shipment.id)}
                activeOpacity={0.8}
              >
                <View style={styles.packageMain}>
                  <FontAwesome5 name="box" size={11} color={colors.textMuted} />
                  <Text
                    style={[styles.packageId, { color: colors.text }]}
                    numberOfLines={1}
                  >
                    {shipment.id}
                  </Text>
                </View>
                <StatusBadge
                  status={
                    shipment.displayStatus || shipment.status || "ASSIGNED"
                  }
                />
              </TouchableOpacity>
            ))
          )}
        </View>
      )}
    </View>
  );
}

function StatPill({ label, value, colors, accent }) {
  return (
    <View
      style={[
        styles.statPill,
        { backgroundColor: colors.cardMuted, borderColor: colors.border },
      ]}
    >
      <Text style={[styles.statValue, { color: accent || colors.text }]}>
        {value}
      </Text>
      <Text style={[styles.statLabel, { color: colors.textMuted }]}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
  },
  headerTouch: {
    gap: 12,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 10,
  },
  titleWrap: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  titleTextWrap: {
    flex: 1,
    gap: 3,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: "800",
  },
  vehicleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  vehicleText: {
    flex: 1,
    fontSize: 12,
    fontWeight: "600",
  },
  progressWrap: {
    gap: 6,
  },
  progressLabelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  progressLabel: {
    fontSize: 12,
    fontWeight: "700",
  },
  miniStatsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flexShrink: 1,
  },
  miniStat: {
    fontSize: 11,
    fontWeight: "700",
  },
  progressTrack: {
    height: 6,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: "#4ade80",
  },
  expandRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingTop: 2,
  },
  expandText: {
    fontSize: 12,
    fontWeight: "700",
  },
  details: {
    marginTop: 12,
    gap: 8,
  },
  statsRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 4,
  },
  statPill: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 8,
    alignItems: "center",
  },
  statValue: {
    fontSize: 16,
    fontWeight: "800",
  },
  statLabel: {
    fontSize: 10,
    fontWeight: "600",
    marginTop: 2,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  metaLabel: {
    width: 88,
    fontSize: 12,
    fontWeight: "600",
  },
  metaValue: {
    flex: 1,
    fontSize: 12,
    fontWeight: "500",
  },
  packageHeading: {
    marginTop: 6,
    fontSize: 13,
    fontWeight: "800",
  },
  emptyPackages: {
    fontSize: 12,
    fontStyle: "italic",
    paddingVertical: 8,
  },
  packageRow: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  packageMain: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  packageId: {
    flex: 1,
    fontSize: 12,
    fontWeight: "700",
  },
});
