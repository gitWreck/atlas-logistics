import React from "react";
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
}) {
  const vehicleLabel =
    manifest.deliveryVehicleName ||
    manifest.deliveryVehicleId ||
    "Vehicle not assigned";
  const checkerLabel = manifest.checkerName || "Checker";
  const releasedBy = manifest.releasedByName || "Warehouse manager";
  const loadedBy = manifest.updatedBy || checkerLabel;

  return (
    <TouchableOpacity
      activeOpacity={onPressCard ? 0.85 : 1}
      onPress={onPressCard}
      style={[
        styles.card,
        { backgroundColor: colors.surface, borderColor: colors.border },
      ]}
    >
      <View style={styles.cardHeader}>
        <View style={styles.titleWrap}>
          <FontAwesome5 name="shipping-fast" size={14} color="#07B9F4" />
          <Text style={[styles.cardTitle, { color: colors.text }]}>
            {checkerLabel} · {vehicleLabel}
          </Text>
        </View>
        <StatusBadge status={manifest.displayStatus || manifest.status} />
      </View>

      <View style={styles.statsRow}>
        <StatPill label="Total" value={manifest.stats.total} colors={colors} />
        <StatPill
          label="Out"
          value={manifest.stats.outForDelivery}
          colors={colors}
          accent="#e879f9"
        />
        <StatPill
          label="Done"
          value={manifest.stats.delivered}
          colors={colors}
          accent="#4ade80"
        />
        <StatPill
          label="Failed"
          value={manifest.stats.failed}
          colors={colors}
          accent="#f87171"
        />
        <StatPill
          label="Left"
          value={manifest.stats.remaining}
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
          {Array.isArray(manifest.shipmentIds) && manifest.shipmentIds.length > 0
            ? "Loading package details..."
            : "No packages on this manifest yet."}
        </Text>
      ) : (
        manifest.shipments.map((shipment) => (
          <TouchableOpacity
            key={shipment.id}
            style={[
              styles.packageRow,
              { borderColor: colors.border, backgroundColor: colors.cardMuted },
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
            <StatusBadge status={shipment.status || "ASSIGNED"} />
          </TouchableOpacity>
        ))
      )}
    </TouchableOpacity>
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
    gap: 8,
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
  cardTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: "800",
  },
  statsRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 4,
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
